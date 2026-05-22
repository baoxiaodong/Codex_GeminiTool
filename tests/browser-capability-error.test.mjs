import assert from 'node:assert/strict';
import test from 'node:test';
import { detectGeminiCapabilityError } from '../src/browser-agent.mjs';

test('detects Gemini login and image capability replies', () => {
  assert.equal(
    detectGeminiCapabilityError('您登录了吗？我可以搜索图片，但目前似乎无法为您创建任何图片。'),
    'Gemini automation browser is not logged in or this account/session cannot create images. Open the dedicated automation browser, sign in to Gemini, confirm image generation works there once, then retry.',
  );
});

test('ignores ordinary Gemini responses', () => {
  assert.equal(detectGeminiCapabilityError('Here is your generated implementation.'), null);
});

test('browser image wait does not scan the full page for generic sign-in text', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.equal(source.includes("hasCapabilityError(document.body?.innerText || '')"), false);
  assert.match(source, /hasCapabilityError\(text\)/);
});
