# Gemini Web Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local bridge plus Chrome extension so Codex can ask Gemini web to answer, write code, generate images, or generate videos.

**Architecture:** Node hosts HTTP endpoints, a WebSocket queue for the Chrome extension, and an MCP stdio server for Codex. The extension connects to the bridge, injects into Gemini, submits prompts, extracts text/media, and reports results.

**Tech Stack:** Node.js ESM, `node:test`, `ws`, Chrome Manifest V3, MCP TypeScript/JavaScript SDK.

---

### Task 1: Core Protocol And Queue

**Files:**
- Create: `src/protocol.mjs`
- Create: `src/task-store.mjs`
- Create: `src/output-paths.mjs`
- Test: `tests/protocol.test.mjs`
- Test: `tests/task-store.test.mjs`
- Test: `tests/output-paths.test.mjs`

- [ ] Write failing tests for task normalization, queue transitions, and output path safety.
- [ ] Run `npm test` and confirm imports fail because modules are not implemented.
- [ ] Implement minimal modules.
- [ ] Run `npm test` and confirm these tests pass.

### Task 2: Bridge HTTP And WebSocket Server

**Files:**
- Create: `src/bridge-server.mjs`
- Modify: `src/task-store.mjs`

- [ ] Expose `GET /health`, `POST /tasks`, `GET /tasks/:id`, `GET /tasks`, and `POST /tasks/:id/result`.
- [ ] Add WebSocket extension clients that receive `task` messages and send `task_result` messages.
- [ ] Keep default output root at `Desktop/codex/gemini` unless `GEMINI_BRIDGE_OUTPUT_ROOT` is set.

### Task 3: Chrome Extension

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/background.js`
- Create: `extension/content-script.js`
- Create: `extension/popup.html`
- Create: `extension/popup.js`

- [ ] Connect extension background script to `ws://127.0.0.1:8765`.
- [ ] Forward claimed tasks to the Gemini tab content script.
- [ ] Submit prompts and extract text/media results with DOM heuristics.
- [ ] Show connection status and bridge URL in popup.

### Task 4: Codex MCP Proxy

**Files:**
- Create: `src/mcp-server.mjs`
- Modify: `package.json`

- [ ] Register `gemini_web_ask`, `gemini_web_write_code`, `gemini_web_generate_image`, `gemini_web_generate_video`, and `gemini_web_status`.
- [ ] Proxy tool calls to the bridge HTTP API and return task ids, statuses, and results.

### Task 5: Verification And Usage Docs

**Files:**
- Create: `README.md`

- [ ] Run `npm test`.
- [ ] Run `npm run bridge` long enough to verify it listens on `127.0.0.1:8765`.
- [ ] Document Chrome extension loading, bridge startup, and MCP startup.
