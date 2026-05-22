import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('package exposes a panel launcher command', async () => {
  const pkg = JSON.parse(await readFile('F:/Codex_GeminiTool/package.json', 'utf8'));

  assert.equal(pkg.scripts.panel, 'node src/open-panel.mjs');
});

test('panel launcher starts the 9876 bridge and opens the panel url', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/open-panel.mjs', 'utf8').catch(() => '');

  assert.match(source, /const PANEL_PORT = Number\(process\.env\.GEMINI_BRIDGE_PANEL_PORT \?\? 9876\)/);
  assert.match(source, /GEMINI_BRIDGE_PORT: String\(PANEL_PORT\)/);
  assert.match(source, /http:\/\/127\.0\.0\.1:\$\{PANEL_PORT\}\/panel/);
  assert.match(source, /Start-Process/);
  assert.match(source, /waitForHealth/);
});

test('windows double-click helper delegates to npm run panel', async () => {
  const source = await readFile('F:/Codex_GeminiTool/open-panel.cmd', 'utf8').catch(() => '');

  assert.match(source, /npm run panel/);
  assert.match(source, /F:\\Codex_GeminiTool/);
});
