export function formatToolPayload(payload) {
  const summary = normalizeSummary(payload.text);
  const codeBlocks = Array.isArray(payload.codeBlocks) ? payload.codeBlocks.filter(Boolean) : [];
  const files = Array.isArray(payload.files) ? payload.files : [];
  const media = Array.isArray(payload.media) ? payload.media : [];

  const lines = [];
  if (summary) {
    lines.push(summary);
  }

  if (codeBlocks.length > 0) {
    for (const block of codeBlocks) {
      lines.push('```text');
      lines.push(block);
      lines.push('```');
    }
  }

  if (files.length > 0) {
    lines.push('Files:');
    for (const file of files) {
      lines.push(`- ${file.kind}: ${file.path}`);
    }
  }

  if (!summary && codeBlocks.length === 0 && files.length === 0) {
    const statusLines = summarizeObjectPayload(payload);
    lines.push(...statusLines);
  }

  if (!summary && codeBlocks.length === 0 && files.length === 0 && media.length > 0) {
    lines.push(`Media items: ${media.length}`);
  }

  if (lines.length === 0) {
    lines.push('Gemini completed the task, but returned no displayable text.');
  }

  return {
    text: lines.join('\n'),
    structured: {
      summary,
      codeBlocks,
      files,
      media,
      raw: payload.raw ?? null,
    },
  };
}

function normalizeSummary(text) {
  return typeof text === 'string' ? text.trim() : '';
}

function summarizeObjectPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }

  const preferredKeys = [
    'ok',
    'bridge',
    'polling',
    'geminiPagePollingActive',
    'outputRoot',
    'lastGeminiPagePollAt',
    'secondsSinceLastGeminiPagePoll',
    'geminiPagePollCount',
    'error',
  ];

  const lines = [];
  for (const key of preferredKeys) {
    if (key in payload) {
      lines.push(`${key}: ${formatScalar(payload[key])}`);
    }
  }

  return lines;
}

function formatScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
