import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { dataUrlToImageContent, formatToolPayload } from './mcp-format.mjs';
import { withWaitOptions } from './mcp-options.mjs';
import { endpointForRunType, runBodyForType, runWaitMsForType } from './mcp-run.mjs';

const BRIDGE_URL = process.env.GEMINI_BRIDGE_URL ?? 'http://127.0.0.1:8765';
const TOKEN = process.env.GEMINI_BRIDGE_TOKEN ?? '';
const DEFAULT_ACK_WAIT_MS = Number(process.env.GEMINI_BRIDGE_MCP_ACK_WAIT_MS ?? 5000);
const DEFAULT_DIRECT_WAIT = process.env.GEMINI_BRIDGE_MCP_DIRECT_WAIT !== 'false';

const server = new McpServer({
  name: 'gemini-web-bridge',
  version: '0.1.0',
});

server.registerTool(
  'gemini_run',
  {
    description: 'Unified Gemini Agent tool. Route one request to Gemini web for text, code, image, or video generation and return the final displayable result by default.',
    inputSchema: z.object({
      type: z.enum(['ask', 'text', 'chat', 'question', 'code', 'write_code', 'image', 'generate_image', 'video', 'generate_video']).default('ask'),
      prompt: z.string().min(1),
      context: z.string().optional(),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ type = 'ask', prompt, context = '', outputDir = '', wait, waitMs }) => {
    const endpoint = endpointForRunType(type);
    const body = runBodyForType({ type, prompt, context, outputDir });
    return textResult(await submitTask(endpoint, directWaitOptions(body, wait, waitMs, runWaitMsForType(type))));
  },
);

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
  async ({ prompt, context = '', wait, waitMs }) => textResult(await submitTask('/ask', directWaitOptions({ prompt, context }, wait, waitMs, 120000))),
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
  async ({ prompt, context = '', wait, waitMs }) => textResult(await submitTask('/ask', directWaitOptions({ prompt, context }, wait, waitMs, 120000))),
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
  async ({ prompt, context = '', wait, waitMs }) => textResult(await submitTask('/code', directWaitOptions({ prompt, context }, wait, waitMs, 120000))),
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
  async ({ prompt, context = '', wait, waitMs }) => textResult(await submitTask('/code', directWaitOptions({ prompt, context }, wait, waitMs, 120000))),
);

server.registerTool(
  'gemini_web_generate_image',
  {
    description: 'Ask Gemini web to generate an image and return extracted media URLs or saved output files. Defaults to waiting for the final result so Codex can display the image; pass wait=false for async submit.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', wait, waitMs }) => textResult(await submitTask('/image', directWaitOptions({ prompt, outputDir }, wait, waitMs, 600000))),
);

server.registerTool(
  'gemini_image',
  {
    description: 'Short alias. Ask Gemini web to generate an image and wait for the final result so Codex can display it. Pass wait=false to submit asynchronously and use gemini_get_task later.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', wait, waitMs }) => textResult(await submitTask('/image', directWaitOptions({ prompt, outputDir }, wait, waitMs, 600000))),
);

server.registerTool(
  'gemini_web_generate_video',
  {
    description: 'Ask Gemini web to generate a video if the logged-in account has video generation available. Defaults to waiting for the final result so Codex can display a saved video path/preview; pass wait=false for async submit.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', wait, waitMs }) => textResult(await submitTask('/video', directWaitOptions({ prompt, outputDir }, wait, waitMs, 1800000))),
);

server.registerTool(
  'gemini_video',
  {
    description: 'Short alias. Ask Gemini web to generate a video if the logged-in account supports it and wait for the final result. Pass wait=false to submit asynchronously and use gemini_get_task later.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      wait: z.boolean().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', wait, waitMs }) => textResult(await submitTask('/video', directWaitOptions({ prompt, outputDir }, wait, waitMs, 1800000))),
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

function directWaitOptions(body, wait, waitMs, terminalDefaultMs) {
  return withWaitOptions(body, {
    wait,
    waitMs,
    terminalDefaultMs,
    ackDefaultMs: DEFAULT_ACK_WAIT_MS,
    defaultWait: DEFAULT_DIRECT_WAIT,
  });
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
