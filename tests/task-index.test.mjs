import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { appendTaskIndex } from '../src/task-index.mjs';

test('appends completed Gemini task summaries to output index', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-task-index-'));
  try {
    const task = {
      id: 'task-000123',
      type: 'code',
      prompt: 'write a RAG demo',
      status: 'completed',
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:00:05.000Z',
      result: {
        text: 'done',
        files: [
          { kind: 'code', path: path.join(root, 'code', 'task-000123.md'), mimeType: 'text/markdown' },
        ],
        media: [],
      },
    };

    const entry = await appendTaskIndex(root, task);
    const indexPath = path.join(root, 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf8'));

    assert.equal(entry.taskId, 'task-000123');
    assert.equal(entry.type, 'code');
    assert.equal(entry.status, 'completed');
    assert.equal(entry.prompt, 'write a RAG demo');
    assert.deepEqual(entry.files, ['code/task-000123.md']);
    assert.equal(index.tasks.length, 1);
    assert.deepEqual(index.tasks[0], entry);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('keeps newest task index entries first', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-task-index-order-'));
  try {
    await appendTaskIndex(root, {
      id: 'task-000001',
      type: 'ask',
      prompt: 'first',
      status: 'completed',
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:00:01.000Z',
      result: { files: [], media: [] },
    });
    await appendTaskIndex(root, {
      id: 'task-000002',
      type: 'image',
      prompt: 'second',
      status: 'completed',
      createdAt: '2026-05-19T00:00:02.000Z',
      updatedAt: '2026-05-19T00:00:03.000Z',
      result: { files: [], media: [{ kind: 'image', url: 'https://example.com/image.png' }] },
    });

    const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
    assert.deepEqual(index.tasks.map((task) => task.taskId), ['task-000002', 'task-000001']);
    assert.deepEqual(index.tasks[0].media, [{
      kind: 'image',
      url: 'https://example.com/image.png',
      mimeType: '',
      width: null,
      height: null,
      duration: null,
    }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
