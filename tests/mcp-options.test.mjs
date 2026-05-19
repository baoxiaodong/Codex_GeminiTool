import assert from 'node:assert/strict';
import test from 'node:test';
import { withWaitOptions } from '../src/mcp-options.mjs';

test('waits for terminal result by default for direct display tools', () => {
  const options = withWaitOptions({ prompt: 'hello' }, {
    wait: undefined,
    waitMs: undefined,
    terminalDefaultMs: 120000,
    ackDefaultMs: 5000,
    defaultWait: true,
  });

  assert.deepEqual(options, {
    prompt: 'hello',
    wait: true,
    waitMs: 120000,
  });
});

test('allows direct display tools to opt out to async acknowledgement', () => {
  const options = withWaitOptions({ prompt: 'make image' }, {
    wait: false,
    waitMs: undefined,
    terminalDefaultMs: 600000,
    ackDefaultMs: 5000,
    defaultWait: true,
  });

  assert.deepEqual(options, {
    prompt: 'make image',
    wait: false,
    waitAckMs: 5000,
  });
});

test('uses custom timeout as terminal wait when waiting for final result', () => {
  const options = withWaitOptions({ prompt: 'make video' }, {
    wait: true,
    waitMs: 90000,
    terminalDefaultMs: 1800000,
    ackDefaultMs: 5000,
    defaultWait: false,
  });

  assert.deepEqual(options, {
    prompt: 'make video',
    wait: true,
    waitMs: 90000,
  });
});

test('keeps compatibility async tools on acknowledgement by default', () => {
  const options = withWaitOptions({ prompt: 'legacy image' }, {
    wait: undefined,
    waitMs: undefined,
    terminalDefaultMs: 600000,
    ackDefaultMs: 5000,
    defaultWait: false,
  });

  assert.deepEqual(options, {
    prompt: 'legacy image',
    wait: false,
    waitAckMs: 5000,
  });
});
