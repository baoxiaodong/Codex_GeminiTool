import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { saveCodeResultFiles } from '../src/result-files.mjs';

test('saves Gemini code task text and code blocks under code directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-code-result-'));
  try {
    const files = await saveCodeResultFiles(root, 'task-000123', {
      text: 'Here is a LangChain RAG example.',
      codeBlocks: [
        'print("hello")',
        'pip install -r requirements.txt',
      ],
    });

    assert.equal(files.length, 3);
    assert.deepEqual(files.map((file) => file.kind), ['code', 'code', 'code']);
    assert.deepEqual(files.map((file) => file.mimeType), ['text/markdown', 'text/x-python', 'text/plain']);

    const expectedPaths = [
      path.join(root, 'code', 'task-000123.md'),
      path.join(root, 'code', 'task-000123-code-0.py'),
      path.join(root, 'code', 'task-000123-code-1.txt'),
    ];
    assert.deepEqual(files.map((file) => file.path), expectedPaths);

    assert.match(await readFile(expectedPaths[0], 'utf8'), /Here is a LangChain RAG example\./);
    assert.equal(await readFile(expectedPaths[1], 'utf8'), 'print("hello")\n');
    assert.equal(await readFile(expectedPaths[2], 'utf8'), 'pip install -r requirements.txt\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('does not create code files for empty Gemini code results', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-empty-code-result-'));
  try {
    const files = await saveCodeResultFiles(root, 'task-000124', {
      text: '',
      codeBlocks: [],
    });

    assert.deepEqual(files, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
