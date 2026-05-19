import assert from 'node:assert/strict';
import test from 'node:test';
import { dataUrlToImageContent, formatToolPayload, readDataUrl } from '../src/mcp-format.mjs';

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

test('formats bridge health version mismatch diagnostics', () => {
  const formatted = formatToolPayload({
    ok: true,
    bridge: 'gemini-web-bridge',
    expectedGeminiScriptVersion: '2026-05-18-v18',
    staleTaskMs: 45000,
    geminiPagePollingActive: false,
    lastIgnoredGeminiScriptVersion: '2026-05-18-v17',
    ignoredGeminiPagePollCount: 3,
  });

  assert.match(formatted.text, /expectedGeminiScriptVersion: 2026-05-18-v18/);
  assert.match(formatted.text, /lastIgnoredGeminiScriptVersion: 2026-05-18-v17/);
  assert.match(formatted.text, /ignoredGeminiPagePollCount: 3/);
});

test('formats task result payloads from bridge wait endpoints', () => {
  const formatted = formatToolPayload({
    id: 'task-000001',
    status: 'completed',
    type: 'image',
    result: {
      text: '',
      files: [{ kind: 'image', path: 'C:/temp/test.png', mimeType: 'image/png' }],
      media: [{ kind: 'image', dataUrl: 'data:image/png;base64,aGVsbG8=', width: 256, height: 256 }],
    },
  });

  assert.match(formatted.text, /Files:/);
  assert.match(formatted.text, /Media:/);
  assert.equal(formatted.structured.files[0].path, 'C:/temp/test.png');
  assert.equal(formatted.structured.media[0].width, 256);
  assert.equal(formatted.structured.task.id, 'task-000001');
});

test('formats saved video files and media metadata', () => {
  const formatted = formatToolPayload({
    id: 'task-000003',
    status: 'completed',
    type: 'video',
    result: {
      text: '',
      files: [{ kind: 'video', path: 'C:/temp/test.mp4', mimeType: 'video/mp4' }],
      media: [{ kind: 'video', url: 'blob:test', width: 1280, height: 720, duration: 8 }],
    },
  });

  assert.match(formatted.text, /video: C:\/temp\/test\.mp4/);
  assert.match(formatted.text, /1280x720/);
  assert.match(formatted.text, /8s/);
});

test('formats task lists from bridge', () => {
  const formatted = formatToolPayload({
    tasks: [
      { id: 'task-000001', type: 'image', status: 'queued', error: null },
      { id: 'task-000002', type: 'video', status: 'failed', error: 'boom' },
    ],
  });

  assert.match(formatted.text, /Tasks:/);
  assert.match(formatted.text, /task-000001: image queued/);
  assert.match(formatted.text, /task-000002: video failed \(boom\)/);
  assert.equal(formatted.structured.tasks.length, 2);
});

test('formats queued single task payloads with polling instruction', () => {
  const formatted = formatToolPayload({
    id: 'task-000010',
    type: 'image',
    status: 'queued',
    error: null,
    warning: 'No active Gemini page is polling.',
    result: null,
  });

  assert.match(formatted.text, /Task: task-000010 image queued/);
  assert.match(formatted.text, /Warning: No active Gemini page is polling\./);
  assert.match(formatted.text, /gemini_get_task/);
  assert.equal(formatted.structured.task.id, 'task-000010');
});

test('converts image data URLs to MCP image content', () => {
  const content = dataUrlToImageContent('data:image/png;base64,aGVsbG8=');

  assert.deepEqual(content, {
    type: 'image',
    data: 'aGVsbG8=',
    mimeType: 'image/png',
  });
});

test('reads base64 and URL-encoded data URLs', () => {
  const base64 = readDataUrl('data:text/plain;base64,aGVsbG8=');
  const encoded = readDataUrl('data:text/plain,hello%20world');

  assert.equal(base64.mimeType, 'text/plain');
  assert.equal(base64.buffer.toString('utf8'), 'hello');
  assert.equal(encoded.mimeType, 'text/plain');
  assert.equal(encoded.buffer.toString('utf8'), 'hello world');
});
