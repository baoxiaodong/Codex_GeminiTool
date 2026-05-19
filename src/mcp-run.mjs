const TYPE_ALIASES = new Map([
  ['ask', 'ask'],
  ['text', 'ask'],
  ['chat', 'ask'],
  ['question', 'ask'],
  ['code', 'code'],
  ['write_code', 'code'],
  ['image', 'image'],
  ['generate_image', 'image'],
  ['video', 'video'],
  ['generate_video', 'video'],
]);

export function normalizeRunType(type) {
  const raw = String(type ?? 'ask').trim().toLowerCase();
  const normalized = TYPE_ALIASES.get(raw);
  if (!normalized) throw new Error(`Unsupported gemini_run type: ${raw}`);
  return normalized;
}

export function endpointForRunType(type) {
  const normalized = normalizeRunType(type);
  return `/${normalized}`;
}

export function runWaitMsForType(type) {
  const normalized = normalizeRunType(type);
  if (normalized === 'video') return 1800000;
  if (normalized === 'image') return 600000;
  return 120000;
}

export function runBodyForType({ type = 'ask', prompt, context = '', outputDir = '' }) {
  const normalized = normalizeRunType(type);
  const body = { prompt };

  if (normalized === 'ask' || normalized === 'code') {
    if (context) body.context = context;
  }

  if (normalized === 'image' || normalized === 'video') {
    if (outputDir) body.outputDir = outputDir;
  }

  return body;
}
