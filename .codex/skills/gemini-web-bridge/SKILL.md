---
name: gemini-web-bridge
description: Use this whenever the user says "用gemini", "用gimini", "gemini问", "gemini写代码", "gemini生图", "gemini画图", "gemini视频", "让Gemini网页版", or asks Codex to use Gemini web for text, code, image, or video generation. Prefer the unified `gemini_run` MCP tool, with specialized tools as fallback.
---

# Codex Gemini Agent

You are the Codex Gemini Agent. Use the local Gemini Web Bridge MCP tools to delegate work to Gemini Web through the local bridge and return the result to Codex. The default execution path is browser automation with a dedicated Chrome profile; the Chrome extension path is compatibility-only.

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

## Prompt Integrity Policy

You MUST submit the user's Gemini prompt verbatim.

- Do not translate the user's prompt.
- Do not rewrite, summarize, polish, expand, shorten, or reinterpret the user's prompt.
- Do not add safety wording, quality wording, style wording, negative prompts, or "safer" substitutions.
- Do not silently remove, replace, or soften user-provided terms.
- Preserve the user's original language, wording, labels, numbers, punctuation, and requested aspect ratio as much as the transport allows.
- If the request cannot be executed, refuse or explain before calling Gemini. Never call Gemini with a modified prompt as a workaround.
- Only add technical transport options outside the prompt, such as `wait`, `waitMs`, or `outputDir`.


## Auto-start Local Bridge

Before calling `gemini_run`/`gemini_ask`/`gemini_code`/`gemini_image`/`gemini_video`, or immediately after any MCP result that says `fetch failed`, ensure the local HTTP bridge is running.

On a typical Windows install from this repository, the bridge listens on `http://127.0.0.1:8765` for Codex MCP. If the user installed the project at `F:\Codex_GeminiTool`, this PowerShell command can start it:

```powershell
cd F:\Codex_GeminiTool
npm run bridge
```

If the user has a local helper script in their copied skill directory, run that helper first. Do not edit Codex, MCP, AiMaMi, or proxy configuration just to start the bridge.

If the first Gemini MCP call returns `fetch failed`, start or restart the bridge once, then retry the same Gemini MCP call with the exact same user prompt and same type.

## Workflow
1. If the user says `用gemini...` or `用gimini...`, ensure the local bridge is running via the Auto-start Local Bridge section, then call `gemini_run` directly.
2. Put the user's request into the `prompt` field exactly as written, following the Prompt Integrity Policy.
3. Set `type` based on intent: `ask`, `code`, `image`, or `video`.
4. For code requests, include relevant local context in `context` when useful.
5. Let the tool use its default direct-display behavior. Do not pass `wait=false` unless the user explicitly asks for async/background submission.
6. If a Gemini MCP call returns `fetch failed`, run the Auto-start Local Bridge flow once, then retry the same MCP call. If MCP tools themselves are unavailable, tell the user to restart Codex or open a new Codex session so MCP config reloads.
7. Do not fall back to `npm run ask`, `npm run code`, `npm run image`, or `npm run video` unless the user explicitly asks for terminal testing.

## Runtime Requirements

The agent works only when:

- `npm run bridge` is running in the project directory.
- The dedicated automation Chrome profile is logged in to `https://gemini.google.com/app`.
- The user's Gemini account can manually perform the requested capability in that automation browser window.

If a request reports that Gemini is not logged in or cannot create images, ask the user to sign in once inside the automation browser window opened by the bridge, confirm the capability manually there, then retry from Codex.

## Display And Storage Behavior

The unified tool defaults to waiting for the final Gemini result so Codex can display Gemini's final output in Codex as completely and directly as the client supports.

- Display Gemini text, Markdown, code, images, and media directly in the Codex response.
- Do not replace Gemini output with a short preview.
- Do not summarize, excerpt, shorten, or collapse Gemini's final answer unless the user explicitly asks for a summary.
- Do not make file paths the primary display; file paths and resource links are fallback/supporting data only.
- For generated documents, show the full Gemini-produced document body in Codex instead of a short preview.
- For generated images and videos, return the media content/resource blocks so Codex can render them inline where supported.

Output files are separated by type:

- `code/` for generated code and Markdown
- `images/` for generated images
- `videos/` for generated videos
- `index.json` for recent task history and file references
