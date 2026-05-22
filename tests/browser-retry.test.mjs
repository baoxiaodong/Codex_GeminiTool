import assert from 'node:assert/strict';
import test from 'node:test';
import { isRetryableGeminiMediaFailure } from '../src/browser-agent.mjs';

test('detects retryable Gemini media failures', () => {
  assert.equal(isRetryableGeminiMediaFailure('出了点问题 (1099)'), true);
  assert.equal(isRetryableGeminiMediaFailure('Something went wrong (1099)'), true);
  assert.equal(isRetryableGeminiMediaFailure('Verifying image compliance'), false);
});
