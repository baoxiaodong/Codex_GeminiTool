import assert from 'node:assert/strict';
import test from 'node:test';
import { executionModeForType } from '../src/execution-mode.mjs';

test('uses browser mode by default for image and video tasks', () => {
  assert.equal(executionModeForType('image', {}), 'browser');
  assert.equal(executionModeForType('video', {}), 'browser');
});

test('uses browser mode by default for ask and code tasks', () => {
  assert.equal(executionModeForType('ask', {}), 'browser');
  assert.equal(executionModeForType('code', {}), 'browser');
});

test('allows explicit environment override per task family', () => {
  assert.equal(executionModeForType('image', { GEMINI_BRIDGE_IMAGE_MODE: 'extension' }), 'extension');
  assert.equal(executionModeForType('code', { GEMINI_BRIDGE_CODE_MODE: 'browser' }), 'browser');
});
