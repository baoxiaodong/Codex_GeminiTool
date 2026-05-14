const TASK_TYPE_ALIASES = new Map([
  ['ask', 'ask'],
  ['chat', 'ask'],
  ['text', 'ask'],
  ['code', 'code'],
  ['write_code', 'code'],
  ['generate_code', 'code'],
  ['image', 'image'],
  ['generate_image', 'image'],
  ['video', 'video'],
  ['generate_video', 'video'],
]);

export const TASK_TYPES = Object.freeze(['ask', 'code', 'image', 'video']);

export function normalizeTaskRequest(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Task request body must be a JSON object');
  }

  const rawType = String(input.type ?? 'ask').trim();
  const type = TASK_TYPE_ALIASES.get(rawType);
  if (!type) {
    throw new Error(`Unsupported task type: ${rawType}`);
  }

  const prompt = String(input.prompt ?? '').trim();
  if (!prompt) {
    throw new Error('prompt is required');
  }

  return {
    type,
    prompt,
    context: typeof input.context === 'string' ? input.context : '',
    outputDir: typeof input.outputDir === 'string' ? input.outputDir : '',
    waitMs: normalizeWaitMs(input.waitMs),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  };
}

export function endpointType(endpointName) {
  if (endpointName === 'ask') return 'ask';
  if (endpointName === 'code') return 'code';
  if (endpointName === 'image') return 'image';
  if (endpointName === 'video') return 'video';
  throw new Error(`Unknown endpoint: ${endpointName}`);
}

export function toExtensionPrompt(task) {
  if (task.type === 'code') {
    const context = task.context ? `\n\nRelevant context:\n${task.context}` : '';
    return `${task.prompt}${context}\n\nReturn code in fenced Markdown blocks or as a unified diff when edits are requested.`;
  }

  if (task.type === 'image') {
    return `${task.prompt}\n\nGenerate an image.`;
  }

  if (task.type === 'video') {
    return `${task.prompt}\n\nGenerate a video if this Gemini web session supports video generation.`;
  }

  return task.context ? `${task.prompt}\n\nContext:\n${task.context}` : task.prompt;
}

function normalizeWaitMs(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Math.floor(number), 30 * 60 * 1000);
}
