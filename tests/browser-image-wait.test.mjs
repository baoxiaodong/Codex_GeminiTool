import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser image path waits for visible image after generation stops', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');
  assert.equal(source.includes("if (type === 'image') {"), true);
  assert.equal(source.includes("return collectVisibleMediaCandidates(latest, type).some((item) => !beforeSet.has(item.signature));"), true);
  assert.equal(source.includes('visible: isGeneratedMediaCandidate(src, width, height) && box.width > 0 && box.height > 0,'), true);
});

test('browser image path ignores media that existed before prompt submission', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /beforeMediaSignatures/);
  assert.match(source, /!beforeSet\.has\(item\.signature\)/);
  assert.match(source, /beforeResponseSnapshot/);
  assert.match(source, /collectBrowserResponseSnapshot/);
});

test('browser image path waits until Gemini is no longer typing', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /isGeminiStillGenerating/);
  assert.match(source, /isGeminiTextStillGenerating/);
  assert.match(source, /Gemini 正在输入/);
  assert.match(source, /正在加载 Nano Banana/);
  assert.match(source, /verifying the image/);
  assert.match(source, /verifying image/);
  assert.match(source, /assessing initial output/);
});
