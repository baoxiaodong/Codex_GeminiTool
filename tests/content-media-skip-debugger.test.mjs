import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('media tasks skip debugger fallback after DOM submission attempt', async () => {
  const source = await readFile('F:/Codex_GeminiTool/extension/content-script.js', 'utf8');
  const start = source.indexOf("async function submitPrompt(prompt, type = 'ask')");
  const end = source.indexOf('async function submitPromptWithDom(prompt, input, type = \'ask\')');
  const block = source.slice(start, end);

  assert.equal(block.includes("if ((type === 'image' || type === 'video') && !submission?.didSubmit)"), true);
  assert.equal(block.includes("method: 'dom_forced_optimistic'"), true);
  assert.ok(block.indexOf("if ((type === 'image' || type === 'video') && !submission?.didSubmit)") < block.indexOf('submitPromptInPageWithDebugger(prompt)'));
});
