---
name: gemini-web-bridge
description: Use this whenever the user says "用gemini", "gemini问", "gemini写代码", "gemini生图", "gemini画图", "gemini视频", "让Gemini网页版", or asks Codex to use Gemini web for text, code, image, or video generation. Prefer the Gemini Web Bridge MCP tools instead of shell commands.
---

# Gemini Web Bridge

Use the Gemini Web Bridge MCP tools when the user wants Codex to delegate work to the logged-in Gemini web page.

## Trigger Phrases

Treat these as requests to use Gemini Web Bridge:

- `用gemini问...`
- `用gemini问：...`
- `用gemini问一下...`
- `用gemini回答...`
- `用gemini写代码...`
- `用gemini写代码：...`
- `用gemini生图...`
- `用gemini生图：...`
- `用gemini画图...`
- `用gemini生成视频...`
- `用gemini生成视频：...`
- `gemini ask/code/image/video ...`

## Tool Mapping

- General question or text: use `gemini_ask`.
- Code generation, code explanation, or diff request: use `gemini_code`.
- Image generation: use `gemini_image`.
- Video generation: use `gemini_video`.
- Status check: use `gemini_status`.

The older long names also exist for compatibility:

- `gemini_web_ask`
- `gemini_web_write_code`
- `gemini_web_generate_image`
- `gemini_web_generate_video`
- `gemini_web_status`

## Workflow

1. If the user says `用gemini...`, with or without a colon, call the matching MCP tool directly.
2. Put the user request into the tool's `prompt` field.
3. For code requests, include relevant local context in `context` when useful.
4. If the MCP tool is unavailable, tell the user to restart Codex or open a new Codex session so MCP config reloads.
5. Do not fall back to `npm run ask`, `npm run code`, `npm run image`, or `npm run video` unless the user explicitly asks for terminal testing.

## Runtime Requirements

The bridge works only when:

- `npm run bridge` is running in the project directory.
- Chrome has the `Gemini Web Bridge` extension loaded.
- `https://gemini.google.com/app` is open and logged in.

If a request hangs, first use `gemini_status` and ask the user to confirm the Gemini tab is open.
