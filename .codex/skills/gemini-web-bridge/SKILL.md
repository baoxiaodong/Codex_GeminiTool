---
name: gemini-web-bridge
description: Use this whenever the user says "用gemini", "用gimini", "gemini问", "gemini写代码", "gemini生图", "gemini画图", "gemini视频", "让Gemini网页版", or asks Codex to use Gemini web for text, code, image, or video generation. Prefer the unified `gemini_run` MCP tool, with specialized tools as fallback.
---

# Codex Gemini Agent

You are the Codex Gemini Agent. Use the local Gemini Web Bridge MCP tools to delegate work to the user's logged-in Gemini web page and return the result to Codex.

## Trigger Phrases

Treat these as requests to use this agent:

- `用gemini问...`
- `用gimini问...`
- `用gemini回答...`
- `用gemini写代码...`
- `用gimini写代码...`
- `用gemini生图...`
- `用gimini生图...`
- `用gemini画图...`
- `用gemini生成视频...`
- `用gimini生成视频...`
- `gemini ask/code/image/video ...`

## Primary Tool

Prefer the unified MCP tool:

- `gemini_run`

Map requests like this:

- General question or text: `type="ask"`
- Code generation, code explanation, or diff request: `type="code"`
- Image generation: `type="image"`
- Video generation: `type="video"`

Specialized tools still exist for compatibility:

- `gemini_status`
- `gemini_ask`
- `gemini_code`
- `gemini_image`
- `gemini_video`
- `gemini_get_task`
- `gemini_list_tasks`

## Workflow

1. If the user says `用gemini...` or `用gimini...`, call `gemini_run` directly.
2. Put the user's request into the `prompt` field.
3. Set `type` based on intent: `ask`, `code`, `image`, or `video`.
4. For code requests, include relevant local context in `context` when useful.
5. Let the tool use its default direct-display behavior. Do not pass `wait=false` unless the user explicitly asks for async/background submission.
6. If MCP tools are unavailable, tell the user to restart Codex or open a new Codex session so MCP config reloads.
7. Do not fall back to `npm run ask`, `npm run code`, `npm run image`, or `npm run video` unless the user explicitly asks for terminal testing.

## Runtime Requirements

The agent works only when:

- `npm run bridge` is running in the project directory.
- Chrome has the `Gemini Web Bridge` extension loaded.
- `https://gemini.google.com/app` is open and logged in.

If a request hangs, first use `gemini_status` and ask the user to confirm the Gemini tab is open.

## Display And Storage Behavior

The unified tool defaults to waiting for the final Gemini result so Codex can display text, code, saved image previews, or saved video previews in the same response.

Output files are separated by type:

- `code/` for generated code and Markdown
- `images/` for generated images
- `videos/` for generated videos
- `index.json` for recent task history and file references
