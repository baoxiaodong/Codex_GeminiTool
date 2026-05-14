import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveOutputPath } from '../src/output-paths.mjs';

test('resolves output paths inside the configured root', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-bridge-'));
  try {
    const resolved = resolveOutputPath(root, 'images/result.png');
    assert.equal(resolved, path.join(root, 'images', 'result.png'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('blocks path traversal outside the configured root', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gemini-bridge-'));
  try {
    assert.throws(
      () => resolveOutputPath(root, '../secret.txt'),
      /Output path escapes root/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
