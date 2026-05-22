import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skillPaths = [
  'F:/Codex_GeminiTool/.codex/skills/gemini-web-bridge/SKILL.md',
  'C:/Users/Administrator/.codex/skills/gemini-web-bridge/SKILL.md',
];

for (const skillPath of skillPaths) {
  test(`Gemini skill requires exact user prompt submission: ${skillPath}`, async () => {
    const source = await readFile(skillPath, 'utf8');

    assert.match(source, /MUST submit the user's Gemini prompt verbatim/);
    assert.match(source, /Do not translate/);
    assert.match(source, /Do not rewrite/);
    assert.match(source, /Do not add safety wording/);
    assert.match(source, /If the request cannot be executed, refuse or explain before calling Gemini/);
  });

  test(`Gemini skill requires full in-Codex display of Gemini output: ${skillPath}`, async () => {
    const source = await readFile(skillPath, 'utf8');

    assert.match(source, /display Gemini's final output in Codex as completely and directly as the client supports/i);
    assert.match(source, /Do not replace Gemini output with a short preview/i);
    assert.match(source, /Do not make file paths the primary display/i);
  });
}
