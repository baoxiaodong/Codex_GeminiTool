import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser prompt submission uses Playwright keyboard input and labelled send buttons', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /page\.keyboard\.insertText\(prompt\)/);
  assert.match(source, /clickSendButton/);
  assert.match(source, /label\.includes\('发送'\)/);
});

test('browser prompt submission does not mark media tasks submitted optimistically', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.equal(source.includes("didSubmit: isGenerating() || type === 'image' || type === 'video'"), false);
});

test('browser task fails fast when Gemini composer does not submit', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /Composer did not submit prompt/);
});

test('browser prompt submission falls back to DOM composer fill when keyboard input does not enable send', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /fillPromptWithDomFallback/);
  assert.match(source, /if \(!clickedSend\) \{/);
});
