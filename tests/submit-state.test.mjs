import assert from 'node:assert/strict';
import test from 'node:test';
import { buttonLooksLikeStop, submissionLooksSuccessful } from '../extension/submit-state.js';

test('detects stop-like button labels across locales', () => {
  assert.equal(buttonLooksLikeStop('Stop generating'), true);
  assert.equal(buttonLooksLikeStop('停止生成'), true);
  assert.equal(buttonLooksLikeStop('Cancel'), true);
  assert.equal(buttonLooksLikeStop('发送'), false);
});

test('treats cleared prompt, running state, or explicit submit flag as successful submission', () => {
  assert.equal(submissionLooksSuccessful({ didSubmit: true, inputContainsPrompt: true, runningDetected: false }), true);
  assert.equal(submissionLooksSuccessful({ didSubmit: false, inputContainsPrompt: false, runningDetected: false }), true);
  assert.equal(submissionLooksSuccessful({ didSubmit: false, inputContainsPrompt: true, runningDetected: true }), true);
  assert.equal(submissionLooksSuccessful({ didSubmit: false, inputContainsPrompt: true, runningDetected: false }), false);
});
