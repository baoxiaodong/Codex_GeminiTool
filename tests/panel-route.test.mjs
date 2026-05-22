import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('bridge exposes local panel route', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/bridge-server.mjs', 'utf8');

  assert.match(source, /url\.pathname === '\/panel'/);
  assert.match(source, /sendHtml/);
});

test('bridge exposes a history delete route for panel cleanup', async () => {
  const source = await readFile('F:/Codex_GeminiTool/src/bridge-server.mjs', 'utf8');

  assert.match(source, /request\.method === 'DELETE'/);
  assert.match(source, /deleteTaskIndexEntry/);
  assert.match(source, /url\.pathname\.match\([^)]*history/);
});

test('panel document exists and fetches history data', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /Codex Gemini Agent \| History Dashboard/);
  assert.match(source, /id="searchInput"/);
  assert.match(source, /id="filterTabs"/);
  assert.match(source, /id="historyGrid"/);
  assert.match(source, /fetch\('\/history'\)/);
  assert.match(source, /id="detailModal"/);
  assert.match(source, /openTaskDetail/);
});

test('panel detail view uses task-specific renderers', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /function buildAskDetailHtml/);
  assert.match(source, /function buildCodeDetailHtml/);
  assert.match(source, /function buildImageDetailHtml/);
  assert.match(source, /function buildVideoDetailHtml/);
});

test('panel lets users preview artifact contents inside the detail modal', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /data-preview-file/);
  assert.match(source, /function bindDetailPreviewActions/);
  assert.match(source, /async function loadArtifactPreview/);
  assert.match(source, /detail-file-content/);
});

test('panel provides copy actions with user feedback for prompt, text and code', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /id="toast"/);
  assert.match(source, /function showToast/);
  assert.match(source, /async function copyText/);
  assert.match(source, /data-copy-prompt/);
  assert.match(source, /data-copy-result/);
  assert.match(source, /data-copy-file/);
  assert.match(source, /复制结果/);
  assert.match(source, /复制全文/);
});

test('panel renders multiple images as a usable gallery with per-image actions', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /class="image-count-badge"/);
  assert.match(source, /class="detail-image-card"/);
  assert.match(source, /data-copy-path/);
  assert.match(source, /下载原图/);
  assert.match(source, /第 \$\{index \+ 1\} \/ \$\{files\.length\} 张/);
});

test('panel renders saved videos as playable previews', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /class="preview-video"/);
  assert.match(source, /<video/);
  assert.match(source, /controls/);
  assert.match(source, /toArtifactHref\(videos\[0\]\)/);
  assert.match(source, /class="detail-video"/);
});

test('panel exposes task metadata and bulk file actions in detail view', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /function metadataBlock/);
  assert.match(source, /function filesBlock/);
  assert.match(source, /data-copy-all-paths/);
  assert.match(source, /复制全部路径/);
  assert.match(source, /任务信息/);
  assert.match(source, /本地文件/);
});

test('panel can delete history records from the card or detail view', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /data-delete-task/);
  assert.match(source, /async function deleteTaskHistory/);
  assert.match(source, /fetch\(`\/history\/\$\{encodeURIComponent\(taskId\)\}`/);
});

test('panel shows loading and error states instead of silently emptying history', async () => {
  const source = await readFile('F:/Codex_GeminiTool/panel/index.html', 'utf8').catch(() => '');

  assert.match(source, /id="loadingState"/);
  assert.match(source, /id="errorState"/);
  assert.match(source, /function setLoadingState/);
  assert.match(source, /function setErrorState/);
  assert.match(source, /重新加载/);
});
