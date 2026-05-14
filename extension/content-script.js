const TASK_TIMEOUTS = {
  ask: 120000,
  code: 120000,
  image: 600000,
  video: 1800000,
};

const BRIDGE_SCRIPT_VERSION = '2026-05-14-v8';
const BRIDGE_ORIGIN = 'http://127.0.0.1:8765';
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
      const response = await fetch(`${BRIDGE_ORIGIN}/extension/claim`, { method: 'POST' });
      if (response.ok) {
        const payload = await response.json();
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
  try {
    const result = await runGeminiTask(task);
    await reportTaskResult(task.id, { status: 'completed', result });
  } catch (error) {
    await reportTaskResult(task.id, { status: 'failed', error: error.message });
  }
}

async function reportTaskResult(taskId, payload) {
  await fetch(`${BRIDGE_ORIGIN}/tasks/${encodeURIComponent(taskId)}/result`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function runGeminiTask(task) {
  const prompt = task.extensionPrompt || task.prompt;
  const beforeSignature = latestResponseSignature();
  const submission = await submitPrompt(prompt);

  await waitForNewResponse(beforeSignature, TASK_TIMEOUTS[task.type] ?? TASK_TIMEOUTS.ask);
  await waitForSettledGeneration(task.type);

  return extractResult(task.type, submission);
}

async function submitPrompt(prompt) {
  const input = await waitForElement(findPromptInput, 30000, 'Could not find Gemini prompt input');
  const inputInfo = describeInput(input);
  window.__geminiWebBridge.lastPromptTarget = inputInfo;
  window.__geminiWebBridge.lastPromptError = null;
  document.documentElement.setAttribute('data-gemini-web-bridge-target', JSON.stringify(inputInfo));

  input.focus();
  setPromptText(input, prompt);

  const sendButton = await waitForElement(() => findSendButton(input), 10000, 'Could not find Gemini send button');
  const buttonInfo = describeButton(sendButton);
  const beforeIdle = composerStillLooksIdle(input);

  performTrustedClick(sendButton);
  await sleep(250);

  if (composerStillLooksIdle(input)) {
    dispatchEnterSubmission(input);
    await sleep(250);
  }

  if (composerStillLooksIdle(input)) {
    sendButton.focus();
    sendButton.click();
    await sleep(250);
  }

  const didSubmit = !composerStillLooksIdle(input);

  return {
    scriptVersion: BRIDGE_SCRIPT_VERSION,
    inputInfo,
    buttonInfo,
    submittedAt: new Date().toISOString(),
    beforeIdle,
    didSubmit,
  };
}

function setPromptText(input, prompt) {
  if ('value' in input && input.tagName === 'TEXTAREA') {
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (input.isContentEditable) {
    if (trySetWithQuill(input, prompt)) {
      return;
    }
    replaceContentEditableText(input, prompt);
    return;
  }

  input.textContent = prompt;
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
      || label.includes('arrow_forward')
    );
  });

  if (labelled) return labelled;

  const inputBox = input.getBoundingClientRect();
  const composerButtons = candidates
    .filter((button) => {
      const text = normalizeText(button.innerText || button.textContent || '').toLowerCase();
      const aria = (button.getAttribute('aria-label') || '').toLowerCase();
      if (text === '+' || text.includes('tool') || text.includes('pro') || aria.includes('tool')) return false;

      const box = button.getBoundingClientRect();
      const nearInput = box.top >= inputBox.top - 80 && box.bottom <= inputBox.bottom + 120;
      const toRight = box.left > inputBox.left + inputBox.width * 0.5;
      return nearInput && toRight;
    })
    .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);

  return composerButtons[0] || null;
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

async function waitForSettledGeneration(type) {
  const settleMs = type === 'video' ? 8000 : 2500;
  await sleep(settleMs);
}

function extractResult(type, submission) {
  const response = latestResponseElement() || document.body;
  const text = normalizeText(response.innerText || '');
  const codeBlocks = Array.from(response.querySelectorAll('pre, code-block, .code-block'))
    .map((element) => normalizeText(element.innerText || element.textContent || ''))
    .filter(Boolean);

  const media = extractMedia(response, type);

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

function extractMedia(root, type) {
  const items = [];
  const images = Array.from(root.querySelectorAll('img'))
    .filter((img) => img.naturalWidth > 128 && img.naturalHeight > 128);

  images.forEach((img, index) => {
    items.push({
      kind: 'image',
      index,
      url: img.currentSrc || img.src,
    });
  });

  const videos = Array.from(root.querySelectorAll('video'));
  videos.forEach((video, index) => {
    items.push({
      kind: 'video',
      index,
      url: video.currentSrc || video.src,
    });
  });

  if (type === 'image' || type === 'video') {
    queueBrowserDownloads(items);
  }

  return items;
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

function latestResponseElement() {
  const selectors = [
    'message-content',
    '[data-response-index]',
    '.model-response-text',
    'div[class*="response"]',
    'main article',
  ];

  const elements = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const visible = elements.filter((element) => normalizeText(element.innerText || element.textContent || '').length > 0);
  return visible.at(-1) ?? null;
}

function latestResponseSignature() {
  const element = latestResponseElement();
  return element ? normalizeText(element.innerText || element.textContent || '').slice(-500) : '';
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

  const selection = window.getSelection();
  if (!selection) {
    window.__geminiWebBridge.lastPromptError = 'window.getSelection() is unavailable';
    document.documentElement.setAttribute('data-gemini-web-bridge-error', 'window.getSelection() is unavailable');
    throw new Error('window.getSelection() is unavailable');
  }

  const range = document.createRange();
  range.selectNodeContents(input);
  selection.removeAllRanges();
  selection.addRange(range);

  const selected = document.execCommand('selectAll', false);
  const inserted = selected && document.execCommand('insertText', false, prompt);
  if (inserted) {
    return;
  }

  input.textContent = prompt;
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

function composerStillLooksIdle(input) {
  const button = findSendButton(input);
  if (!button) return true;

  const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase();
  const looksLikeStop = label.includes('stop') || label.includes('cancel');
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
