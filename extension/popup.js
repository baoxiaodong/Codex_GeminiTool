const statusEl = document.querySelector('#status');
const urlEl = document.querySelector('#url');
const modeEl = document.querySelector('#mode');
const pageEl = document.querySelector('#page');
const expectedVersionEl = document.querySelector('#expected-version');
const activeVersionEl = document.querySelector('#active-version');
const ignoredVersionEl = document.querySelector('#ignored-version');
const historyEl = document.querySelector('#history');
const refreshButton = document.querySelector('#refresh');

refreshButton.addEventListener('click', refreshStatus);
refreshStatus();

async function refreshStatus() {
  urlEl.textContent = 'http://127.0.0.1:8765';
  modeEl.textContent = 'Gemini page polling';
  historyEl.innerHTML = '<div class="history-empty">Loading history…</div>';

  chrome.runtime.sendMessage({ type: 'popup_status' }, (status) => {
    statusEl.textContent = status?.connected ? 'bridge running' : 'bridge not reachable';
    statusEl.className = `value ${status?.connected ? 'ok' : 'bad'}`;
    urlEl.textContent = status?.bridgeUrl ?? 'http://127.0.0.1:8765/health';
    modeEl.textContent = status?.mode ?? 'Gemini page polling';
    const health = status?.health ?? {};
    pageEl.textContent = health.geminiPagePollingActive ? 'polling active' : 'reload extension + refresh Gemini';
    pageEl.className = `value ${health.geminiPagePollingActive ? 'ok' : 'bad'}`;
    expectedVersionEl.textContent = health.expectedGeminiScriptVersion ?? 'unknown';
    activeVersionEl.textContent = health.lastGeminiScriptVersion ?? 'none';
    activeVersionEl.className = `value ${health.geminiPagePollingActive ? 'ok' : 'bad'}`;
    ignoredVersionEl.textContent = health.lastIgnoredGeminiScriptVersion
      ? `${health.lastIgnoredGeminiScriptVersion} (${health.ignoredGeminiPagePollCount ?? 0})`
      : 'none';
    ignoredVersionEl.className = `value ${health.lastIgnoredGeminiScriptVersion ? 'bad' : 'ok'}`;
  });

  chrome.runtime.sendMessage({ type: 'popup_history' }, (payload) => {
    renderHistory(Array.isArray(payload?.tasks) ? payload.tasks : []);
  });
}

function renderHistory(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    historyEl.innerHTML = '<div class="history-empty">No task history yet.</div>';
    return;
  }

  historyEl.innerHTML = tasks.slice(0, 20).map((task) => {
    const files = Array.isArray(task.files) ? task.files : [];
    const meta = `${escapeHtml(task.type || 'task')} · ${escapeHtml(task.status || 'unknown')}`;
    const time = escapeHtml(formatTime(task.updatedAt || task.createdAt));
    const prompt = escapeHtml(task.prompt || '');
    const fileLines = files.length > 0
      ? `<div class="history-files">${files.map((file) => escapeHtml(file)).join('<br>')}</div>`
      : '';

    return `
      <div class="history-item">
        <div class="history-meta">
          <span>${meta}</span>
          <span>${time}</span>
        </div>
        <div class="history-prompt">${prompt || '(empty prompt)'}</div>
        ${fileLines}
      </div>
    `;
  }).join('');
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
