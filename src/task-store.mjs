import { EventEmitter } from 'node:events';

export function createTaskStore(options = {}) {
  const now = options.now ?? (() => new Date());
  const tasks = new Map();
  const events = new EventEmitter();
  let sequence = Math.max(0, Math.floor(Number(options.initialSequence ?? 0)));

  function timestamp() {
    return now().toISOString();
  }

  function createTask(request) {
    sequence += 1;
    const id = `task-${String(sequence).padStart(6, '0')}`;
    const createdAt = timestamp();
    const task = {
      id,
      type: request.type,
      prompt: request.prompt,
      context: request.context ?? '',
      outputDir: request.outputDir ?? '',
      metadata: request.metadata ?? {},
      status: 'queued',
      createdAt,
      updatedAt: createdAt,
      claimedAt: null,
      heartbeatAt: null,
      result: null,
      error: null,
    };

    tasks.set(id, task);
    events.emit('queued', task);
    return cloneTask(task);
  }

  function claimNextTask(options = {}) {
    if (Number(options.requeueStaleMs) > 0) {
      requeueStaleTasks(Number(options.requeueStaleMs));
    }

    for (const task of tasks.values()) {
      if (task.status === 'queued') {
        return startTask(task.id);
      }
    }
    return null;
  }

  function startTask(id) {
    const task = requireTask(tasks, id);
    if (task.status !== 'queued') {
      return cloneTask(task);
    }

    task.status = 'in_progress';
    task.claimedAt = timestamp();
    task.heartbeatAt = task.claimedAt;
    task.updatedAt = task.claimedAt;
    events.emit('updated', cloneTask(task));
    return cloneTask(task);
  }

  function getTask(id) {
    const task = tasks.get(id);
    return task ? cloneTask(task) : null;
  }

  function deleteTask(id) {
    const deleted = tasks.delete(id);
    if (deleted) events.emit('updated', { id, status: 'deleted' });
    return deleted;
  }

  function listTasks() {
    return Array.from(tasks.values(), cloneTask);
  }

  function completeTask(id, result) {
    const task = requireTask(tasks, id);
    task.status = 'completed';
    task.result = result;
    task.error = null;
    task.heartbeatAt = null;
    task.updatedAt = timestamp();
    events.emit('updated', cloneTask(task));
    events.emit(`done:${id}`, cloneTask(task));
    return cloneTask(task);
  }

  function failTask(id, error) {
    const task = requireTask(tasks, id);
    task.status = 'failed';
    task.result = null;
    task.error = typeof error === 'string' ? error : error?.message ?? 'Unknown extension error';
    task.heartbeatAt = null;
    task.updatedAt = timestamp();
    events.emit('updated', cloneTask(task));
    events.emit(`done:${id}`, cloneTask(task));
    return cloneTask(task);
  }

  function touchTask(id) {
    const task = tasks.get(id);
    if (!task || task.status !== 'in_progress') {
      return null;
    }

    task.heartbeatAt = timestamp();
    events.emit('updated', cloneTask(task));
    return cloneTask(task);
  }

  function requeueStaleTasks(timeoutMs) {
    const nowMs = Date.parse(timestamp());
    const requeued = [];

    for (const task of tasks.values()) {
      if (task.status !== 'in_progress') continue;
      const lastActiveAt = Date.parse(task.heartbeatAt ?? task.updatedAt);
      if (!Number.isFinite(lastActiveAt) || nowMs - lastActiveAt <= timeoutMs) continue;

      task.status = 'queued';
      task.claimedAt = null;
      task.heartbeatAt = null;
      task.updatedAt = timestamp();
      events.emit('updated', cloneTask(task));
      requeued.push(cloneTask(task));
    }

    return requeued;
  }

  function waitForTerminal(id, timeoutMs) {
    const existing = getTask(id);
    if (!existing) {
      return Promise.reject(new Error(`Unknown task id: ${id}`));
    }

    if (existing.status === 'completed' || existing.status === 'failed') {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        events.off(`done:${id}`, onDone);
        reject(new Error(`Timed out waiting for task ${id}`));
      }, timeoutMs);

      function onDone(task) {
        clearTimeout(timer);
        resolve(task);
      }

      events.once(`done:${id}`, onDone);
    });
  }

  function waitForStatus(id, statuses, timeoutMs) {
    const wanted = new Set(statuses);
    const existing = getTask(id);
    if (!existing) {
      return Promise.reject(new Error(`Unknown task id: ${id}`));
    }

    if (wanted.has(existing.status)) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        events.off('updated', onUpdated);
        reject(new Error(`Timed out waiting for task ${id} to reach ${Array.from(wanted).join(', ')}`));
      }, timeoutMs);

      function onUpdated(task) {
        if (task.id !== id || !wanted.has(task.status)) {
          return;
        }

        clearTimeout(timer);
        events.off('updated', onUpdated);
        resolve(task);
      }

      events.on('updated', onUpdated);
    });
  }

  return {
    createTask,
    claimNextTask,
    startTask,
    getTask,
    deleteTask,
    listTasks,
    completeTask,
    failTask,
    touchTask,
    requeueStaleTasks,
    waitForTerminal,
    waitForStatus,
    events,
  };
}

function requireTask(tasks, id) {
  const task = tasks.get(id);
  if (!task) {
    throw new Error(`Unknown task id: ${id}`);
  }
  return task;
}

function cloneTask(task) {
  return structuredClone(task);
}
