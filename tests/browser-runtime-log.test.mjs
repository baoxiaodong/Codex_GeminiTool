import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser agent records runtime lifecycle logs for debugging long media tasks', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /createBrowserRuntimeLogger/);
  assert.match(source, /browser-debug/);
  assert.match(source, /page\.on\('close'/);
  assert.match(source, /disconnected/);
});
