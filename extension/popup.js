const statusEl = document.querySelector('#status');
const urlEl = document.querySelector('#url');
const modeEl = document.querySelector('#mode');
const pageEl = document.querySelector('#page');
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
    pageEl.textContent = status?.health?.geminiPagePollingActive ? 'polling active' : 'open Gemini tab';
    pageEl.className = `value ${status?.health?.geminiPagePollingActive ? 'ok' : 'bad'}`;
  });
}
