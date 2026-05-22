import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser media capture falls back to fetching generated image URLs as data URLs', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /fetchAsDataUrl/);
  assert.match(source, /await fetch\(src\)/);
});

test('browser media capture only returns newly generated media', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /collectBrowserMediaSignatures/);
  assert.match(source, /const beforeSet = new Set\(beforeMediaSignatures\)/);
});

test('browser media capture excludes Gemini static UI assets', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /isGeneratedMediaCandidate/);
  assert.match(source, /gstatic\.com/);
  assert.match(source, /\.svg/);
});

test('browser media capture inspects the latest Gemini response container for canvas and background images', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /latest\.querySelectorAll\('canvas'\)/);
  assert.match(source, /backgroundImage/);
  assert.match(source, /sourceLinks/);
});

test('browser media capture hydrates generated video URLs through the logged-in browser context', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /hydrateBrowserVideoDataUrls/);
  assert.match(source, /page\.context\(\)\.request\.get/);
  assert.match(source, /data:video\/mp4;base64/);
});
