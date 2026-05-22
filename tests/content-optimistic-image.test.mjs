import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('submitPromptWithDom allows optimistic submission for image and video tasks', async () => {
  const source = await readFile('F:/Codex_GeminiTool/extension/content-script.js', 'utf8');
  const start = source.indexOf('async function submitPromptWithDom(prompt, input, type = \'ask\')');
  const end = source.indexOf('function sendRuntimeMessage(message)');
  const block = source.slice(start, end);

  assert.equal(block.includes("didSubmit: type === 'image' || type === 'video'"), true);
  assert.equal(block.includes("method: 'dom_unconfirmed'"), true);
});
