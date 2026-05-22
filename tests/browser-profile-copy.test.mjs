import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser profile copy excludes Network directory from raw recursive copy', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');
  assert.equal(source.includes('Network'), true);
  assert.equal(source.includes("const srcCookies = path.join(srcProfile, 'Network', 'Cookies');"), true);
  assert.equal(source.includes('await backupSqliteDatabase(srcCookies, dstCookies);'), true);
});
