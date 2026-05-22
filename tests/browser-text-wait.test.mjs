import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser ask/code path waits for Gemini to finish generating before accepting a new response', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /if \(type === 'image'\)/);
  assert.match(source, /if \(type === 'video'\)/);
  assert.match(source, /if \(isGeminiStillGenerating\(\)\) return false;\s*return signature && signature !== beforeSignature;/);
  assert.match(source, /return signature && signature !== beforeSignature;/);
});

test('browser ask/code result selection uses the latest new Gemini response container', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /beforeResponseSnapshot/);
  assert.match(source, /beforeResponseSet/);
  assert.match(source, /latestCandidate/);
});
