import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser profile copy excludes session runtime directories from raw recursive copy', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');
  assert.equal(source.includes("!lower.includes('sessions')"), true);
  assert.equal(source.includes("!lower.includes('session storage')"), true);
});
