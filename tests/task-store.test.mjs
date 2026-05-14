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

test('claims queued tasks once and marks them in progress', () => {
  const store = createTaskStore();
  const first = store.createTask({ type: 'image', prompt: 'make a poster' });

  const claimed = store.claimNextTask();
  const secondClaim = store.claimNextTask();

  assert.equal(claimed.id, first.id);
  assert.equal(claimed.status, 'in_progress');
  assert.equal(secondClaim, null);
  assert.equal(store.getTask(first.id).status, 'in_progress');
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
