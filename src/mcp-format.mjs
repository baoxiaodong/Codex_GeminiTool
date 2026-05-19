export function formatToolPayload(payload) {
  const displayPayload = payload?.result && typeof payload.result === 'object' ? payload.result : payload;
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  const singleTask = isTaskPayload(payload) ? summarizeTask(payload) : null;
  const summary = normalizeSummary(displayPayload?.text);
  const codeBlocks = Array.isArray(displayPayload?.codeBlocks) ? displayPayload.codeBlocks.filter(Boolean) : [];
  const files = Array.isArray(displayPayload?.files) ? displayPayload.files : [];
  const media = Array.isArray(displayPayload?.media) ? displayPayload.media : [];

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
      const preview = filePreviewMarkdown(file);
      if (preview) lines.push(preview);
    }
  }

  if (media.length > 0) {
    lines.push('Media:');
    for (const item of media) {
      const parts = [
        item.kind ?? 'media',
        item.mimeType,
        item.width && item.height ? `${item.width}x${item.height}` : '',
        item.duration ? `${Math.round(item.duration)}s` : '',
        item.url,
      ].filter(Boolean);
      lines.push(`- ${parts.join(' ')}`);
      const preview = mediaPreviewMarkdown(item);
      if (preview) lines.push(preview);
    }
  }

  if (tasks.length > 0) {
    lines.push('Tasks:');
    for (const task of tasks) {
      lines.push(`- ${task.id}: ${task.type} ${task.status}${task.error ? ` (${task.error})` : ''}`);
    }
  }

  if (singleTask && !payload?.result) {
    lines.push(`Task: ${singleTask.id} ${singleTask.type} ${singleTask.status}${singleTask.error ? ` (${singleTask.error})` : ''}`);
    if (typeof payload.warning === 'string' && payload.warning.trim()) {
      lines.push(`Warning: ${payload.warning.trim()}`);
    }
    if (singleTask.status === 'queued' || singleTask.status === 'in_progress') {
      lines.push(`Use gemini_get_task with taskId "${singleTask.id}" to fetch the result later.`);
    }
  }

  if (!summary && codeBlocks.length === 0 && files.length === 0 && media.length === 0 && tasks.length === 0 && !singleTask) {
    const statusLines = summarizeObjectPayload(payload);
    lines.push(...statusLines);
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
      tasks,
      raw: displayPayload?.raw ?? null,
      task: singleTask,
    },
  };
}

export function dataUrlToImageContent(dataUrl) {
  if (typeof dataUrl !== 'string') return null;

  const match = dataUrl.match(/^data:(image\/[^;,]+)(;base64)?,(.*)$/s);
  if (!match) return null;

  if (match[2]) {
    return {
      type: 'image',
      data: match[3],
      mimeType: match[1],
    };
  }

  return {
    type: 'image',
    data: Buffer.from(decodeURIComponent(match[3]), 'utf8').toString('base64'),
    mimeType: match[1],
  };
}

export function readDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;

  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) return null;

  return {
    mimeType: match[1],
    buffer: match[2]
      ? Buffer.from(match[3], 'base64')
      : Buffer.from(decodeURIComponent(match[3]), 'utf8'),
  };
}

function filePreviewMarkdown(file) {
  const path = normalizeMarkdownPath(file?.path);
  if (!path) return '';

  if (file.kind === 'image' || String(file.mimeType || '').startsWith('image/')) {
    return `![Gemini image](${path})`;
  }

  if (file.kind === 'video' || String(file.mimeType || '').startsWith('video/')) {
    return `![Gemini video](${path})`;
  }

  return '';
}

function normalizeMarkdownPath(value) {
  if (typeof value !== 'string') return '';
  return value.replaceAll('\\', '/');
}

function mediaPreviewMarkdown(item) {
  const url = normalizePreviewUrl(item?.url);
  if (!url) return '';

  if (item.kind === 'image' || String(item.mimeType || '').startsWith('image/')) {
    return `![Gemini image](${url})`;
  }

  if (item.kind === 'video' || String(item.mimeType || '').startsWith('video/')) {
    return `![Gemini video](${url})`;
  }

  return '';
}

function normalizePreviewUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
}

function summarizeTask(payload) {
  return {
    id: payload.id ?? null,
    status: payload.status ?? null,
    type: payload.type ?? null,
    error: payload.error ?? null,
  };
}

function isTaskPayload(payload) {
  return Boolean(payload && typeof payload === 'object' && typeof payload.id === 'string' && typeof payload.status === 'string');
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
    'expectedGeminiScriptVersion',
    'staleTaskMs',
    'geminiPagePollingActive',
    'legacyGeminiPagePollingActive',
    'outputRoot',
    'lastGeminiScriptVersion',
    'lastGeminiPagePollAt',
    'lastLegacyGeminiPagePollAt',
    'lastIgnoredGeminiScriptVersion',
    'lastIgnoredGeminiPagePollAt',
    'secondsSinceLastGeminiPagePoll',
    'secondsSinceLastLegacyGeminiPagePoll',
    'secondsSinceLastIgnoredGeminiPagePoll',
    'geminiPagePollCount',
    'legacyGeminiPagePollCount',
    'ignoredGeminiPagePollCount',
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
