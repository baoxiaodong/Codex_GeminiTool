import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser agent captures diagnostics on media task failure', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /captureBrowserFailureDiagnostics/);
  assert.match(source, /browser-debug/);
});
