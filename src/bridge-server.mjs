import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { readDataUrl } from './mcp-format.mjs';
import { defaultOutputRoot, resolveOutputPath } from './output-paths.mjs';
import { endpointType, normalizeTaskRequest, toExtensionPrompt } from './protocol.mjs';
import { createTaskStore } from './task-store.mjs';
import { httpError, readJsonBody, requireToken, sendError, sendJson } from './http-utils.mjs';

const HOST = process.env.GEMINI_BRIDGE_HOST ?? '127.0.0.1';
const PORT = Number(process.env.GEMINI_BRIDGE_PORT ?? 8765);
const TOKEN = process.env.GEMINI_BRIDGE_TOKEN ?? '';
const OUTPUT_ROOT = path.resolve(process.env.GEMINI_BRIDGE_OUTPUT_ROOT ?? defaultOutputRoot());
const EXPECTED_SCRIPT_VERSION = process.env.GEMINI_BRIDGE_SCRIPT_VERSION ?? '2026-05-18-v19';
const STALE_TASK_MS = Number(process.env.GEMINI_BRIDGE_STALE_TASK_MS ?? 45000);
const WAIT_ACK_DEFAULT_MS = Number(process.env.GEMINI_BRIDGE_WAIT_ACK_MS ?? 5000);
const WAIT_ACK_MAX_MS = Number(process.env.GEMINI_BRIDGE_WAIT_ACK_MAX_MS ?? 60000);
const WARNING_NO_ACTIVE_EXTENSION = `No active Gemini page is polling with script ${EXPECTED_SCRIPT_VERSION}. Reload the unpacked extension and refresh Gemini.`;

const store = createTaskStore();
const extensionClients = new Set();
let lastGeminiPagePollAt = null;
let lastGeminiScriptVersion = null;
let lastLegacyGeminiPagePollAt = null;
let lastIgnoredGeminiPagePollAt = null;
let lastIgnoredGeminiScriptVersion = null;
let geminiPagePollCount = 0;
let legacyGeminiPagePollCount = 0;
let ignoredGeminiPagePollCount = 0;

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {});
      return;
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, {
        ok: true,
        bridge: 'gemini-web-bridge',
        outputRoot: OUTPUT_ROOT,
        extensionClients: extensionClients.size,
        polling: true,
        expectedGeminiScriptVersion: EXPECTED_SCRIPT_VERSION,
        staleTaskMs: STALE_TASK_MS,
        geminiPagePollingActive: isGeminiPagePollingActive(),
        legacyGeminiPagePollingActive: isLegacyGeminiPagePollingActive(),
        lastGeminiScriptVersion,
        lastGeminiPagePollAt,
        lastLegacyGeminiPagePollAt,
        lastIgnoredGeminiScriptVersion,
        lastIgnoredGeminiPagePollAt,
        secondsSinceLastGeminiPagePoll: secondsSinceLastGeminiPagePoll(),
        secondsSinceLastLegacyGeminiPagePoll: secondsSinceLastLegacyGeminiPagePoll(),
        secondsSinceLastIgnoredGeminiPagePoll: secondsSinceLastIgnoredGeminiPagePoll(),
        geminiPagePollCount,
        legacyGeminiPagePollCount,
        ignoredGeminiPagePollCount,
      });
      return;
    }

    requireToken(request, TOKEN);

    if (request.method === 'POST' && url.pathname === '/tasks') {
      const body = await readJsonBody(request);
      const task = createAndBroadcastTask(body);
      sendJson(response, 202, task);
      return;
    }

    if (request.method === 'POST' && /^\/(ask|code|image|video)$/.test(url.pathname)) {
      const body = await readJsonBody(request);
      const type = endpointType(url.pathname.slice(1));
      const task = createAndBroadcastTask({ ...body, type });

      if (body.wait === true) {
        const timeoutMs = Number(body.waitMs) > 0 ? Number(body.waitMs) : defaultWaitMs(type);
        const terminal = await store.waitForTerminal(task.id, timeoutMs);
        sendJson(response, terminal.status === 'completed' ? 200 : 502, terminal);
        return;
      }

      if (body.waitForAck !== false) {
        const ackTimeoutMs = Math.min(
          WAIT_ACK_MAX_MS,
          Math.max(0, Number(body.waitAckMs) > 0 ? Number(body.waitAckMs) : WAIT_ACK_DEFAULT_MS),
        );
        const acknowledged = await store.waitForStatus(task.id, ['in_progress', 'completed', 'failed'], ackTimeoutMs)
          .catch(() => task);
        sendJson(response, 202, withActiveExtensionWarning(acknowledged));
        return;
      }

      sendJson(response, 202, withActiveExtensionWarning(task));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/tasks') {
      sendJson(response, 200, { tasks: store.listTasks() });
      return;
    }

    if ((request.method === 'GET' || request.method === 'POST') && url.pathname === '/extension/claim') {
      const body = request.method === 'POST' ? await readJsonBody(request).catch(() => ({})) : {};
      if (!isVersionedExtensionPoll(body)) {
        recordLegacyGeminiPagePoll();
        sendJson(response, 200, {
          task: null,
          ignored: true,
          error: 'Gemini Web Bridge extension script is too old. Reload the unpacked extension and refresh Gemini.',
        });
        return;
      }

      if (!isSupportedExtensionPoll(body)) {
        recordIgnoredGeminiPagePoll(body);
        sendJson(response, 200, {
          task: null,
          ignored: true,
          error: `Gemini Web Bridge extension script version mismatch. Expected ${EXPECTED_SCRIPT_VERSION}, got ${body.scriptVersion}. Reload the unpacked extension and refresh Gemini.`,
        });
        return;
      }

      recordGeminiPagePoll(body);
      const task = store.claimNextTask({ requeueStaleMs: STALE_TASK_MS });
      sendJson(response, 200, { task: task ? extensionTask(task) : null });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/extension/heartbeat') {
      const body = await readJsonBody(request).catch(() => ({}));
      if (isSupportedExtensionPoll(body)) {
        recordGeminiPagePoll(body);
        if (typeof body.taskId === 'string' && body.taskId.trim()) {
          store.touchTask(body.taskId.trim());
        }
      } else {
        recordIgnoredGeminiPagePoll(body);
      }
      sendJson(response, 200, { ok: true });
      return;
    }

    const taskMatch = url.pathname.match(/^\/tasks\/([^/]+)$/);
    if (request.method === 'GET' && taskMatch) {
      const task = store.getTask(taskMatch[1]);
      if (!task) throw httpError(404, `Unknown task id: ${taskMatch[1]}`);
      sendJson(response, 200, task);
      return;
    }

    const resultMatch = url.pathname.match(/^\/tasks\/([^/]+)\/result$/);
    if (request.method === 'POST' && resultMatch) {
      const body = await readJsonBody(request);
      const task = await completeFromPayload(resultMatch[1], body);
      sendJson(response, 200, task);
      return;
    }

    throw httpError(404, `Unknown route: ${request.method} ${url.pathname}`);
  } catch (error) {
    sendError(response, error);
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`);
    if (url.pathname !== '/extension') {
      socket.destroy();
      return;
    }

    if (TOKEN && url.searchParams.get('token') !== TOKEN) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  extensionClients.add(ws);
  ws.send(JSON.stringify({ type: 'hello', outputRoot: OUTPUT_ROOT }));

  const queued = store.claimNextTask({ requeueStaleMs: STALE_TASK_MS });
  if (queued) {
    sendTaskToExtension(ws, queued);
  }

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(String(message));
      if (payload.type === 'claim_next') {
        const task = store.claimNextTask({ requeueStaleMs: STALE_TASK_MS });
        ws.send(JSON.stringify({ type: 'task', task: task ? extensionTask(task) : null }));
        return;
      }

      if (payload.type === 'task_result') {
        const task = await completeFromPayload(payload.taskId, payload);
        ws.send(JSON.stringify({ type: 'ack', taskId: task.id, status: task.status }));
        return;
      }

      ws.send(JSON.stringify({ type: 'error', error: `Unsupported message type: ${payload.type}` }));
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });

  ws.on('close', () => {
    extensionClients.delete(ws);
  });
});

store.events.on('queued', (task) => {
  for (const ws of extensionClients) {
    if (ws.readyState === WebSocket.OPEN) {
      const claimed = store.claimNextTask({ requeueStaleMs: STALE_TASK_MS });
      if (claimed) sendTaskToExtension(ws, claimed);
      break;
    }
  }
});

await mkdir(OUTPUT_ROOT, { recursive: true });

server.listen(PORT, HOST, () => {
  console.log(`Gemini bridge server listening on http://${HOST}:${PORT}`);
  console.log(`Output root: ${OUTPUT_ROOT}`);
  if (TOKEN) {
    console.log('Bridge token: configured');
  }
});

function createAndBroadcastTask(body) {
  const request = normalizeTaskRequest(body);
  const task = store.createTask(request);
  return task;
}

function withActiveExtensionWarning(task) {
  if (task.status !== 'queued' || isGeminiPagePollingActive()) {
    return task;
  }

  return {
    ...task,
    warning: WARNING_NO_ACTIVE_EXTENSION,
  };
}

function sendTaskToExtension(ws, task) {
  ws.send(JSON.stringify({ type: 'task', task: extensionTask(task) }));
}

function extensionTask(task) {
  return {
    ...task,
    extensionPrompt: toExtensionPrompt(task),
  };
}

async function completeFromPayload(taskId, payload) {
  if (!taskId) throw httpError(400, 'taskId is required');

  if (payload.status === 'failed' || payload.error) {
    return store.failTask(taskId, payload.error ?? 'Gemini web task failed');
  }

  const result = await normalizeResultPayload(taskId, payload.result ?? payload);
  if (result.raw?.submission?.didSubmit === false && result.media.length === 0 && result.files.length === 0) {
    return store.failTask(taskId, `Composer did not submit prompt: ${JSON.stringify(result.raw.submission)}`);
  }
  return store.completeTask(taskId, result);
}

async function normalizeResultPayload(taskId, payload) {
  const result = {
    text: typeof payload.text === 'string' ? payload.text : '',
    codeBlocks: Array.isArray(payload.codeBlocks) ? payload.codeBlocks : [],
    media: Array.isArray(payload.media) ? payload.media : [],
    files: [],
    raw: payload.raw ?? null,
  };

  for (const item of result.media) {
    if (typeof item?.dataUrl === 'string') {
      const file = await saveDataUrl(taskId, item);
      result.files.push(file);
    }
  }

  return result;
}

async function saveDataUrl(taskId, item) {
  const media = readDataUrl(item.dataUrl);
  if (!media) {
    throw httpError(400, 'media dataUrl is invalid');
  }

  const mimeType = media.mimeType;
  const data = media.buffer;
  const extension = extensionForMime(mimeType);
  const relativePath = path.join(item.kind === 'video' ? 'videos' : 'images', `${taskId}-${item.index ?? 0}.${extension}`);
  const outputPath = resolveOutputPath(OUTPUT_ROOT, relativePath);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, data);

  return {
    kind: item.kind ?? 'media',
    mimeType,
    path: outputPath,
  };
}

function extensionForMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  return 'bin';
}

function defaultWaitMs(type) {
  if (type === 'video') return 30 * 60 * 1000;
  if (type === 'image') return 10 * 60 * 1000;
  return 2 * 60 * 1000;
}

function recordGeminiPagePoll(payload = {}) {
  lastGeminiPagePollAt = new Date().toISOString();
  if (typeof payload.scriptVersion === 'string' && payload.scriptVersion.trim()) {
    lastGeminiScriptVersion = payload.scriptVersion.trim();
  }
  geminiPagePollCount += 1;
}

function recordLegacyGeminiPagePoll() {
  lastLegacyGeminiPagePollAt = new Date().toISOString();
  legacyGeminiPagePollCount += 1;
}

function recordIgnoredGeminiPagePoll(payload = {}) {
  lastIgnoredGeminiPagePollAt = new Date().toISOString();
  if (typeof payload.scriptVersion === 'string' && payload.scriptVersion.trim()) {
    lastIgnoredGeminiScriptVersion = payload.scriptVersion.trim();
  }
  ignoredGeminiPagePollCount += 1;
}

function isVersionedExtensionPoll(payload) {
  return typeof payload?.scriptVersion === 'string' && payload.scriptVersion.trim().length > 0;
}

function isSupportedExtensionPoll(payload) {
  return isVersionedExtensionPoll(payload) && payload.scriptVersion.trim() === EXPECTED_SCRIPT_VERSION;
}

function isGeminiPagePollingActive() {
  const seconds = secondsSinceLastGeminiPagePoll();
  return seconds !== null && seconds <= 5;
}

function isLegacyGeminiPagePollingActive() {
  const seconds = secondsSinceLastLegacyGeminiPagePoll();
  return seconds !== null && seconds <= 5;
}

function secondsSinceLastGeminiPagePoll() {
  if (!lastGeminiPagePollAt) return null;
  return Math.round((Date.now() - Date.parse(lastGeminiPagePollAt)) / 1000);
}

function secondsSinceLastLegacyGeminiPagePoll() {
  if (!lastLegacyGeminiPagePollAt) return null;
  return Math.round((Date.now() - Date.parse(lastLegacyGeminiPagePollAt)) / 1000);
}

function secondsSinceLastIgnoredGeminiPagePoll() {
  if (!lastIgnoredGeminiPagePollAt) return null;
  return Math.round((Date.now() - Date.parse(lastIgnoredGeminiPagePollAt)) / 1000);
}
