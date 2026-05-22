import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('image and video input path no longer uses debugger text insertion fallback', async () => {
  const source = await readFile('F:/Codex_GeminiTool/extension/content-script.js', 'utf8');
  const start = source.indexOf('async function setPromptText(input, prompt)');
  const end = source.indexOf('async function tryInsertTextWithDebugger(input, prompt)');
  const block = source.slice(start, end);

  assert.equal(block.includes('await tryInsertTextWithDebugger(input, prompt)'), false);
});
