import { EventEmitter } from 'node:events';

export function createTaskStore(options = {}) {
  const now = options.now ?? (() => new Date());
  const tasks = new Map();
  const events = new EventEmitter();
  let sequence = 0;

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
      result: null,
      error: null,
    };

    tasks.set(id, task);
    events.emit('queued', task);
    return cloneTask(task);
  }

  function claimNextTask() {
    for (const task of tasks.values()) {
      if (task.status === 'queued') {
        task.status = 'in_progress';
        task.updatedAt = timestamp();
        events.emit('updated', cloneTask(task));
        return cloneTask(task);
      }
    }
    return null;
  }

  function getTask(id) {
    const task = tasks.get(id);
    return task ? cloneTask(task) : null;
  }

  function listTasks() {
    return Array.from(tasks.values(), cloneTask);
  }

  function completeTask(id, result) {
    const task = requireTask(tasks, id);
    task.status = 'completed';
    task.result = result;
    task.error = null;
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
    task.updatedAt = timestamp();
    events.emit('updated', cloneTask(task));
    events.emit(`done:${id}`, cloneTask(task));
    return cloneTask(task);
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

  return {
    createTask,
    claimNextTask,
    getTask,
    listTasks,
    completeTask,
    failTask,
    waitForTerminal,
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
