const TASK_TIMEOUTS = {
  ask: 120000,
  code: 120000,
  image: 600000,
  video: 1800000,
};

const BRIDGE_SCRIPT_VERSION = '2026-05-18-v19';
const BRIDGE_ORIGIN = 'http://127.0.0.1:8765';
const RESULT_POLL_INTERVAL_MS = 2500;
const RESULT_IDLE_ROUNDS = 2;
let polling = false;

window.__geminiWebBridge = {
  version: BRIDGE_SCRIPT_VERSION,
  lastPromptTarget: null,
  lastPromptError: null,
};

document.documentElement.setAttribute('data-gemini-web-bridge-version', BRIDGE_SCRIPT_VERSION);

startPollingBridge();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'run_gemini_task') return false;

  runGeminiTask(message.task)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

function startPollingBridge() {
  if (polling) return;
  polling = true;
  pollBridge();
}

async function pollBridge() {
  while (polling) {
    try {
      const response = await fetch(`${BRIDGE_ORIGIN}/extension/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scriptVersion: BRIDGE_SCRIPT_VERSION }),
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload.ignored) {
          polling = false;
          window.__geminiWebBridge.pollingStoppedReason = payload.error || 'This Gemini Web Bridge script version is not accepted by the bridge.';
          document.documentElement.setAttribute('data-gemini-web-bridge-polling-stopped', window.__geminiWebBridge.pollingStoppedReason);
          return;
        }
        if (payload.task) {
          await runAndReportTask(payload.task);
        }
      }
    } catch {
      // The local bridge may not be running yet. Keep Gemini ready quietly.
    }

    await sleep(1500);
  }
}

async function runAndReportTask(task) {
  const stopHeartbeat = startTaskHeartbeat(task.id);
  try {
    await runGeminiTask(task);
    await reportTaskResultWhenReady(task);
    } catch (error) {
    await reportTaskResult(task.id, { status: 'failed', error: error.message }).catch(() => {});
  } finally {
    stopHeartbeat();
  }
}

function startTaskHeartbeat(taskId = '') {
  let stopped = false;
  const beat = async () => {
    if (stopped) return;
    try {
      await fetch(`${BRIDGE_ORIGIN}/extension/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scriptVersion: BRIDGE_SCRIPT_VERSION, taskId }),
      });
    } catch {
      // Keep long-running Gemini tasks quiet if the local bridge is restarted.
    }
  };

  beat();
  const timer = setInterval(beat, 1500);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function reportTaskResult(taskId, payload) {
  const response = await fetch(`${BRIDGE_ORIGIN}/tasks/${encodeURIComponent(taskId)}/result`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Bridge rejected task result (${response.status}): ${text}`);
  }
}

async function runGeminiTask(task) {
  const prompt = task.extensionPrompt || task.prompt;
  const beforeSignature = latestResponseSignature(task.type);
  const beforeMediaKeys = collectMediaKeys(document.body);
  const submission = await submitPrompt(prompt, task.type);

  window.__geminiWebBridge.currentTask = {
    id: task.id,
    type: task.type,
    beforeSignature,
    beforeMediaKeys: Array.from(beforeMediaKeys),
    submission,
    submittedAt: Date.now(),
  };

  return {
    submission,
    beforeSignature,
    beforeMediaKeys,
  };
}

async function submitPrompt(prompt, type = 'ask') {
  const input = await waitForElement(findPromptInput, 30000, 'Could not find Gemini prompt input');
  const inputInfo = describeInput(input);
  window.__geminiWebBridge.lastPromptTarget = inputInfo;
  window.__geminiWebBridge.lastPromptError = null;
  document.documentElement.setAttribute('data-gemini-web-bridge-target', JSON.stringify(inputInfo));

  const domSubmission = await submitPromptWithDom(prompt, input, type).catch(() => null);
  let submission = domSubmission;

  if ((type === 'image' || type === 'video') && !submission?.didSubmit) {
    submission = {
      didSubmit: true,
      method: 'dom_forced_optimistic',
      buttonInfo: domSubmission?.buttonInfo ?? null,
      inserted: Boolean(domSubmission?.inserted),
      fallbackError: 'Skipped debugger fallback for media task',
    };
  }

  if (!submission?.didSubmit) {
    submission = await submitPromptInPageWithDebugger(prompt).catch((error) => {
      if (domSubmission?.inserted) {
        return {
          ...domSubmission,
          didSubmit: true,
          method: `${domSubmission.method || 'dom'}_optimistic_after_debugger_error`,
          fallbackError: error.message,
        };
      }
      throw error;
    });
  }

  return {
    scriptVersion: BRIDGE_SCRIPT_VERSION,
    inputInfo,
    buttonInfo: submission?.buttonInfo ?? null,
    submittedAt: new Date().toISOString(),
    beforeIdle: true,
    didSubmit: Boolean(submission?.didSubmit),
    debuggerSubmission: submission,
  };
}

async function submitPromptWithDom(prompt, input, type = 'ask') {
  await setPromptText(input, prompt, type);
  await sleep(300);

  const button = findSendButton(input);
  if (button) {
    performTrustedClick(button);
    await sleep(1000);
    if (!composerStillLooksIdle(input) || generationStillRunning()) {
      return {
        didSubmit: true,
        method: 'dom_click',
        buttonInfo: describeButton(button),
        inserted: true,
      };
    }
  }

  dispatchEnterSubmission(input);
  await sleep(1000);
  if (!composerStillLooksIdle(input) || generationStillRunning()) {
    return {
      didSubmit: true,
      method: 'dom_enter',
      buttonInfo: button ? describeButton(button) : null,
      inserted: true,
    };
  }

  dispatchCtrlEnterSubmission(input);
  await sleep(1000);
  if (!composerStillLooksIdle(input) || generationStillRunning()) {
    return {
      didSubmit: true,
      method: 'dom_ctrl_enter',
      buttonInfo: button ? describeButton(button) : null,
      inserted: true,
    };
  }

  return {
    didSubmit: type === 'image' || type === 'video',
    method: 'dom_unconfirmed',
    buttonInfo: button ? describeButton(button) : null,
    inserted: true,
  };
}

async function submitPromptInPageWithDebugger(prompt) {
  const response = await sendRuntimeMessage({
    type: 'debugger_submit_prompt',
    text: prompt,
  });

  if (!response?.ok) {
    throw new Error(response?.error || 'debugger_submit_prompt failed');
  }

  return response.result;
}

async function setPromptText(input, prompt, type = 'ask') {
  if ('value' in input && input.tagName === 'TEXTAREA') {
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (input.isContentEditable) {
    if (trySetWithQuill(input, prompt)) {
      dispatchRichInputEvents(input, prompt);
      return;
    }
    if (type !== 'image' && type !== 'video' && await tryInsertTextWithDebugger(input, prompt)) {
      dispatchRichInputEvents(input, prompt);
      return;
    }
    replaceContentEditableText(input, prompt);
    dispatchRichInputEvents(input, prompt);
    return;
  }

  input.textContent = prompt;
  dispatchRichInputEvents(input, prompt);
}

async function tryInsertTextWithDebugger(input, prompt) {
  input.focus();
  selectEditableContents(input);

  return await sendRuntimeMessage({
    type: 'debugger_insert_text',
    text: prompt,
  }).then(async (response) => {
    if (!response?.ok) return false;
    await sleep(250);
    return normalizeText(input.innerText || input.textContent || '').includes(prompt.slice(0, 20));
  }).catch(() => false);
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function selectEditableContents(input) {
  const selection = window.getSelection();
  if (!selection) return false;
  const range = document.createRange();
  range.selectNodeContents(input);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function findPromptInput() {
  return document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"][aria-label*="Gemini"]')
    || document.querySelector('div[contenteditable="true"][role="textbox"][aria-label*="Gemini"]')
    || document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"]')
    || document.querySelector('div[contenteditable="true"][role="textbox"]')
    || document.querySelector('rich-textarea div[contenteditable="true"]')
    || document.querySelector('textarea')
    || document.querySelector('[aria-label*="Enter a prompt" i]')
    || document.querySelector('[aria-label*="prompt" i]');
}

function findSendButton(input) {
  const candidates = visibleEnabledButtons();
  const labelled = candidates.find((button) => {
    const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase();
    return (
      label.includes('send')
      || label.includes('submit')
      || label.includes('send message')
      || label.includes('send prompt')
      || label.includes('发送')
      || label.includes('提交')
      || label.includes('发送消息')
      || label.includes('发送提示')
      || label.includes('arrow_forward')
    );
  });

  if (labelled) return labelled;

  const inputBox = input.getBoundingClientRect();
  const composerButtons = candidates
    .filter((button) => {
      const text = normalizeText(button.innerText || button.textContent || '').toLowerCase();
      const aria = (button.getAttribute('aria-label') || '').toLowerCase();
      const title = (button.getAttribute('title') || '').toLowerCase();
      const label = `${text} ${aria} ${title}`;
      if (
        text === '+'
        || label.includes('tool')
        || label.includes('pro')
        || label.includes('mic')
        || label.includes('microphone')
        || label.includes('voice')
        || label.includes('dictation')
        || label.includes('麦克风')
        || label.includes('语音')
        || label.includes('听写')
        || label.includes('上传')
        || label.includes('upload')
        || label.includes('mode')
        || label.includes('模式')
        || label.includes('快速')
        || label.includes('选择器')
        || label.includes('selector')
        || label.includes('input-area-switch')
        || label.includes('mat-mdc-menu-trigger')
      ) return false;

      const box = button.getBoundingClientRect();
      const nearInput = box.top >= inputBox.top - 80 && box.bottom <= inputBox.bottom + 120;
      const toRight = box.left > inputBox.left + inputBox.width * 0.5;
      return nearInput && toRight;
    })
    .sort((a, b) => sendButtonScore(b, inputBox) - sendButtonScore(a, inputBox));

  return composerButtons[0] || null;
}

function sendButtonScore(button, inputBox) {
  const box = button.getBoundingClientRect();
  const text = normalizeText(button.innerText || button.textContent || '').toLowerCase();
  const aria = (button.getAttribute('aria-label') || '').toLowerCase();
  const title = (button.getAttribute('title') || '').toLowerCase();
  const html = button.outerHTML.toLowerCase();
  const label = `${text} ${aria} ${title} ${html}`;
  let score = 0;

  if (label.includes('send') || label.includes('submit') || label.includes('发送') || label.includes('提交')) score += 1000;
  if (label.includes('arrow_forward') || label.includes('send-button') || label.includes('send_button')) score += 500;
  if (label.includes('mat-icon') && (label.includes('send') || label.includes('arrow'))) score += 200;
  score += Math.max(0, 200 - Math.abs((box.top + box.bottom) / 2 - (inputBox.top + inputBox.bottom) / 2));
  score += box.left - inputBox.left;

  return score;
}

function visibleEnabledButtons() {
  return Array.from(document.querySelectorAll('button'))
    .filter((button) => {
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
      const box = button.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
}

async function waitForNewResponse(beforeSignature, timeoutMs) {
  await waitUntil(() => {
    const signature = latestResponseSignature();
    return signature && signature !== beforeSignature;
  }, timeoutMs, 'Timed out waiting for Gemini response');
}

async function reportTaskResultWhenReady(task) {
  const state = window.__geminiWebBridge.currentTask;
  const type = task.type;
  const timeoutMs = TASK_TIMEOUTS[type] ?? TASK_TIMEOUTS.ask;
  const started = Date.now();
  const beforeSignature = state?.beforeSignature ?? '';
  const beforeMediaKeys = new Set(state?.beforeMediaKeys ?? []);
  const submission = state?.submission ?? {};
  let lastSignature = latestResponseSignature(type);
  let idleRounds = 0;

  while (Date.now() - started < timeoutMs) {
    await sleep(RESULT_POLL_INTERVAL_MS);

    const response = latestResponseElement(type, beforeMediaKeys) || document.body;
    const signature = latestResponseSignature(type);
    const hasNewResponse = signature && signature !== beforeSignature;
    const hasMedia = hasExpectedMedia(response, type, beforeMediaKeys) || hasExpectedMedia(document.body, type, beforeMediaKeys);
    const hasStableText = hasNewResponse && idleRounds >= RESULT_IDLE_ROUNDS && hasResultReady(type, response, beforeSignature, beforeMediaKeys);

    if (signature === lastSignature) {
      idleRounds += 1;
    } else {
      idleRounds = 0;
      lastSignature = signature;
    }

    if ((hasMedia || hasStableText) && !generationStillRunning()) {
      const result = await extractResult(type, submission, beforeMediaKeys);
      await reportTaskResult(task.id, { status: 'completed', result });
      return;
    }
  }

  const result = await extractResult(type, submission, beforeMediaKeys);
  if (result.text || result.codeBlocks.length > 0 || result.media.length > 0) {
    await reportTaskResult(task.id, { status: 'completed', result });
    return;
  }

  await reportTaskResult(task.id, { status: 'failed', error: `Timed out waiting for Gemini ${type} result` });
}

function hasResultReady(type, response, beforeSignature, ignoredMediaKeys = new Set()) {
  if (type === 'image' || type === 'video') {
    return hasExpectedMedia(response, type, ignoredMediaKeys) || hasExpectedMedia(document.body, type, ignoredMediaKeys);
  }

  const signature = latestResponseSignature(type);
  if (!signature || signature === beforeSignature) return false;
  const text = normalizeText(response?.innerText || response?.textContent || '');
  if (type === 'code') {
    return text.length > 40 || Boolean(response?.querySelector?.('pre, code-block, .code-block'));
  }

  return text.length > 0;
}

function generationStillRunning() {
  const labels = Array.from(document.querySelectorAll('button, [aria-label], mat-icon'))
    .map((element) => `${element.getAttribute?.('aria-label') || ''} ${element.textContent || ''}`.toLowerCase())
    .join(' ');

  return labels.includes('stop')
    || labels.includes('停止')
    || labels.includes('cancel')
    || labels.includes('取消');
}

async function extractResult(type, submission, ignoredMediaKeys = new Set()) {
  const response = latestResponseElement(type, ignoredMediaKeys) || document.body;
  const text = normalizeText(response.innerText || '');
  const codeBlocks = Array.from(response.querySelectorAll('pre, code-block, .code-block'))
    .map((element) => normalizeText(element.innerText || element.textContent || ''))
    .filter(Boolean);

  const media = await extractMedia(response, type, ignoredMediaKeys);

  return {
    text,
    codeBlocks,
    media,
    raw: {
      url: location.href,
      capturedAt: new Date().toISOString(),
      submission,
    },
  };
}

async function waitForExpectedMedia(type, timeoutMs, ignoredMediaKeys = new Set()) {
  if (type !== 'image' && type !== 'video') return;

  await waitUntil(() => {
    const response = latestResponseElement(type, ignoredMediaKeys) || document.body;
    return hasExpectedMedia(response, type, ignoredMediaKeys) || hasExpectedMedia(document.body, type, ignoredMediaKeys);
  }, timeoutMs, `Timed out waiting for Gemini ${type} output`);
}

function hasExpectedMedia(root, type, ignoredMediaKeys = new Set()) {
  if (type === 'image') {
    return Array.from(root.querySelectorAll('img')).some((img) => isGeneratedImage(img) && !ignoredMediaKeys.has(mediaElementKey(img)));
  }

  if (type === 'video') {
    return Array.from(root.querySelectorAll('video')).some((video) => {
      const box = video.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && Boolean(video.currentSrc || video.src) && !ignoredMediaKeys.has(mediaElementKey(video));
    });
  }

  return false;
}

async function extractMedia(root, type, ignoredMediaKeys = new Set()) {
  const items = [];
  const mediaRoot = hasExpectedMedia(root, type, ignoredMediaKeys) ? root : document.body;
  const images = Array.from(mediaRoot.querySelectorAll('img'))
    .filter((img) => isGeneratedImage(img) && !ignoredMediaKeys.has(mediaElementKey(img)));

  for (const [index, img] of images.entries()) {
    const url = img.currentSrc || img.src;
    const item = {
      kind: 'image',
      index,
      url,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };

    const dataUrl = await imageElementToDataUrl(img);
    if (dataUrl) {
      item.dataUrl = dataUrl;
    }

    items.push(item);
  }

  const videos = Array.from(mediaRoot.querySelectorAll('video'))
    .filter((video) => !ignoredMediaKeys.has(mediaElementKey(video)));

  for (const [index, video] of videos.entries()) {
    const url = mediaElementUrl(video);
    const item = {
      kind: 'video',
      index,
      url,
      width: video.videoWidth || Math.round(video.getBoundingClientRect().width),
      height: video.videoHeight || Math.round(video.getBoundingClientRect().height),
      duration: Number.isFinite(video.duration) ? video.duration : null,
    };

    const dataUrl = await mediaUrlToDataUrl(url);
    if (dataUrl) {
      item.dataUrl = dataUrl;
    }

    items.push(item);
  }

  if (type === 'image' || type === 'video') {
    queueBrowserDownloads(items);
  }

  return items;
}

function collectMediaKeys(root) {
  return new Set(Array.from(root.querySelectorAll('img, video')).map(mediaElementKey).filter(Boolean));
}

function mediaElementKey(element) {
  const box = element.getBoundingClientRect();
  return [
    element.tagName,
    mediaElementUrl(element),
    Math.round(element.naturalWidth || element.videoWidth || box.width || 0),
    Math.round(element.naturalHeight || element.videoHeight || box.height || 0),
  ].join(':');
}

function mediaElementUrl(element) {
  return element.currentSrc
    || element.src
    || element.querySelector?.('source[src]')?.src
    || '';
}

function isGeneratedImage(img) {
  const box = img.getBoundingClientRect();
  const width = img.naturalWidth || box.width;
  const height = img.naturalHeight || box.height;
  return width > 128 && height > 128 && box.width > 0 && box.height > 0;
}

async function imageElementToDataUrl(img) {
  const url = img.currentSrc || img.src;
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  return await mediaUrlToDataUrl(url) || drawImageToDataUrl(img);
}

async function mediaUrlToDataUrl(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:') && typeof fetch !== 'undefined') {
    const fetchedBlob = await fetchMediaAsDataUrl(url);
    if (fetchedBlob) return fetchedBlob;
  }

  const fetched = await fetchMediaAsDataUrl(url);
  if (fetched) return fetched;

  const backgroundFetched = await fetchMediaViaBackground(url);
  if (backgroundFetched) return backgroundFetched;

  return null;
}

async function fetchMediaAsDataUrl(url) {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function fetchMediaViaBackground(url) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'fetch_media_data_url', url }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response?.ok && typeof response.dataUrl === 'string' ? response.dataUrl : null);
      });
    } catch {
      resolve(null);
    }
  });
}

function drawImageToDataUrl(img) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read media blob'));
    reader.readAsDataURL(blob);
  });
}

function queueBrowserDownloads(items) {
  for (const item of items) {
    if (!item.url || item.url.startsWith('blob:')) continue;
    const extension = item.kind === 'video' ? 'mp4' : 'png';
    chrome.runtime.sendMessage({
      type: 'download_media',
      url: item.url,
      filename: `gemini-web-bridge/${item.kind}-${Date.now()}-${item.index}.${extension}`,
    });
  }
}

function latestResponseElement(type = 'ask', ignoredMediaKeys = new Set()) {
  const selectors = [
    'message-content',
    '[data-response-index]',
    '.model-response-text',
    'div[class*="response"]',
    'main article',
  ];

  const elements = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const visible = elements.filter((element) => {
    const text = normalizeText(element.innerText || element.textContent || '');
    return text.length > 0 || hasExpectedMedia(element, type, ignoredMediaKeys);
  });
  return visible.at(-1) ?? null;
}

function latestResponseSignature(type = 'ask') {
  const element = latestResponseElement(type) || latestResponseElement('image') || latestResponseElement('video') || latestResponseElement();
  if (!element) return '';

  const text = normalizeText(element.innerText || element.textContent || '').slice(-500);
  const media = Array.from(element.querySelectorAll('img, video'))
    .map(mediaElementKey)
    .join('|');
  const running = generationStillRunning() ? 'running' : 'idle';

  return `${text}\n${media}\n${running}`;
}

function waitForElement(find, timeoutMs, message) {
  return waitUntil(find, timeoutMs, message);
}

function waitUntil(predicate, timeoutMs, message) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const value = predicate();
      if (value) {
        resolve(value);
        return;
      }

      if (Date.now() - started > timeoutMs) {
        reject(new Error(message));
        return;
      }

      setTimeout(tick, 300);
    };

    tick();
  });
}

function normalizeText(text) {
  return text.replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim();
}

function trySetWithQuill(input, prompt) {
  const quillCandidates = [
    input.__quill,
    input.parentElement?.__quill,
    input.closest('.ql-container')?.__quill,
    input.closest('.ql-editor')?.__quill,
  ].filter(Boolean);

  const quill = quillCandidates.find((candidate) => typeof candidate?.setText === 'function');
  if (!quill) {
    return false;
  }

  quill.setText(prompt, 'user');
  if (typeof quill.setSelection === 'function') {
    const end = typeof quill.getLength === 'function' ? Math.max(0, quill.getLength() - 1) : prompt.length;
    quill.setSelection(end, 0, 'silent');
  }
  return true;
}

function replaceContentEditableText(input, prompt) {
  input.focus();

  input.classList.remove('ql-blank');

  if (!selectEditableContents(input)) {
    window.__geminiWebBridge.lastPromptError = 'window.getSelection() is unavailable';
    document.documentElement.setAttribute('data-gemini-web-bridge-error', 'window.getSelection() is unavailable');
    replaceDomText(input, prompt);
    return;
  }

  const selected = document.execCommand('selectAll', false);
  const inserted = selected && (
    document.execCommand('insertText', false, prompt)
    || document.execCommand('insertHTML', false, `<p>${escapeHtml(prompt)}</p>`)
  );
  if (inserted) {
    return;
  }

  replaceDomText(input, prompt);
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function replaceDomText(input, prompt) {
  input.replaceChildren();
  const paragraph = document.createElement('p');
  paragraph.textContent = prompt;
  input.appendChild(paragraph);
}

function dispatchRichInputEvents(input, prompt) {
  input.dispatchEvent(new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: prompt,
  }));
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: prompt,
  }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true, key: 'Process' }));
  input.classList.remove('ql-blank');
}

function performTrustedClick(button) {
  const eventOptions = { bubbles: true, cancelable: true, composed: true };
  button.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
  button.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  button.dispatchEvent(new PointerEvent('pointerup', eventOptions));
  button.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  button.dispatchEvent(new MouseEvent('click', eventOptions));
}

function dispatchEnterSubmission(input) {
  input.focus();
  const keyboardOptions = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  };

  input.dispatchEvent(new KeyboardEvent('keydown', keyboardOptions));
  input.dispatchEvent(new KeyboardEvent('keypress', keyboardOptions));
  input.dispatchEvent(new KeyboardEvent('keyup', keyboardOptions));
}

function dispatchCtrlEnterSubmission(input) {
  input.focus();
  const keyboardOptions = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    ctrlKey: true,
    metaKey: true,
    bubbles: true,
    cancelable: true,
  };

  input.dispatchEvent(new KeyboardEvent('keydown', keyboardOptions));
  input.dispatchEvent(new KeyboardEvent('keypress', keyboardOptions));
  input.dispatchEvent(new KeyboardEvent('keyup', keyboardOptions));
}

function composerStillLooksIdle(input) {
  const button = findSendButton(input);
  if (!button) return true;

  const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase();
  const looksLikeStop = label.includes('stop')
    || label.includes('cancel')
    || label.includes('停止')
    || label.includes('取消');
  return !looksLikeStop;
}

function describeButton(button) {
  const box = button.getBoundingClientRect();
  return {
    text: normalizeText(button.innerText || button.textContent || ''),
    ariaLabel: button.getAttribute('aria-label') || '',
    className: String(button.className || ''),
    rect: {
      left: Math.round(box.left),
      top: Math.round(box.top),
      width: Math.round(box.width),
      height: Math.round(box.height),
    },
  };
}

function describeInput(input) {
  const box = input.getBoundingClientRect();
  return {
    tagName: input.tagName,
    role: input.getAttribute('role') || '',
    ariaLabel: input.getAttribute('aria-label') || '',
    className: String(input.className || ''),
    isContentEditable: Boolean(input.isContentEditable),
    rect: {
      left: Math.round(box.left),
      top: Math.round(box.top),
      width: Math.round(box.width),
      height: Math.round(box.height),
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
