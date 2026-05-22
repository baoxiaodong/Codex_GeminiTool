import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser agent selects Gemini image/video tool modes before submitting media prompts', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.match(source, /async function ensureGeminiToolMode/);
  assert.match(source, /toolModeForTaskType/);
  assert.match(source, /制作图片/);
  assert.match(source, /制作视频/);
  assert.match(source, /上传和工具/);
  assert.match(source, /getByLabel\('上传和工具'\)/);
  assert.match(source, /findGeminiToolMenuTrigger/);
  assert.match(source, /clickGeminiToolMenuByGeometry/);
  assert.doesNotMatch(source, /if \(body\.includes\(label\)\) return true;/);
  assert.match(source, /isDisabledGeminiToolOption/);
  assert.match(source, /Gemini tool mode is visible but disabled/);
  assert.match(source, /await ensureGeminiToolMode\(page, task\.type\)/);
});

test('browser prompt builder does not append image or video instructions to user prompt', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/browser-agent.mjs', 'utf8');

  assert.doesNotMatch(source, /Generate an image\./);
  assert.doesNotMatch(source, /Generate a video if this Gemini web session supports video generation\./);
  assert.match(source, /if \(task\.type === 'image' \|\| task\.type === 'video'\) return task\.prompt;/);
});
