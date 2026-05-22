import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('composerStillLooksIdle recognizes Chinese stop labels', async () => {
  const source = await readFile('F:/Codex_GeminiTool/extension/content-script.js', 'utf8');
  const start = source.indexOf('function composerStillLooksIdle(input)');
  const end = source.indexOf('function describeButton(button)');
  const block = source.slice(start, end);

  assert.equal(block.includes("label.includes('停止')"), true);
  assert.equal(block.includes("label.includes('取消')"), true);
});
