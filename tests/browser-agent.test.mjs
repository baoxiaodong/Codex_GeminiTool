import assert from 'node:assert/strict';
import test from 'node:test';
import { executeBrowserTask } from '../src/browser-agent.mjs';

test('browser agent returns structured result for code task skeleton', async () => {
  const result = await executeBrowserTask({
    id: 'task-000001',
    type: 'code',
    prompt: 'write hello world',
  }, { mode: 'stub' });

  assert.equal(typeof result.text, 'string');
  assert.deepEqual(Array.isArray(result.codeBlocks), true);
  assert.deepEqual(Array.isArray(result.media), true);
  assert.equal(result.raw.executor, 'browser');
  assert.equal(result.raw.mode, 'stub');
});

test('browser agent returns structured result for image task skeleton', async () => {
  const result = await executeBrowserTask({
    id: 'task-000002',
    type: 'image',
    prompt: 'make dashboard image',
  }, { mode: 'stub' });

  assert.equal(typeof result.text, 'string');
  assert.deepEqual(Array.isArray(result.codeBlocks), true);
  assert.deepEqual(Array.isArray(result.media), true);
  assert.equal(result.raw.executor, 'browser');
  assert.equal(result.raw.mode, 'stub');
});
