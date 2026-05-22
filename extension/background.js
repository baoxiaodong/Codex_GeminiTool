const BRIDGE_HEALTH_URL = 'http://127.0.0.1:8765/health';
const BRIDGE_HISTORY_URL = 'http://127.0.0.1:8765/history';
import { buttonLooksLikeStop, submissionLooksSuccessful } from './submit-state.js';

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

  if (message?.type === 'popup_history') {
    getBridgeHistory()
      .then((history) => sendResponse(history))
      .catch((error) => sendResponse({ tasks: [], error: error.message }));
    return true;
  }

  if (message?.type === 'download_media') {
    downloadMedia(message.url, message.filename)
      .then((downloadId) => sendResponse({ ok: true, downloadId }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'fetch_media_data_url') {
    fetchMediaDataUrl(message.url)
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'debugger_submit_prompt') {
    submitPromptWithDebugger(sender.tab?.id, message.text)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'debugger_insert_text') {
    insertTextWithDebugger(sender.tab?.id, message.text)
      .then(() => sendResponse({ ok: true }))
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

async function insertTextWithDebugger(tabId, text) {
  if (!tabId) {
    throw new Error('debugger_insert_text requires sender tab');
  }

  const target = { tabId };
  await attachDebugger(target);

  try {
    await sendDebuggerCommand(target, 'Input.insertText', { text });
  } finally {
    await detachDebugger(target);
  }
}

async function submitPromptWithDebugger(tabId, text) {
  if (!tabId) {
    throw new Error('debugger_submit_prompt requires sender tab');
  }

  const target = { tabId };
  await attachDebugger(target);

  try {
    const prepared = await evaluateInPage(target, preparePromptInPage, text);
    if (!prepared?.buttonRect) {
      throw new Error(`Could not find send button: ${JSON.stringify(prepared)}`);
    }

    let checked = null;

    await clickButtonRect(target, prepared.buttonRect);
    checked = await evaluateInPage(target, checkPromptSubmissionInPage, text);

    if (!submissionLooksSuccessful(checked)) {
      await sendDebuggerCommand(target, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        windowsVirtualKeyCode: 13,
        code: 'Enter',
        key: 'Enter',
      });
      await sendDebuggerCommand(target, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: 13,
        code: 'Enter',
        key: 'Enter',
      });
      checked = await evaluateInPage(target, checkPromptSubmissionInPage, text);
    }

    if (!submissionLooksSuccessful(checked)) {
      await sendDebuggerCommand(target, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        windowsVirtualKeyCode: 13,
        code: 'Enter',
        key: 'Enter',
        modifiers: 2,
      });
      await sendDebuggerCommand(target, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: 13,
        code: 'Enter',
        key: 'Enter',
        modifiers: 2,
      });
      checked = await evaluateInPage(target, checkPromptSubmissionInPage, text);
    }

    return {
      ...prepared,
      ...checked,
      method: 'debugger_main_world',
    };
  } finally {
    await detachDebugger(target);
  }
}

async function getBridgeHistory() {
  const response = await fetch(BRIDGE_HISTORY_URL);
  if (!response.ok) {
    throw new Error(`Bridge history returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload && typeof payload === 'object'
    ? payload
    : { tasks: [] };
}

async function clickButtonRect(target, rect) {
  const { x, y } = rect;
  await sendDebuggerCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
  });
  await sendDebuggerCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await sendDebuggerCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
}

async function evaluateInPage(target, fn, ...args) {
  const expression = `(${fn.toString()})(...${JSON.stringify(args)})`;
  const response = await sendDebuggerCommand(target, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });

  if (response?.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || 'Runtime.evaluate failed');
  }

  return response?.result?.value;
}

async function preparePromptInPage(prompt) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeText = (text) => String(text || '').replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim();
  const escapeHtml = (text) => String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const findPromptInput = () => document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"][aria-label*="Gemini"]')
    || document.querySelector('div[contenteditable="true"][role="textbox"][aria-label*="Gemini"]')
    || document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"]')
    || document.querySelector('div[contenteditable="true"][role="textbox"]')
    || document.querySelector('rich-textarea div[contenteditable="true"]')
    || document.querySelector('textarea')
    || document.querySelector('[aria-label*="Enter a prompt" i]')
    || document.querySelector('[aria-label*="prompt" i]');

  const visibleEnabledButtons = () => Array.from(document.querySelectorAll('button'))
    .filter((button) => {
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
      const box = button.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });

  const findSendButton = (input) => {
    const candidates = visibleEnabledButtons();
    const labelled = candidates.find((button) => {
      const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase();
      return label.includes('send')
        || label.includes('submit')
        || label.includes('send message')
        || label.includes('send prompt')
        || label.includes('发送')
        || label.includes('提交')
        || label.includes('发送消息')
        || label.includes('发送提示')
        || label.includes('arrow_forward');
    });

    if (labelled) return labelled;

    const inputBox = input.getBoundingClientRect();
    return candidates
      .filter((button) => {
        const text = normalizeText(button.innerText || button.textContent || '').toLowerCase();
        const aria = (button.getAttribute('aria-label') || '').toLowerCase();
        const title = (button.getAttribute('title') || '').toLowerCase();
        const html = button.outerHTML.toLowerCase();
        const label = `${text} ${aria} ${title} ${html}`;
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
      .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0] || null;
  };

  const dispatchRichInputEvents = (input) => {
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
    input.classList?.remove('ql-blank');
  };

  const input = findPromptInput();
  if (!input) {
    throw new Error('Could not find Gemini prompt input');
  }

  input.focus();

  if ('value' in input && input.tagName === 'TEXTAREA') {
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  } else if (input.isContentEditable) {
    const quill = [
      input.__quill,
      input.parentElement?.__quill,
      input.closest('.ql-container')?.__quill,
      input.closest('.ql-editor')?.__quill,
    ].find((candidate) => typeof candidate?.setText === 'function');

    if (quill) {
      quill.focus?.();
      quill.setText(prompt, 'user');
      quill.setSelection?.(prompt.length, 0, 'user');
    } else {
      input.innerHTML = `<p>${escapeHtml(prompt)}</p>`;
    }
    dispatchRichInputEvents(input);
  } else {
    input.textContent = prompt;
    dispatchRichInputEvents(input);
  }

  await sleep(400);
  const button = findSendButton(input);
  const buttonBox = button?.getBoundingClientRect();
  const inputBox = input.getBoundingClientRect();
  const inputText = normalizeText(input.innerText || input.textContent || input.value || '');

  return {
    inputInfo: describeElementInPage(input, inputBox),
    buttonInfo: button ? describeElementInPage(button, buttonBox) : null,
    buttonRect: buttonBox ? {
      x: Math.round(buttonBox.left + buttonBox.width / 2),
      y: Math.round(buttonBox.top + buttonBox.height / 2),
    } : null,
    inserted: inputText.includes(prompt.slice(0, 20)),
    inputTextLength: inputText.length,
  };

  function describeElementInPage(element, box) {
    return {
      tagName: element.tagName,
      role: element.getAttribute('role') || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      text: normalizeText(element.innerText || element.textContent || '').slice(0, 80),
      className: String(element.className || ''),
      rect: {
        left: Math.round(box.left),
        top: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
    };
  }
}

async function checkPromptSubmissionInPage(prompt) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeText = (text) => String(text || '').replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim();
  const looksLikeStop = (label) => {
    const normalized = String(label || '').toLowerCase();
    return normalized.includes('stop')
      || normalized.includes('停止')
      || normalized.includes('cancel')
      || normalized.includes('取消');
  };
  const findPromptInput = () => document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"][aria-label*="Gemini"]')
    || document.querySelector('div[contenteditable="true"][role="textbox"][aria-label*="Gemini"]')
    || document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"]')
    || document.querySelector('div[contenteditable="true"][role="textbox"]')
    || document.querySelector('rich-textarea div[contenteditable="true"]')
    || document.querySelector('textarea')
    || document.querySelector('[aria-label*="Enter a prompt" i]')
    || document.querySelector('[aria-label*="prompt" i]');

  await sleep(900);
  const input = findPromptInput();
  const inputText = normalizeText(input?.innerText || input?.textContent || input?.value || '');
  const promptNeedle = prompt.slice(0, 20);
  const runningDetected = Array.from(document.querySelectorAll('button, [aria-label], mat-icon'))
    .map((element) => `${element.getAttribute?.('aria-label') || ''} ${element.textContent || ''}`.toLowerCase())
    .some((label) => looksLikeStop(label));
  const inputContainsPrompt = inputText.includes(promptNeedle);
  return {
    didSubmit: !inputContainsPrompt || runningDetected,
    afterInputTextLength: inputText.length,
    afterInputTextPreview: inputText.slice(0, 80),
    runningDetected,
  };
}

function attachDebugger(target) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, '1.3', () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function sendDebuggerCommand(target, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

function detachDebugger(target) {
  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => resolve());
  });
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

async function fetchMediaDataUrl(url) {
  if (!url) {
    throw new Error('fetch_media_data_url requires url');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Media fetch returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:${contentType};base64,${base64}`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}
