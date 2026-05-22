import path from 'node:path';
import { readFile as readFileFromDisk } from 'node:fs/promises';

const DEFAULT_MAX_EMBEDDED_FILE_BYTES = 15 * 1024 * 1024;

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

export async function filesToContentBlocks(files, options = {}) {
  if (!Array.isArray(files)) return [];

  const blocks = [];
  for (const file of files) {
    blocks.push(...await fileToContentBlocks(file, options));
  }
  return blocks;
}

export async function fileToContentBlocks(file, options = {}) {
  const filePath = typeof file?.path === 'string' ? file.path.trim() : '';
  if (!filePath) return [];

  const mimeType = typeof file.mimeType === 'string' && file.mimeType.trim()
    ? file.mimeType.trim()
    : mimeTypeForFilePath(filePath);
  const content = [];

  if (isImageFile(file, mimeType)) {
    const readFile = options.readFile ?? readFileFromDisk;
    try {
      const data = await readFile(filePath);
      content.push({
        type: 'image',
        data: Buffer.from(data).toString('base64'),
        mimeType,
      });
    } catch {
      // Keep the resource link below even when the image bytes are unavailable.
    }
  }

  if (isEmbeddedMediaFile(file, mimeType)) {
    const embedded = await fileToEmbeddedResource(filePath, mimeType, options);
    if (embedded) content.push(embedded);
  }

  const resourceLink = fileToResourceLink(filePath, mimeType);
  if (resourceLink) content.push(resourceLink);

  return content;
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

async function fileToEmbeddedResource(filePath, mimeType, options = {}) {
  const readFile = options.readFile ?? readFileFromDisk;
  const maxBytes = Number.isFinite(options.maxEmbeddedBytes)
    ? options.maxEmbeddedBytes
    : DEFAULT_MAX_EMBEDDED_FILE_BYTES;

  try {
    const data = Buffer.from(await readFile(filePath));
    if (maxBytes >= 0 && data.byteLength > maxBytes) return null;
    return {
      type: 'resource',
      resource: {
        uri: filePathToUri(filePath),
        mimeType,
        blob: data.toString('base64'),
      },
    };
  } catch {
    return null;
  }
}

function fileToResourceLink(filePath, mimeType) {
  const uri = filePathToUri(filePath);
  if (!uri) return null;

  return {
    type: 'resource_link',
    uri,
    name: path.basename(filePath),
    ...(mimeType ? { mimeType } : {}),
  };
}

function filePathToUri(filePath) {
  const normalized = normalizeMarkdownPath(filePath).trim();
  if (!normalized) return '';

  if (/^[a-z]+:\/\//i.test(normalized)) return normalized;

  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized).replaceAll('%5C', '/')}`;
  }

  if (normalized.startsWith('/')) {
    return `file://${encodeURI(normalized)}`;
  }

  return '';
}

function isImageFile(file, mimeType) {
  return file?.kind === 'image' || String(mimeType || '').startsWith('image/');
}

function isEmbeddedMediaFile(file, mimeType) {
  return file?.kind === 'video'
    || file?.kind === 'audio'
    || String(mimeType || '').startsWith('video/')
    || String(mimeType || '').startsWith('audio/');
}

function mimeTypeForFilePath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.webm') return 'video/webm';
  if (extension === '.mov') return 'video/quicktime';
  if (extension === '.md') return 'text/markdown';
  if (extension === '.txt') return 'text/plain';
  return '';
}

function normalizeMarkdownPath(value) {
  if (typeof value !== 'string') return '';
  return value.replaceAll('\\', '/');
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
    'executionModes',
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
