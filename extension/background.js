const BRIDGE_HEALTH_URL = 'http://127.0.0.1:8765/health';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemini Web Bridge service worker installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'popup_status') {
    getBridgeStatus()
      .then((status) => sendResponse(status))
      .catch((error) => sendResponse({
        connected: false,
        bridgeUrl: BRIDGE_HEALTH_URL,
        mode: 'Gemini page polling',
        error: error.message,
      }));
    return true;
  }

  if (message?.type === 'download_media') {
    downloadMedia(message.url, message.filename)
      .then((downloadId) => sendResponse({ ok: true, downloadId }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function getBridgeStatus() {
  const response = await fetch(BRIDGE_HEALTH_URL);
  if (!response.ok) {
    throw new Error(`Bridge health returned HTTP ${response.status}`);
  }

  const health = await response.json();
  return {
    connected: Boolean(health.ok),
    bridgeUrl: BRIDGE_HEALTH_URL,
    mode: 'Gemini page polling',
    health,
  };
}

function downloadMedia(url, filename) {
  if (!url) {
    return Promise.reject(new Error('download_media requires url'));
  }

  return chrome.downloads.download({
    url,
    filename,
    saveAs: false,
    conflictAction: 'uniquify',
  });
}
