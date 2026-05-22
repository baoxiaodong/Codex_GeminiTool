import assert from 'node:assert/strict';
import test from 'node:test';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { dataUrlToImageContent, fileToContentBlocks, formatToolPayload, readDataUrl } from '../src/mcp-format.mjs';

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

test('keeps saved file paths out of Gemini text output', () => {
  const formatted = formatToolPayload({
    text: '',
    codeBlocks: [],
    files: [{ kind: 'image', path: 'C:/temp/test.png', mimeType: 'image/png' }],
    media: [],
    raw: null,
  });

  assert.doesNotMatch(formatted.text, /C:\/temp\/test\.png/);
  assert.equal(formatted.structured.files[0].path, 'C:/temp/test.png');
});

test('formats status-like payloads without text', () => {
  const formatted = formatToolPayload({
    ok: true,
    bridge: 'gemini-web-bridge',
    executionModes: { ask: 'browser', code: 'browser', image: 'browser', video: 'browser' },
    geminiPagePollingActive: true,
    polling: true,
  });

  assert.match(formatted.text, /ok: true/);
  assert.match(formatted.text, /bridge: gemini-web-bridge/);
  assert.match(formatted.text, /executionModes: \{"ask":"browser","code":"browser","image":"browser","video":"browser"\}/);
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

  assert.doesNotMatch(formatted.text, /Files:/);
  assert.doesNotMatch(formatted.text, /Media:/);
  assert.doesNotMatch(formatted.text, /C:\/temp\/test\.png/);
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

  assert.doesNotMatch(formatted.text, /video: C:\/temp\/test\.mp4/);
  assert.doesNotMatch(formatted.text, /1280x720/);
  assert.doesNotMatch(formatted.text, /8s/);
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

test('does not add saved image file markdown previews to Gemini text output', () => {
  const formatted = formatToolPayload({
    text: '',
    codeBlocks: [],
    files: [{ kind: 'image', path: 'C:\\temp\\gemini\\task-1.png', mimeType: 'image/png' }],
    media: [],
    raw: null,
  });

  assert.doesNotMatch(formatted.text, /!\[Gemini image\]/);
  assert.doesNotMatch(formatted.text, /C:\/temp\/gemini\/task-1\.png/);
});

test('does not add saved video file markdown previews to Gemini text output', () => {
  const formatted = formatToolPayload({
    text: '',
    codeBlocks: [],
    files: [{ kind: 'video', path: 'C:\\temp\\gemini\\task-2.mp4', mimeType: 'video/mp4' }],
    media: [],
    raw: null,
  });

  assert.doesNotMatch(formatted.text, /!\[Gemini video\]/);
  assert.doesNotMatch(formatted.text, /C:\/temp\/gemini\/task-2\.mp4/);
});

test('keeps Gemini document text intact without replacing it with a preview', () => {
  const documentText = '# SpringCloud + MySQL 案例\n\n## 架构\n\n完整正文第一段。\n\n## 代码\n\n```java\nclass Demo {}\n```';
  const formatted = formatToolPayload({
    text: documentText,
    codeBlocks: [],
    files: [{ kind: 'code', path: 'C:/temp/task-doc.md', mimeType: 'text/markdown' }],
    media: [],
    raw: null,
  });

  assert.equal(formatted.text, documentText);
});

test('converts image data URLs to MCP image content', () => {
  const content = dataUrlToImageContent('data:image/png;base64,aGVsbG8=');

  assert.deepEqual(content, {
    type: 'image',
    data: 'aGVsbG8=',
    mimeType: 'image/png',
  });
});

test('converts saved image files to Codex-renderable MCP content', async () => {
  const content = await fileToContentBlocks({ kind: 'image', path: 'F:/missing/task-1.png', mimeType: 'image/png' }, {
    readFile: async () => Buffer.from('hello'),
  });

  assert.deepEqual(content, [
    {
      type: 'image',
      data: 'aGVsbG8=',
      mimeType: 'image/png',
    },
    {
      type: 'resource_link',
      uri: 'file:///F:/missing/task-1.png',
      name: 'task-1.png',
      mimeType: 'image/png',
    },
  ]);
});

test('converts saved video files to embedded resources and clickable MCP resource links', async () => {
  const content = await fileToContentBlocks({ kind: 'video', path: 'C:\\temp\\task-2.mp4', mimeType: 'video/mp4' }, {
    readFile: async () => Buffer.from('video'),
  });

  assert.deepEqual(content, [
    {
      type: 'resource',
      resource: {
        uri: 'file:///C:/temp/task-2.mp4',
        mimeType: 'video/mp4',
        blob: 'dmlkZW8=',
      },
    },
    {
      type: 'resource_link',
      uri: 'file:///C:/temp/task-2.mp4',
      name: 'task-2.mp4',
      mimeType: 'video/mp4',
    },
  ]);
});

test('saved file content blocks satisfy MCP call tool schema', async () => {
  const imageBlocks = await fileToContentBlocks({ kind: 'image', path: 'C:\\temp\\task-1.png', mimeType: 'image/png' }, {
    readFile: async () => Buffer.from('hello'),
  });
  const videoBlocks = await fileToContentBlocks({ kind: 'video', path: 'C:\\temp\\task-2.mp4', mimeType: 'video/mp4' }, {
    readFile: async () => Buffer.from('video'),
  });

  const parsed = CallToolResultSchema.safeParse({
    content: [
      { type: 'text', text: 'Gemini result' },
      ...imageBlocks,
      ...videoBlocks,
    ],
  });

  assert.equal(parsed.success, true);
});

test('reads base64 and URL-encoded data URLs', () => {
  const base64 = readDataUrl('data:text/plain;base64,aGVsbG8=');
  const encoded = readDataUrl('data:text/plain,hello%20world');

  assert.equal(base64.mimeType, 'text/plain');
  assert.equal(base64.buffer.toString('utf8'), 'hello');
  assert.equal(encoded.mimeType, 'text/plain');
  assert.equal(encoded.buffer.toString('utf8'), 'hello world');
});
