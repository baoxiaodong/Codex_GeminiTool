export function executionModeForType(type, env = process.env) {
  const normalized = String(type || '').trim().toLowerCase();

  if (normalized === 'image') {
    return normalizeMode(env.GEMINI_BRIDGE_IMAGE_MODE, 'browser');
  }

  if (normalized === 'video') {
    return normalizeMode(env.GEMINI_BRIDGE_VIDEO_MODE, 'browser');
  }

  if (normalized === 'code') {
    return normalizeMode(env.GEMINI_BRIDGE_CODE_MODE, 'browser');
  }

  return normalizeMode(env.GEMINI_BRIDGE_ASK_MODE, 'browser');
}

function normalizeMode(value, fallback) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'browser' || raw === 'extension') return raw;
  return fallback;
}
