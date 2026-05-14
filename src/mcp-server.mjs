import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { formatToolPayload } from './mcp-format.mjs';

const BRIDGE_URL = process.env.GEMINI_BRIDGE_URL ?? 'http://127.0.0.1:8765';
const TOKEN = process.env.GEMINI_BRIDGE_TOKEN ?? '';

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
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, context = '', waitMs = 120000 }) => textResult(await submitTask('/ask', { prompt, context, wait: true, waitMs })),
);

server.registerTool(
  'gemini_ask',
  {
    description: 'Short alias. Ask the logged-in Gemini web page a text question. Use when the user says "用gemini问", "gemini问一下", or "ask Gemini".',
    inputSchema: z.object({
      prompt: z.string().min(1),
      context: z.string().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, context = '', waitMs = 120000 }) => textResult(await submitTask('/ask', { prompt, context, wait: true, waitMs })),
);

server.registerTool(
  'gemini_web_write_code',
  {
    description: 'Ask Gemini web to write code or a unified diff. The result is returned to Codex for review and is not applied automatically.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      context: z.string().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, context = '', waitMs = 120000 }) => textResult(await submitTask('/code', { prompt, context, wait: true, waitMs })),
);

server.registerTool(
  'gemini_code',
  {
    description: 'Short alias. Ask Gemini web to write code or a unified diff. Use when the user says "用gemini写代码" or "gemini code".',
    inputSchema: z.object({
      prompt: z.string().min(1),
      context: z.string().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, context = '', waitMs = 120000 }) => textResult(await submitTask('/code', { prompt, context, wait: true, waitMs })),
);

server.registerTool(
  'gemini_web_generate_image',
  {
    description: 'Ask Gemini web to generate an image and return extracted media URLs or saved output files.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', waitMs = 600000 }) => textResult(await submitTask('/image', { prompt, outputDir, wait: true, waitMs })),
);

server.registerTool(
  'gemini_image',
  {
    description: 'Short alias. Ask Gemini web to generate an image. Use when the user says "用gemini生图", "gemini画图", or "gemini image".',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', waitMs = 600000 }) => textResult(await submitTask('/image', { prompt, outputDir, wait: true, waitMs })),
);

server.registerTool(
  'gemini_web_generate_video',
  {
    description: 'Ask Gemini web to generate a video if the logged-in account has video generation available.',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', waitMs = 1800000 }) => textResult(await submitTask('/video', { prompt, outputDir, wait: true, waitMs })),
);

server.registerTool(
  'gemini_video',
  {
    description: 'Short alias. Ask Gemini web to generate a video if the logged-in account supports it. Use when the user says "用gemini视频", "用gemini生成视频", or "gemini video".',
    inputSchema: z.object({
      prompt: z.string().min(1),
      outputDir: z.string().optional(),
      waitMs: z.number().int().positive().max(1800000).optional(),
    }),
  },
  async ({ prompt, outputDir = '', waitMs = 1800000 }) => textResult(await submitTask('/video', { prompt, outputDir, wait: true, waitMs })),
);

const transport = new StdioServerTransport();
await server.connect(transport);

async function submitTask(path, body) {
  return bridgeJson(path, {
    method: 'POST',
    body: JSON.stringify(body),
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
  return {
    structuredContent: formatted.structured,
    content: [
      {
        type: 'text',
        text: formatted.text,
      },
    ],
  };
}
