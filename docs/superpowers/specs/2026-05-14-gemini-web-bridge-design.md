# Gemini Web Bridge Design

## Goal

Let Codex send commands to the logged-in Gemini web app through a local bridge and Chrome extension, then receive text, code, image, or video outputs back as local files or structured task results.

## Architecture

The system has three boundaries:

- Codex talks only to a local MCP server or HTTP endpoint.
- The local bridge owns task queueing, result storage, and WebSocket communication.
- The Chrome extension owns Gemini page automation through a content script.

## Task Types

- `ask`: general Gemini text interaction.
- `code`: asks Gemini for code or a unified diff.
- `image`: asks Gemini to generate an image, then captures a download URL or page media.
- `video`: asks Gemini to generate video, then waits longer and captures a downloaded media file.

## Reliability Rules

- The bridge listens on `127.0.0.1` only.
- Tasks use ids and explicit statuses: `queued`, `in_progress`, `completed`, `failed`.
- The extension can reconnect and claim the next queued task.
- File writes stay inside the configured output root.
- Code output is returned to Codex for review rather than directly modifying a repository.

## First Version

The first version implements a working bridge, MCP proxy, Chrome extension manifest, background script, and Gemini content script with conservative DOM heuristics. Gemini page changes may require selector updates.
