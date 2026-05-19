import assert from 'node:assert/strict';
import test from 'node:test';
import { endpointForRunType, runWaitMsForType, runBodyForType } from '../src/mcp-run.mjs';

test('maps unified gemini_run types to bridge endpoints', () => {
  assert.equal(endpointForRunType('ask'), '/ask');
  assert.equal(endpointForRunType('text'), '/ask');
  assert.equal(endpointForRunType('code'), '/code');
  assert.equal(endpointForRunType('image'), '/image');
  assert.equal(endpointForRunType('video'), '/video');
});

test('rejects unsupported gemini_run types', () => {
  assert.throws(() => endpointForRunType('music'), /Unsupported gemini_run type: music/);
});

test('uses type-specific default wait timeouts', () => {
  assert.equal(runWaitMsForType('ask'), 120000);
  assert.equal(runWaitMsForType('code'), 120000);
  assert.equal(runWaitMsForType('image'), 600000);
  assert.equal(runWaitMsForType('video'), 1800000);
});

test('builds unified run body with context and output directory where relevant', () => {
  assert.deepEqual(runBodyForType({ type: 'code', prompt: 'write tests', context: 'repo context', outputDir: 'ignored' }), {
    prompt: 'write tests',
    context: 'repo context',
  });

  assert.deepEqual(runBodyForType({ type: 'image', prompt: 'make poster', context: 'ignored', outputDir: 'campaign' }), {
    prompt: 'make poster',
    outputDir: 'campaign',
  });
});
