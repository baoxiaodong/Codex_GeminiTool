const statusEl = document.querySelector('#status');
const urlEl = document.querySelector('#url');
const modeEl = document.querySelector('#mode');
const pageEl = document.querySelector('#page');
const expectedVersionEl = document.querySelector('#expected-version');
const activeVersionEl = document.querySelector('#active-version');
const ignoredVersionEl = document.querySelector('#ignored-version');
const refreshButton = document.querySelector('#refresh');

refreshButton.addEventListener('click', refreshStatus);
refreshStatus();

async function refreshStatus() {
  urlEl.textContent = 'http://127.0.0.1:8765';
  modeEl.textContent = 'Gemini page polling';

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
}
