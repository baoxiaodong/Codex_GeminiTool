import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { saveCodeResultFiles } from '../src/result-files.mjs';

test('saves Gemini code task text as a single markdown file', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-code-result-'));
  try {
    const files = await saveCodeResultFiles(root, 'task-000123', {
      text: 'Here is a LangChain RAG example.',
      codeBlocks: [
        'print("hello")',
        'pip install -r requirements.txt',
      ],
    });

    assert.equal(files.length, 1);
    assert.deepEqual(files.map((file) => file.kind), ['code']);
    assert.deepEqual(files.map((file) => file.mimeType), ['text/markdown']);

    const expectedPaths = [
      path.join(root, 'code', 'task-000123.md'),
    ];
    assert.deepEqual(files.map((file) => file.path), expectedPaths);

    assert.match(await readFile(expectedPaths[0], 'utf8'), /Here is a LangChain RAG example\./);
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

test('does not create code files for Gemini shell text without usable code content', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-shell-code-result-'));
  try {
    const files = await saveCodeResultFiles(root, 'task-000125', {
      text: 'Gemini 说',
      codeBlocks: [],
    });

    assert.deepEqual(files, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('deduplicates repeated Gemini code blocks when there is no main text', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-dedupe-code-result-'));
  try {
    const files = await saveCodeResultFiles(root, 'task-000126', {
      text: '',
      codeBlocks: [
        'Java\n@RestController\nclass UserController {}',
        'Java\n@RestController\nclass UserController {}',
        '@RestController\nclass UserController {}',
      ],
    });

    assert.equal(files.length, 1);
    assert.deepEqual(files.map((file) => path.basename(file.path)), [
      'task-000126-code-0.txt',
    ]);
    assert.equal(await readFile(files[0].path, 'utf8'), 'Java\n@RestController\nclass UserController {}\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('saves only the main markdown file when Gemini code result already has explanatory text', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-code-main-only-'));
  try {
    const files = await saveCodeResultFiles(root, 'task-000127', {
      text: '完整案例说明。\n```java\nclass Demo {}\n```',
      codeBlocks: [
        'Java\nclass Demo {}',
        'SQL\nCREATE TABLE demo(id BIGINT);',
      ],
    });

    assert.equal(files.length, 1);
    assert.equal(path.basename(files[0].path), 'task-000127.md');
    assert.match(await readFile(files[0].path, 'utf8'), /完整案例说明/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
