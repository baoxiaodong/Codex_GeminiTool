import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTaskRequest } from '../src/protocol.mjs';

test('normalizes supported task requests', () => {
  const task = normalizeTaskRequest({
    type: 'generate_image',
    prompt: 'A calm control room',
    outputDir: 'outputs/images',
  });

  assert.equal(task.type, 'image');
  assert.equal(task.prompt, 'A calm control room');
  assert.equal(task.outputDir, 'outputs/images');
});

test('rejects empty prompts', () => {
  assert.throws(
    () => normalizeTaskRequest({ type: 'ask', prompt: '   ' }),
    /prompt is required/,
  );
});

test('rejects unsupported task types', () => {
  assert.throws(
    () => normalizeTaskRequest({ type: 'music', prompt: 'compose' }),
    /Unsupported task type: music/,
  );
});
