import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskStore } from '../src/task-store.mjs';

test('creates queued tasks with stable ids and timestamps', () => {
  const store = createTaskStore({ now: () => new Date('2026-05-14T08:00:00.000Z') });

  const task = store.createTask({ type: 'ask', prompt: 'hello' });

  assert.equal(task.id, 'task-000001');
  assert.equal(task.status, 'queued');
  assert.equal(task.createdAt, '2026-05-14T08:00:00.000Z');
  assert.equal(store.getTask(task.id).prompt, 'hello');
});

test('continues task ids from an existing sequence', () => {
  const store = createTaskStore({ initialSequence: 6 });

  const task = store.createTask({ type: 'ask', prompt: 'hello again' });

  assert.equal(task.id, 'task-000007');
});

test('claims queued tasks once and marks them in progress', () => {
  const store = createTaskStore();
  const first = store.createTask({ type: 'image', prompt: 'make a poster' });

  const claimed = store.claimNextTask();
  const secondClaim = store.claimNextTask();

  assert.equal(claimed.id, first.id);
  assert.equal(claimed.status, 'in_progress');
  assert.equal(secondClaim, null);
  assert.equal(store.getTask(first.id).status, 'in_progress');
  assert.ok(store.getTask(first.id).claimedAt);
  assert.ok(store.getTask(first.id).heartbeatAt);
});

test('completes tasks with result payloads', () => {
  const store = createTaskStore();
  const task = store.createTask({ type: 'code', prompt: 'write tests' });
  store.claimNextTask();

  const completed = store.completeTask(task.id, { text: 'done' });

  assert.equal(completed.status, 'completed');
  assert.deepEqual(completed.result, { text: 'done' });
});

test('fails unknown tasks with actionable errors', () => {
  const store = createTaskStore();

  assert.throws(
    () => store.completeTask('missing', {}),
    /Unknown task id: missing/,
  );
});

test('touches in-progress tasks and requeues stale tasks', () => {
  let now = new Date('2026-05-14T08:00:00.000Z');
  const store = createTaskStore({ now: () => now });
  const task = store.createTask({ type: 'ask', prompt: 'hello' });
  store.claimNextTask();

  now = new Date('2026-05-14T08:00:10.000Z');
  const touched = store.touchTask(task.id);
  assert.equal(touched.heartbeatAt, '2026-05-14T08:00:10.000Z');

  now = new Date('2026-05-14T08:01:00.000Z');
  const requeued = store.requeueStaleTasks(45000);

  assert.equal(requeued.length, 1);
  assert.equal(store.getTask(task.id).status, 'queued');
  assert.equal(store.getTask(task.id).claimedAt, null);
});

test('waits for status changes without waiting for terminal completion', async () => {
  const store = createTaskStore();
  const task = store.createTask({ type: 'code', prompt: 'write code' });

  const waiting = store.waitForStatus(task.id, ['in_progress'], 1000);
  store.claimNextTask();

  const claimed = await waiting;
  assert.equal(claimed.status, 'in_progress');
});
