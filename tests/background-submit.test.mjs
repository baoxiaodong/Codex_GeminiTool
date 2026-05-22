import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('page-evaluated submission checker does not depend on extension-scope helpers', async () => {
  const source = await readFile('F:/Codex_GeminiTool/extension/background.js', 'utf8');
  const start = source.indexOf('async function checkPromptSubmissionInPage(prompt)');
  const end = source.indexOf('function attachDebugger(target)');
  const block = source.slice(start, end);

  assert.equal(block.includes('buttonLooksLikeStop('), false);
  assert.equal(block.includes('submissionLooksSuccessful('), false);
});
