import assert from 'node:assert/strict';
import test from 'node:test';
import { formatToolPayload } from '../src/mcp-format.mjs';

test('formats plain text payloads with summary first', () => {
  const formatted = formatToolPayload({
    text: 'Hello from Gemini',
    codeBlocks: [],
    files: [],
    media: [],
    raw: null,
  });

  assert.match(formatted.text, /Hello from Gemini/);
  assert.equal(formatted.structured.summary, 'Hello from Gemini');
});

test('formats code blocks as fenced code sections', () => {
  const formatted = formatToolPayload({
    text: 'Here is code',
    codeBlocks: ['const x = 1;'],
    files: [],
    media: [],
    raw: null,
  });

  assert.match(formatted.text, /```/);
  assert.equal(formatted.structured.codeBlocks.length, 1);
});

test('formats saved files as readable paths', () => {
  const formatted = formatToolPayload({
    text: '',
    codeBlocks: [],
    files: [{ kind: 'image', path: 'C:/temp/test.png', mimeType: 'image/png' }],
    media: [],
    raw: null,
  });

  assert.match(formatted.text, /C:\/temp\/test\.png/);
  assert.equal(formatted.structured.files[0].path, 'C:/temp/test.png');
});

test('formats status-like payloads without text', () => {
  const formatted = formatToolPayload({
    ok: true,
    bridge: 'gemini-web-bridge',
    geminiPagePollingActive: true,
    polling: true,
  });

  assert.match(formatted.text, /ok: true/);
  assert.match(formatted.text, /bridge: gemini-web-bridge/);
});
