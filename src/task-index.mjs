import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveOutputPath } from './output-paths.mjs';

export async function appendTaskIndex(root, task, options = {}) {
  const maxEntries = Number(options.maxEntries ?? 500);
  const indexPath = resolveOutputPath(root, 'index.json');
  const index = await readIndex(indexPath);
  const entry = taskIndexEntry(root, task);

  const existing = Array.isArray(index.tasks) ? index.tasks : [];
  const withoutCurrent = existing.filter((item) => item.taskId !== entry.taskId);
  const tasks = [entry, ...withoutCurrent].slice(0, maxEntries);

  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, `${JSON.stringify({ tasks }, null, 2)}\n`, 'utf8');
  return entry;
}

function taskIndexEntry(root, task) {
  const result = task?.result && typeof task.result === 'object' ? task.result : {};
  const files = Array.isArray(result.files) ? result.files : [];
  const media = Array.isArray(result.media) ? result.media : [];

  return {
    taskId: task.id,
    type: task.type,
    status: task.status,
    prompt: task.prompt ?? '',
    createdAt: task.createdAt ?? null,
    updatedAt: task.updatedAt ?? null,
    files: files.map((file) => relativeOutputPath(root, file?.path)).filter(Boolean),
    media: media.map(mediaIndexEntry).filter(Boolean),
    error: task.error ?? null,
  };
}

async function readIndex(indexPath) {
  try {
    const raw = await readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { tasks: [] };
  } catch (error) {
    if (error?.code === 'ENOENT') return { tasks: [] };
    throw error;
  }
}

function relativeOutputPath(root, value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const relative = path.relative(path.resolve(root), path.resolve(value));
  if (relative.startsWith('..') || path.isAbsolute(relative)) return value;
  return relative.replaceAll(path.sep, '/');
}

function mediaIndexEntry(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    kind: item.kind ?? 'media',
    url: typeof item.url === 'string' ? item.url : '',
    mimeType: typeof item.mimeType === 'string' ? item.mimeType : '',
    width: Number.isFinite(item.width) ? item.width : null,
    height: Number.isFinite(item.height) ? item.height : null,
    duration: Number.isFinite(item.duration) ? item.duration : null,
  };
}
