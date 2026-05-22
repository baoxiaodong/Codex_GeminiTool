import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('bridge saves remote media urls when no dataUrl is available', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/bridge-server.mjs', 'utf8');

  assert.match(source, /saveRemoteMediaFile/);
  assert.match(source, /typeof item\?\.url === 'string'/);
  assert.match(source, /saveRemoteMediaFile\(taskId, item\)/);
});

test('bridge does not save html sign-in pages as remote media artifacts', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/bridge-server.mjs', 'utf8');

  assert.match(source, /isHtmlLikeRemoteMedia/);
  assert.match(source, /remote media resolved to HTML/);
});
