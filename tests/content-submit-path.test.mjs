import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('submitPrompt no longer depends on debugger submission as the primary path', async () => {
  const source = await readFile('F:/Codex_GeminiTool/extension/content-script.js', 'utf8');
  const start = source.indexOf("async function submitPrompt(prompt, type = 'ask')");
  const end = source.indexOf('async function submitPromptInPageWithDebugger(prompt)');
  const block = source.slice(start, end);

  assert.equal(block.includes('submitPromptWithDom(prompt, input, type)'), true);
  assert.ok(block.indexOf('submitPromptWithDom(prompt, input, type)') < block.indexOf('submitPromptInPageWithDebugger(prompt)'));
  assert.equal(block.includes('let submission = domSubmission;'), true);
});
