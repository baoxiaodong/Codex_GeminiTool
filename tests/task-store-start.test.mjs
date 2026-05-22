import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskStore } from '../src/task-store.mjs';

test('starts a specific queued task by id', () => {
  const store = createTaskStore({ now: () => new Date('2026-05-19T08:00:00.000Z') });
  const task = store.createTask({ type: 'image', prompt: 'make dashboard' });

  const started = store.startTask(task.id);

  assert.equal(started.id, task.id);
  assert.equal(started.status, 'in_progress');
  assert.ok(started.claimedAt);
  assert.ok(started.heartbeatAt);
});
