import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserSessionLabel,
  normalizeBrowserRuntimeMode,
  normalizeProfilePolicy,
  shouldCopyProfile,
} from '../src/browser-agent.mjs';

test('browser agent reuses a dedicated automation profile by default', () => {
  const policy = normalizeProfilePolicy({});
  const runtime = normalizeBrowserRuntimeMode({});

  assert.equal(policy, 'reuse');
  assert.equal(runtime, 'cdp');
  assert.equal(shouldCopyProfile({ policy, automationProfileExists: false }), false);
  assert.equal(browserSessionLabel(policy, runtime), 'cdp-attached-dedicated-profile');
});

test('browser agent can explicitly copy the Chrome profile once for bootstrap', () => {
  const policy = normalizeProfilePolicy({ GEMINI_BROWSER_PROFILE_POLICY: 'copy-once' });
  const runtime = normalizeBrowserRuntimeMode({ GEMINI_BROWSER_RUNTIME_MODE: 'persistent' });

  assert.equal(policy, 'copy-once');
  assert.equal(runtime, 'persistent');
  assert.equal(shouldCopyProfile({ policy, automationProfileExists: false }), true);
  assert.equal(shouldCopyProfile({ policy, automationProfileExists: true }), false);
  assert.equal(browserSessionLabel(policy, runtime), 'persistent-context-copy-once-profile');
});
