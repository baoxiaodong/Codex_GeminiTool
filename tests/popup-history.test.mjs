import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('bridge exposes persisted task history endpoint for popup consumption', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/bridge-server.mjs', 'utf8');

  assert.match(source, /url\.pathname === '\/history'/);
  assert.match(source, /readTaskIndex/);
});

test('popup UI includes a history section', async () => {
  const source = await readFile('F:/Codex_GeminiTool/extension/popup.html', 'utf8');

  assert.match(source, /id="history"/);
  assert.match(source, /Recent Tasks|最近任务/);
});

test('popup script requests and renders history entries', async () => {
  const source = await readFile('F:/Codex_GeminiTool/extension/popup.js', 'utf8');

  assert.match(source, /popup_history/);
  assert.match(source, /renderHistory/);
});
