import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveOutputPath } from './output-paths.mjs';

export async function appendTaskIndex(root, task, options = {}) {
  const maxEntries = Number(options.maxEntries ?? 500);
  const indexPath = resolveOutputPath(root, 'index.json');
  const index = await readIndexFile(indexPath);
  const entry = taskIndexEntry(root, task);

  const existing = Array.isArray(index.tasks) ? index.tasks : [];
  const withoutCurrent = existing.filter((item) => item.taskId !== entry.taskId);
  const tasks = [entry, ...withoutCurrent].slice(0, maxEntries);

  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, `${JSON.stringify({ tasks }, null, 2)}\n`, 'utf8');
  return entry;
}

export async function readTaskIndex(root) {
  const indexPath = resolveOutputPath(root, 'index.json');
  const index = await readIndexFile(indexPath);
  const tasks = Array.isArray(index.tasks) ? index.tasks : [];
  return {
    ...index,
    tasks: await Promise.all(tasks.map((task) => enrichTaskEntry(root, task))),
  };
}

export async function deleteTaskIndexEntry(root, taskId) {
  const id = typeof taskId === 'string' ? taskId.trim() : '';
  if (!id) return { deleted: false, tasks: [] };

  const indexPath = resolveOutputPath(root, 'index.json');
  const index = await readIndexFile(indexPath);
  const existing = Array.isArray(index.tasks) ? index.tasks : [];
  const tasks = existing.filter((item) => item?.taskId !== id);
  const deleted = tasks.length !== existing.length;

  if (deleted) {
    await mkdir(path.dirname(indexPath), { recursive: true });
    await writeFile(indexPath, `${JSON.stringify({ ...index, tasks }, null, 2)}\n`, 'utf8');
  }

  return { deleted, tasks };
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
    text: typeof result.text === 'string' ? result.text : '',
    createdAt: task.createdAt ?? null,
    updatedAt: task.updatedAt ?? null,
    files: files.map((file) => relativeOutputPath(root, file?.path)).filter(Boolean),
    media: media.map(mediaIndexEntry).filter(Boolean),
    error: task.error ?? null,
  };
}

async function readIndexFile(indexPath) {
  try {
    const raw = await readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
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

async function enrichTaskEntry(root, task) {
  if (!task || typeof task !== 'object') return task;
  const files = Array.isArray(task.files) ? task.files.filter(Boolean) : [];
  if (files.length > 0) return task;

  return {
    ...task,
    files: await recoverTaskFiles(root, task.taskId, task.type),
  };
}

async function recoverTaskFiles(root, taskId, type) {
  if (typeof taskId !== 'string' || !taskId.trim()) return [];

  const subdir = type === 'image'
    ? 'images'
    : type === 'video'
      ? 'videos'
      : type === 'code'
        ? 'code'
        : '';
  if (!subdir) return [];

  const folder = resolveOutputPath(root, subdir);
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(`${taskId}-`))
      .map((entry) => `${subdir}/${entry.name}`)
      .sort();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}
