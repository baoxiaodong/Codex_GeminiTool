import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { dataUrlToImageContent, formatToolPayload } from './mcp-format.mjs';

const BRIDGE_URL = process.env.GEMINI_BRIDGE_URL ?? 'http://127.0.0.1:8765';
const TOKEN = process.env.GEMINI_BRIDGE_TOKEN ?? '';
const DEFAULT_ACK_WAIT_MS = Number(process.env.GEMINI_BRIDGE_MCP_ACK_WAIT_MS ?? 5000);

const server = new McpServer({
  name: 'gemini-web-bridge',
  version: '0.1.0',
});

server.registerTool(
  'gemini_web_status',
  {
    description: 'Check whether the local Gemini web bridge is running and whether a Chrome extension is connected.',
    inputSchema: z.object({}),
  },
  async () => textResult(await bridgeJson('/health')),
);

server.registerTool(
  'gemini_status',
  {
    description: 'Short alias for gemini_web_status. Check the local Gemini web bridge status.',
    inputSchema: z.object({}),
  },
  async () => textResult(await bridgeJson('/health')),
);

server.registerTool(
  'gemini_web_ask',
  {
    description: 'Ask the logged-in Gemini web page a text question through the Chrome extension.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      context: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, context = '', wait = false, waitMs }) => textResult(await submitTask('/ask', withWaitOptions({ prompt, context }, wait, waitMs, 120000))),
);

server.registerTool(
  'gemini_ask',
  {
    description: 'Short alias. Ask the logged-in Gemini web page a text question. Use when the user says "用gemini问", "gemini问一下", or "ask Gemini".',
    inputSchema: z.object({
      prompt: z.string().min(1),
      context: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, context = '', wait = false, waitMs }) => textResult(await submitTask('/ask', withWaitOptions({ prompt, context }, wait, waitMs, 120000))),
);

server.registerTool(
  'gemini_web_write_code',
  {
    description: 'Ask Gemini web to write code or a unified diff. The result is returned to Codex for review and is not applied automatically.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      context: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, context = '', wait = false, waitMs }) => textResult(await submitTask('/code', withWaitOptions({ prompt, context }, wait, waitMs, 120000))),
);

server.registerTool(
  'gemini_code',
  {
    description: 'Short alias. Ask Gemini web to write code or a unified diff. Use when the user says "用gemini写代码" or "gemini code".',
    inputSchema: z.object({
      prompt: z.string().min(1),
      context: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, context = '', wait = false, waitMs }) => textResult(await submitTask('/code', withWaitOptions({ prompt, context }, wait, waitMs, 120000))),
);

server.registerTool(
  'gemini_web_generate_image',
  {
    description: 'Ask Gemini web to generate an image and return extracted media URLs or saved output files. Defaults to async submit to avoid Codex tool timeouts; pass wait=true only for short tests.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', wait = false, waitMs }) => textResult(await submitTask('/image', withWaitOptions({ prompt, outputDir }, wait, waitMs, 600000))),
);

server.registerTool(
  'gemini_image',
  {
    description: 'Short alias. Ask Gemini web to generate an image. Defaults to async submit to avoid Codex tool timeouts; use gemini_get_task to fetch the result.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', wait = false, waitMs }) => textResult(await submitTask('/image', withWaitOptions({ prompt, outputDir }, wait, waitMs, 600000))),
);

server.registerTool(
  'gemini_web_generate_video',
  {
    description: 'Ask Gemini web to generate a video if the logged-in account has video generation available. Defaults to async submit to avoid Codex tool timeouts; pass wait=true only for short tests.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', wait = false, waitMs }) => textResult(await submitTask('/video', withWaitOptions({ prompt, outputDir }, wait, waitMs, 1800000))),
);

server.registerTool(
  'gemini_video',
  {
    description: 'Short alias. Ask Gemini web to generate a video if the logged-in account supports it. Defaults to async submit to avoid Codex tool timeouts; use gemini_get_task to fetch the result.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', wait = false, waitMs }) => textResult(await submitTask('/video', withWaitOptions({ prompt, outputDir }, wait, waitMs, 1800000))),
);

server.registerTool(
  'gemini_get_task',
  {
    description: 'Fetch a Gemini bridge task by id. Use this after async image/video generation to retrieve final text, image content, media, and saved files.',
    inputSchema: z.object({
      taskId: z.string().min(1),
    }),
  },
  async ({ taskId }) => textResult(await bridgeJson(`/tasks/${encodeURIComponent(taskId)}`)),
);

server.registerTool(
  'gemini_list_tasks',
  {
    description: 'List recent Gemini bridge tasks and their statuses.',
    inputSchema: z.object({}),
  },
  async () => textResult(await bridgeJson('/tasks')),
);

const transport = new StdioServerTransport();
await server.connect(transport);

async function submitTask(path, body) {
  return bridgeJson(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function withWaitOptions(body, wait, waitMs, terminalDefaultMs) {
  if (wait) {
    return {
      ...body,
      wait: true,
      waitMs: waitMs ?? terminalDefaultMs,
    };
  }

  return {
    ...body,
    wait: false,
    waitAckMs: waitMs ?? DEFAULT_ACK_WAIT_MS,
  };
}

async function bridgeJson(path, options = {}) {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(TOKEN ? { 'x-gemini-bridge-token': TOKEN } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? `Bridge returned HTTP ${response.status}`);
  }

  return payload;
}

function textResult(payload) {
  const formatted = formatToolPayload(payload);
  const media = Array.isArray(formatted.structured.media) ? formatted.structured.media : [];
  const imageContent = media
    .map((item) => dataUrlToImageContent(item?.dataUrl))
    .filter(Boolean);

  return {
    structuredContent: formatted.structured,
    content: [
      {
        type: 'text',
        text: formatted.text,
      },
      ...imageContent,
    ],
  };
}
