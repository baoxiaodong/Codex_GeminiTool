import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { access, appendFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { backupSqliteDatabase } from './sqlite-copy.mjs';

const GEMINI_URL = 'https://gemini.google.com/app';
const DEFAULT_TIMEOUTS = {
  ask: 120000,
  code: 120000,
  image: 600000,
  video: 1800000,
};
const RESPONSE_SELECTORS = ['message-content', '[data-response-index]', '.model-response-text', 'div[class*="response"]', 'main article'];
const CHROME_EXECUTABLE = process.env.GEMINI_BROWSER_CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CHROME_USER_DATA = process.env.GEMINI_BROWSER_USER_DATA
  ?? `${process.env.LOCALAPPDATA}/Google/Chrome/User Data`;
const CHROME_PROFILE_DIR = process.env.GEMINI_BROWSER_PROFILE_DIR ?? 'Default';
const AUTOMATION_USER_DATA = process.env.GEMINI_BROWSER_AUTOMATION_USER_DATA
  ?? 'C:/tmp/gemini-browser-profile';
const BROWSER_RUNTIME_MODE = normalizeBrowserRuntimeMode(process.env);
const CHROME_CDP_HOST = process.env.GEMINI_BROWSER_CDP_HOST ?? '127.0.0.1';
const CHROME_CDP_PORT = Number(process.env.GEMINI_BROWSER_CDP_PORT ?? 9222);
const CHROME_CDP_STARTUP_TIMEOUT_MS = Number(process.env.GEMINI_BROWSER_CDP_STARTUP_TIMEOUT_MS ?? 20000);
const PROFILE_POLICY = normalizeProfilePolicy(process.env);
const CAPABILITY_ERROR_MESSAGE = 'Gemini automation browser is not logged in or this account/session cannot create images. Open the dedicated automation browser, sign in to Gemini, confirm image generation works there once, then retry.';

export async function executeBrowserTask(task, options = {}) {
  const mode = options.mode ?? BROWSER_RUNTIME_MODE;

  if (mode === 'stub') {
    return {
      text: `Browser agent placeholder for ${task.type}: ${task.prompt}`,
      codeBlocks: task.type === 'code' ? ['console.log("browser agent stub")'] : [],
      media: [],
      files: [],
      raw: { executor: 'browser', mode, taskType: task.type, prompt: task.prompt },
    };
  }

  if (mode !== 'persistent' && mode !== 'cdp') {
    throw new Error(`Unsupported browser agent mode: ${mode}`);
  }

  const profile = await prepareAutomationProfile({ policy: PROFILE_POLICY });
  const browserHandle = mode === 'cdp'
    ? await connectToAutomationChromeViaCdp()
    : { context: await chromium.launchPersistentContext(AUTOMATION_USER_DATA, {
      executablePath: CHROME_EXECUTABLE,
      headless: false,
      viewport: null,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        `--profile-directory=${CHROME_PROFILE_DIR}`,
      ],
    }), browser: null, close: async () => {}, shouldCloseContext: true };
  const context = browserHandle.context;
  const runtimeLog = await createBrowserRuntimeLogger(task, mode);

  try {
    const page = await findGeminiPage(context);
    bindBrowserRuntimeLogging({ browserHandle, context, page, runtimeLog });
    await page.bringToFront().catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    let result;
    try {
      result = await runBrowserTaskWithRetries(page, task);
    } catch (error) {
      if (task.type === 'image' || task.type === 'video') {
        const diagnostics = await captureBrowserFailureDiagnostics(page, task.type);
        if (diagnostics) {
          error.message = `${error.message} Diagnostics: ${JSON.stringify(diagnostics)}`;
        }
      }
      throw error;
    }

    return {
      ...result,
      raw: {
        ...(result.raw || {}),
        executor: 'browser',
        mode,
        pageUrl: page.url(),
        browserSession: browserSessionLabel(profile.policy, mode),
        profilePolicy: profile.policy,
        profileCopied: profile.copied,
      },
    };
  } finally {
    if (browserHandle.shouldCloseContext !== false) {
      await context.close().catch(() => {});
    }
    await browserHandle.close().catch(() => {});
  }
}

async function captureBrowserFailureDiagnostics(page, taskType) {
  try {
    const root = path.join(AUTOMATION_USER_DATA, 'browser-debug');
    await mkdir(root, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const screenshotPath = path.join(root, `${taskType}-${stamp}.png`);
    const jsonPath = path.join(root, `${taskType}-${stamp}.json`);

    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
    const snapshot = await page.evaluate(() => {
      const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
      return {
        url: location.href,
        title: document.title,
        body: norm(document.body?.innerText || '').slice(0, 4000),
        buttons: Array.from(document.querySelectorAll('button,a,[role="button"]')).map((el) => ({
          text: norm(el.innerText || el.textContent || '').slice(0, 120),
          aria: norm(el.getAttribute('aria-label') || ''),
          title: norm(el.getAttribute('title') || ''),
        })).filter((item) => item.text || item.aria || item.title).slice(0, 80),
        imgs: Array.from(document.querySelectorAll('img')).map((img) => {
          const box = img.getBoundingClientRect();
          return {
            src: (img.currentSrc || img.src || '').slice(0, 240),
            width: img.naturalWidth,
            height: img.naturalHeight,
            boxWidth: box.width,
            boxHeight: box.height,
          };
        }).slice(0, 40),
        canvases: Array.from(document.querySelectorAll('canvas')).map((canvas) => {
          const box = canvas.getBoundingClientRect();
          return {
            width: canvas.width,
            height: canvas.height,
            boxWidth: box.width,
            boxHeight: box.height,
          };
        }).slice(0, 20),
      };
    }).catch(() => null);

    if (snapshot) {
      await writeFile(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8');
    }

    return {
      screenshotPath,
      jsonPath,
      body: snapshot?.body?.slice(0, 500) ?? '',
    };
  } catch {
    return null;
  }
}

async function createBrowserRuntimeLogger(task, mode) {
  const root = path.join(AUTOMATION_USER_DATA, 'browser-debug');
  await mkdir(root, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const filePath = path.join(root, `${task.type}-${task.id}-${mode}-${stamp}.log`);
  const write = async (message) => {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    await appendFile(filePath, line, 'utf8').catch(() => {});
  };
  await write(`runtime logger created for ${task.type} task ${task.id} mode=${mode}`);
  return { filePath, write };
}

function bindBrowserRuntimeLogging({ browserHandle, context, page, runtimeLog }) {
  const write = runtimeLog?.write ?? (async () => {});
  void write(`initial page url=${page.url()}`);
  page.on('close', () => { void write('page close'); });
  page.on('crash', () => { void write('page crash'); });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) void write(`main frame navigated url=${frame.url()}`);
  });
  context.on('page', (newPage) => {
    void write(`context new page url=${newPage.url()}`);
    newPage.on('close', () => { void write(`child page close url=${newPage.url()}`); });
  });
  context.on('close', () => { void write('context close'); });
  browserHandle.browser?.on?.('disconnected', () => { void write('browser disconnected'); });
}

async function runBrowserTaskWithRetries(page, task) {
  const maxAttempts = task.type === 'image' || task.type === 'video' ? 3 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      await openFreshGeminiChat(page);
      await page.waitForTimeout(1500);
    }

    try {
      return await runSingleBrowserTask(page, task);
    } catch (error) {
      lastError = error;
      if (!(task.type === 'image' || task.type === 'video')) throw error;
      if (!isRetryableGeminiMediaFailure(error?.message || '')) throw error;
    }
  }

  throw lastError ?? new Error(`Gemini ${task.type} task failed after retries.`);
}

async function runSingleBrowserTask(page, task) {
  const prompt = buildBrowserPrompt(task);
  const beforeSignature = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return text.slice(-500);
  }).catch(() => '');
  const beforeMediaSignatures = await collectBrowserMediaSignatures(page, task.type);
  const beforeResponseSnapshot = await collectBrowserResponseSnapshot(page);

  await ensureGeminiToolMode(page, task.type);
  const submission = await submitPromptInPage(page, prompt, task.type);
  if (submission.didSubmit === false) {
    throw new Error(`Composer did not submit prompt: ${JSON.stringify(submission)}`);
  }
  let result = await waitForGeminiResult(page, task.type, beforeSignature, beforeMediaSignatures, beforeResponseSnapshot, submission);
  while ((task.type === 'image' || task.type === 'video')
    && result.media.length === 0
    && isGeminiTextStillGenerating(result.text)) {
    await page.waitForTimeout(3000);
    result = await waitForGeminiResult(page, task.type, beforeSignature, beforeMediaSignatures, beforeResponseSnapshot, submission);
  }
  if (task.type === 'video') {
    result = await hydrateBrowserVideoDataUrls(page, result);
  }
  const capabilityError = task.type === 'image' || task.type === 'video'
    ? detectGeminiCapabilityError(result.text)
    : null;
  if (capabilityError) throw new Error(capabilityError);
  if ((task.type === 'image' || task.type === 'video') && result.media.length === 0) {
    throw new Error(`Gemini completed without returning generated ${task.type} media: ${JSON.stringify({
      text: String(result.text || '').slice(0, 500),
      submission: result.raw?.submission ?? null,
    })}`);
  }

  return result;
}

async function hydrateBrowserVideoDataUrls(page, result) {
  if (!result || !Array.isArray(result.media) || result.media.length === 0) return result;

  const media = [];
  for (const item of result.media) {
    if (item?.kind !== 'video'
      || typeof item.dataUrl === 'string'
      || typeof item.url !== 'string'
      || !/^https?:\/\//i.test(item.url)) {
      media.push(item);
      continue;
    }

    try {
      const response = await page.context().request.get(item.url, { timeout: 120000 });
      if (!response.ok()) {
        media.push(item);
        continue;
      }

      const contentType = String(response.headers()['content-type'] || '').split(';')[0].trim().toLowerCase();
      const inferredMimeType = inferVideoMimeType(contentType, item.url);
      if (!inferredMimeType) {
        media.push(item);
        continue;
      }

      const buffer = await response.body();
      const dataUrlPrefix = inferredMimeType === 'video/mp4'
        ? 'data:video/mp4;base64,'
        : `data:${inferredMimeType};base64,`;
      media.push({
        ...item,
        dataUrl: `${dataUrlPrefix}${buffer.toString('base64')}`,
      });
    } catch {
      media.push(item);
    }
  }

  return { ...result, media };
}

function inferVideoMimeType(contentType, mediaUrl = '') {
  if (contentType.startsWith('video/')) return contentType;
  const path = String(mediaUrl || '').split(/[?#]/)[0].toLowerCase();
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mp4') || path.includes('/videoplayback')) return 'video/mp4';
  return null;
}

async function openFreshGeminiChat(page) {
  await page.goto(GEMINI_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate(() => {
    const trigger = Array.from(document.querySelectorAll('a, button')).find((el) => {
      const label = `${el.getAttribute?.('aria-label') || ''} ${el.textContent || ''}`.toLowerCase();
      return label.includes('发起新对话') || label.includes('new chat');
    });
    trigger?.click();
  }).catch(() => {});
}

function isGeminiTextStillGenerating(text) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  return raw.includes('Gemini 正在输入')
    || raw.includes('正在加载 Nano Banana')
    || lower.includes('assessing initial output')
    || lower.includes('assessing output')
    || lower.includes('verifying the image')
    || lower.includes('verifying image')
    || lower.includes('finalizing image')
    || lower.includes('rendering image')
    || lower.includes('gemini is typing');
}

export function isRetryableGeminiMediaFailure(text) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  return raw.includes('1099')
    || lower.includes('something went wrong')
    || raw.includes('出了点问题');
}

export function normalizeBrowserRuntimeMode(env = process.env) {
  const raw = String(env.GEMINI_BROWSER_RUNTIME_MODE || '').trim().toLowerCase();
  if (raw === 'persistent' || raw === 'cdp' || raw === 'stub') return raw;
  return 'cdp';
}

export function normalizeProfilePolicy(env = process.env) {
  const raw = String(env.GEMINI_BROWSER_PROFILE_POLICY || '').trim().toLowerCase();
  if (raw === 'copy-once' || raw === 'copy-always' || raw === 'reuse') return raw;
  return 'reuse';
}

export function shouldCopyProfile({ policy, automationProfileExists }) {
  if (policy === 'copy-always') return true;
  if (policy === 'copy-once') return !automationProfileExists;
  return false;
}

export function browserSessionLabel(policy, runtime = 'persistent') {
  if (runtime === 'cdp') {
    if (policy === 'copy-always') return 'cdp-attached-copy-profile';
    if (policy === 'copy-once') return 'cdp-attached-copy-once-profile';
    return 'cdp-attached-dedicated-profile';
  }
  if (policy === 'copy-always') return 'persistent-context-copy-profile';
  if (policy === 'copy-once') return 'persistent-context-copy-once-profile';
  return 'persistent-context-dedicated-profile';
}

export function detectGeminiCapabilityError(text) {
  const normalized = String(text || '').toLowerCase();
  const hasLoginHint = normalized.includes('您登录了吗')
    || normalized.includes('not logged in')
    || normalized.includes('sign in')
    || normalized.includes('login');
  const hasImageCapabilityHint = normalized.includes('无法为您创建任何图片')
    || normalized.includes('无法创建图片')
    || normalized.includes('cannot create images')
    || normalized.includes("can't create images")
    || normalized.includes('can’t create images')
    || normalized.includes('cannot create an image')
    || normalized.includes("can't create an image")
    || normalized.includes('can’t create an image');

  return hasLoginHint || hasImageCapabilityHint ? CAPABILITY_ERROR_MESSAGE : null;
}

async function prepareAutomationProfile({ policy } = {}) {
  const srcProfile = path.join(CHROME_USER_DATA, CHROME_PROFILE_DIR);
  const dstProfile = path.join(AUTOMATION_USER_DATA, CHROME_PROFILE_DIR);

  await mkdir(AUTOMATION_USER_DATA, { recursive: true });
  const automationProfileExists = await exists(dstProfile);
  if (!shouldCopyProfile({ policy, automationProfileExists })) {
    return { policy, copied: false };
  }

  await rm(dstProfile, { recursive: true, force: true }).catch(() => {});
  await cp(srcProfile, dstProfile, {
    recursive: true,
    filter: (source) => {
      const lower = String(source).toLowerCase();
      return !lower.includes('cache')
        && !lower.includes('code cache')
        && !/[\\/](network)([\\/]|$)/i.test(lower)
        && !lower.includes('safe browsing')
        && !lower.includes('sessions')
        && !lower.includes('session storage')
        && !lower.endsWith('lockfile')
        && !lower.includes('shadercache')
        && !lower.includes('grshadercache')
        && !lower.includes('gpucache');
    },
  });

  const srcCookies = path.join(srcProfile, 'Network', 'Cookies');
  const dstCookies = path.join(dstProfile, 'Network', 'Cookies');
  try {
    await backupSqliteDatabase(srcCookies, dstCookies);
  } catch {}

  const localStateSrc = path.join(CHROME_USER_DATA, 'Local State');
  const localStateDst = path.join(AUTOMATION_USER_DATA, 'Local State');
  try {
    const localState = await readFile(localStateSrc);
    await writeFile(localStateDst, localState);
  } catch {}

  return { policy, copied: true };
}

async function connectToAutomationChromeViaCdp() {
  const endpoint = `http://${CHROME_CDP_HOST}:${CHROME_CDP_PORT}`;
  let launchedProcess = null;

  if (!(await isCdpEndpointAvailable(endpoint))) {
    launchedProcess = launchAutomationChromeForCdp();
    await waitForCdpEndpoint(endpoint, CHROME_CDP_STARTUP_TIMEOUT_MS);
  }

  const browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  if (!context) {
    await browser.close().catch(() => {});
    throw new Error(`Connected to Chrome CDP endpoint ${endpoint}, but no browser context is available.`);
  }

  return {
    browser,
    context,
    shouldCloseContext: false,
    close: async () => {
      if (launchedProcess) {
        await browser.close().catch(() => {});
        if (!launchedProcess.killed) {
          launchedProcess.kill();
        }
      }
    },
  };
}

function launchAutomationChromeForCdp() {
  const args = [
    `--user-data-dir=${AUTOMATION_USER_DATA}`,
    `--profile-directory=${CHROME_PROFILE_DIR}`,
    `--remote-debugging-port=${CHROME_CDP_PORT}`,
    '--new-window',
    '--no-first-run',
    '--no-default-browser-check',
    GEMINI_URL,
  ];

  const child = spawn(CHROME_EXECUTABLE, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  return child;
}

async function isCdpEndpointAvailable(endpoint) {
  try {
    const response = await fetch(`${endpoint}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForCdpEndpoint(endpoint, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isCdpEndpointAvailable(endpoint)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for Chrome CDP endpoint: ${endpoint}`);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findGeminiPage(context) {
  for (const page of context.pages()) {
    const url = page.url();
    if (url.startsWith(GEMINI_URL) || url.startsWith('https://gemini.google.com/')) {
      return page;
    }
  }
  const page = await context.newPage();
  await page.goto(GEMINI_URL, { waitUntil: 'domcontentloaded' });
  return page;
}

async function collectBrowserMediaSignatures(page, type) {
  if (type !== 'image' && type !== 'video') return [];
  return await page.evaluate((type) => {
    const isGeneratedMediaCandidate = (src, width, height) => {
      const lower = String(src || '').toLowerCase();
      return width >= 256
        && height >= 256
        && !lower.includes('gstatic.com')
        && !lower.includes('gemini_sparkle')
        && !lower.includes('.svg');
    };
    const isGeminiStillGenerating = () => {
      const labels = Array.from(document.querySelectorAll('button, [aria-label], mat-icon'))
        .map((el) => `${el.getAttribute?.('aria-label') || ''} ${el.textContent || ''}`.toLowerCase())
        .join(' ');
      const bodyText = String(document.body?.innerText || '');
      const lowerBodyText = bodyText.toLowerCase();
      return labels.includes('stop')
        || labels.includes('停止')
        || labels.includes('cancel')
        || labels.includes('取消')
        || bodyText.includes('Gemini 正在输入')
        || bodyText.includes('正在加载 Nano Banana')
        || lowerBodyText.includes('assessing initial output')
        || lowerBodyText.includes('assessing output')
        || lowerBodyText.includes('verifying the image')
        || lowerBodyText.includes('verifying image')
        || lowerBodyText.includes('finalizing image')
        || lowerBodyText.includes('rendering image')
        || lowerBodyText.includes('gemini is typing');
    };
    const collectVisibleMediaCandidates = (mediaType) => {
      if (mediaType === 'image') {
        return Array.from(document.querySelectorAll('img')).map((img) => {
          const box = img.getBoundingClientRect();
          const width = img.naturalWidth || box.width;
          const height = img.naturalHeight || box.height;
          const src = img.currentSrc || img.src || '';
          return {
            signature: `${src}|${Math.round(width)}x${Math.round(height)}`,
            visible: isGeneratedMediaCandidate(src, width, height) && box.width > 0 && box.height > 0,
          };
        }).filter((item) => item.visible);
      }

      return Array.from(document.querySelectorAll('video')).map((video) => {
        const box = video.getBoundingClientRect();
        const src = video.currentSrc || video.src || video.querySelector?.('source[src]')?.src || '';
        return {
          signature: `${src}|${Math.round(video.videoWidth || box.width)}x${Math.round(video.videoHeight || box.height)}`,
          visible: box.width > 0 && box.height > 0 && Boolean(src),
        };
      }).filter((item) => item.visible);
    };

    return collectVisibleMediaCandidates(type).map((item) => item.signature);
  }, type).catch(() => []);
}

async function collectBrowserResponseSnapshot(page) {
  return await page.evaluate((selectors) => {
    const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
    const seen = new Set();
    const candidates = [];

    for (const selector of selectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        if (seen.has(element)) continue;
        seen.add(element);
        const text = normalize(element.innerText || element.textContent || '');
        const hasMedia = Boolean(element.querySelector('img, video, canvas'));
        const hasSource = Array.from(element.querySelectorAll('button,a')).some((node) => {
          const label = normalize(`${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''}`);
          return label.includes('来源') || /source|download/i.test(label);
        });
        if (!text && !hasMedia && !hasSource) continue;
        candidates.push({
          signature: `${text.slice(0, 300)}|media:${element.querySelectorAll('img,video,canvas').length}|links:${element.querySelectorAll('a,button').length}`,
        });
      }
    }

    return {
      count: candidates.length,
      signatures: candidates.map((item) => item.signature),
    };
  }, RESPONSE_SELECTORS).catch(() => ({ count: 0, signatures: [] }));
}

function buildBrowserPrompt(task) {
  if (task.type === 'code') {
    const context = task.context ? `\n\nRelevant context:\n${task.context}` : '';
    return `${task.prompt}${context}\n\nReturn code in fenced Markdown blocks or as a unified diff when edits are requested.`;
  }
  if (task.type === 'image' || task.type === 'video') return task.prompt;
  return task.context ? `${task.prompt}\n\nContext:\n${task.context}` : task.prompt;
}

function toolModeForTaskType(type) {
  if (type === 'image') return '制作图片';
  if (type === 'video') return '制作视频';
  return null;
}

async function ensureGeminiToolMode(page, type) {
  const targetLabel = toolModeForTaskType(type);
  if (!targetLabel) return;

  const alreadySelected = await page.evaluate((label) => {
    const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
    return Array.from(document.querySelectorAll('button,[role="button"],span,div'))
      .some((el) => {
        const text = normalize(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''}`);
        const selected = el.getAttribute?.('aria-pressed') === 'true'
          || el.getAttribute?.('aria-selected') === 'true'
          || el.getAttribute?.('data-selected') === 'true';
        return selected && text.includes(label);
      });
  }, targetLabel).catch(() => false);

  if (alreadySelected) return;

  let opened = await clickGeminiToolMenuWithPlaywright(page);
  if (!opened) {
    opened = await page.evaluate(() => {
      function findGeminiToolMenuTrigger() {
        const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
        const matchesToolTrigger = (text) => {
          const lower = String(text || '').toLowerCase();
          return text === '+'
            || lower === 'plus'
            || lower.includes(' plus ')
            || text.includes('上传和工具')
            || text.includes('工具')
            || text.includes('插入')
            || text.includes('添加')
            || lower.includes('upload')
            || lower.includes('tools')
            || lower.includes('create')
            || lower.includes('more');
        };
        const candidates = Array.from(document.querySelectorAll('button,[role="button"],[aria-label],mat-icon,span,div'));
        for (const el of candidates) {
          const text = normalize(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''} ${el.getAttribute?.('title') || ''}`);
          if (!matchesToolTrigger(text)) continue;
          const box = el.getBoundingClientRect();
          if (box.width <= 0 || box.height <= 0) continue;
          return el.closest('button,[role="button"],[aria-label]') || el;
        }
        return null;
      }

      const trigger = findGeminiToolMenuTrigger();
      if (!trigger) return false;
      trigger.click();
      return true;
    }).catch(() => false);
  }

  if (!opened) {
    opened = await clickGeminiToolMenuByGeometry(page);
  }

  if (!opened) {
    throw new Error(`Could not open Gemini tool menu before selecting ${targetLabel}.`);
  }

  await page.waitForTimeout(500);

  let selected = await selectGeminiToolMode(page, targetLabel);
  if (!selected) {
    await clickGeminiToolMenuByGeometry(page);
    await page.waitForTimeout(500);
    selected = await selectGeminiToolMode(page, targetLabel);
  }

  if (!selected) {
    throw new Error(`Could not select Gemini tool mode: ${targetLabel}.`);
  }

  await page.waitForTimeout(800);
}

function isDisabledGeminiToolOption(el) {
  if (!el) return false;
  const ariaDisabled = el.getAttribute?.('aria-disabled') === 'true';
  const disabled = Boolean(el.disabled);
  const className = String(el.className || '').toLowerCase();
  const style = globalThis.getComputedStyle?.(el);
  const faded = Number(style?.opacity ?? 1) < 0.6;
  const blockedPointer = style?.pointerEvents === 'none';

  return ariaDisabled
    || disabled
    || className.includes('disabled')
    || className.includes('unavailable')
    || (faded && blockedPointer);
}

async function clickGeminiToolMenuWithPlaywright(page) {
  const locators = [
    page.getByLabel('上传和工具'),
    page.getByRole('button', { name: /上传和工具|upload|tools|plus/i }),
    page.locator('[aria-label="上传和工具"]').first(),
  ];

  for (const locator of locators) {
    try {
      await locator.click({ timeout: 2000 });
      await page.waitForTimeout(300);
      return true;
    } catch {}
  }

  return false;
}

async function selectGeminiToolMode(page, targetLabel) {
  return await page.evaluate((label) => {
    const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
    const isDisabledGeminiToolOption = (el) => {
      if (!el) return false;
      const ariaDisabled = el.getAttribute?.('aria-disabled') === 'true';
      const disabled = Boolean(el.disabled);
      const className = String(el.className || '').toLowerCase();
      const style = globalThis.getComputedStyle?.(el);
      const faded = Number(style?.opacity ?? 1) < 0.6;
      const blockedPointer = style?.pointerEvents === 'none';

      return ariaDisabled
        || disabled
        || className.includes('disabled')
        || className.includes('unavailable')
        || (faded && blockedPointer);
    };
    const options = Array.from(document.querySelectorAll('button,[role="menuitem"],[role="option"],[role="button"],li,div'));
    const target = options.find((el) => {
      const text = normalize(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''} ${el.getAttribute?.('title') || ''}`);
      if (!text.includes(label)) return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });

    if (!target) return false;
    if (isDisabledGeminiToolOption(target)) {
      throw new Error(`Gemini tool mode is visible but disabled: ${label}`);
    }
    target.click();
    return true;
  }, targetLabel).catch((error) => {
    if (String(error?.message || '').includes('Gemini tool mode is visible but disabled')) {
      throw error;
    }
    return false;
  });
}

async function clickGeminiToolMenuByGeometry(page) {
  const box = await page.locator([
    'div.ql-editor[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea',
  ].join(', ')).first().boundingBox().catch(() => null);
  if (!box) return false;

  await page.mouse.click(Math.max(1, box.x - 28), box.y + box.height / 2);
  await page.waitForTimeout(300);
  return true;
}

async function submitPromptInPage(page, prompt, type) {
  const timeoutMs = Math.min(DEFAULT_TIMEOUTS[type] ?? DEFAULT_TIMEOUTS.ask, 30000);
  const inputSelector = [
    'div.ql-editor[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea',
  ].join(', ');

  await page.waitForFunction(() => Boolean(
    document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"]')
    || document.querySelector('div[contenteditable="true"][role="textbox"]')
    || document.querySelector('textarea')
  ), { timeout: timeoutMs });

  const input = page.locator(inputSelector).first();
  await input.click({ force: true });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await page.keyboard.insertText(prompt);
  await page.waitForTimeout(500);

  let clickedSend = await clickSendButton(page);
  if (!clickedSend) {
    await fillPromptWithDomFallback(page, prompt);
    await page.waitForTimeout(500);
    clickedSend = await clickSendButton(page);
  }
  if (!clickedSend) {
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(500);
    clickedSend = await clickSendButton(page);
  }
  await page.waitForTimeout(1500);

  return await page.evaluate(({ prompt, clickedSend }) => {
    const normalize = (text) => String(text || '').replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim();
    const input = document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"]')
      || document.querySelector('div[contenteditable="true"][role="textbox"]')
      || document.querySelector('textarea');
    const isGenerating = () => {
      const labels = Array.from(document.querySelectorAll('button, [aria-label], mat-icon'))
        .map((el) => `${el.getAttribute?.('aria-label') || ''} ${el.textContent || ''}`.toLowerCase())
        .join(' ');
      return labels.includes('stop') || labels.includes('停止') || labels.includes('cancel') || labels.includes('取消');
    };
    const inputPreview = normalize(input?.innerText || input?.textContent || input?.value || '').slice(0, 160);
    const promptPrefix = normalize(prompt).slice(0, 30);

    return {
      didSubmit: isGenerating() || Boolean(clickedSend && promptPrefix && !inputPreview.includes(promptPrefix)),
      inputPreview,
      clickedSend,
    };
  }, { prompt, clickedSend });
}

async function fillPromptWithDomFallback(page, prompt) {
  await page.evaluate((prompt) => {
    const input = document.querySelector('div.ql-editor[contenteditable="true"][role="textbox"]')
      || document.querySelector('div[contenteditable="true"][role="textbox"]')
      || document.querySelector('textarea');
    if (!input) return;

    input.focus();
    if ('value' in input && input.tagName === 'TEXTAREA') {
      input.value = prompt;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const quill = [input.__quill, input.parentElement?.__quill, input.closest('.ql-container')?.__quill, input.closest('.ql-editor')?.__quill]
      .find((candidate) => typeof candidate?.setText === 'function');
    if (quill) {
      quill.focus?.();
      quill.setText(prompt, 'user');
      quill.setSelection?.(prompt.length, 0, 'user');
    } else {
      input.replaceChildren();
      const p = document.createElement('p');
      p.textContent = prompt;
      input.appendChild(p);
    }

    input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true, key: 'Process' }));
    input.classList?.remove('ql-blank');
  }, prompt).catch(() => {});
}

async function clickSendButton(page) {
  return await page.evaluate(() => {
    const visibleButtons = () => Array.from(document.querySelectorAll('button')).filter((button) => {
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
      const box = button.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });

    const button = visibleButtons().find((candidate) => {
      const label = `${candidate.getAttribute('aria-label') || ''} ${candidate.textContent || ''}`.toLowerCase();
      return label.includes('send')
        || label.includes('submit')
        || label.includes('发送')
        || label.includes('提交')
        || label.includes('arrow_forward');
    });

    if (!button) return false;
    button.click();
    return true;
  }).catch(() => false);
}

async function waitForGeminiResult(page, type, beforeSignature, beforeMediaSignatures, beforeResponseSnapshot, submission) {
  const timeoutMs = DEFAULT_TIMEOUTS[type] ?? DEFAULT_TIMEOUTS.ask;
  await page.waitForFunction(({ type, beforeSignature, beforeMediaSignatures, beforeResponseSnapshot, selectors }) => {
    const normalize = (text) => String(text || '').replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim();
    const beforeSet = new Set(beforeMediaSignatures);
    const beforeResponseSet = new Set(beforeResponseSnapshot?.signatures || []);
    const hasCapabilityError = (text) => {
      const normalized = String(text || '').toLowerCase();
      return normalized.includes('您登录了吗')
        || normalized.includes('无法为您创建任何图片')
        || normalized.includes('无法创建图片')
        || normalized.includes('cannot create images')
        || normalized.includes("can't create images")
        || normalized.includes('can’t create images')
        || normalized.includes('not logged in')
        || normalized.includes('sign in');
    };
    const isGeneratedMediaCandidate = (src, width, height) => {
      const lower = String(src || '').toLowerCase();
      return width >= 256
        && height >= 256
        && !lower.includes('gstatic.com')
        && !lower.includes('gemini_sparkle')
        && !lower.includes('.svg');
    };
    const collectResponseCandidates = () => {
      const seen = new Set();
      const candidates = [];
      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          if (seen.has(element)) continue;
          seen.add(element);
          const text = normalize(element.innerText || element.textContent || '');
          const hasMedia = Boolean(element.querySelector('img, video, canvas'));
          const hasSource = Array.from(element.querySelectorAll('button,a')).some((node) => {
            const label = normalize(`${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''}`);
            return label.includes('来源') || /source|download/i.test(label);
          });
          if (!text && !hasMedia && !hasSource) continue;
          candidates.push({
            element,
            signature: `${text.slice(0, 300)}|media:${element.querySelectorAll('img,video,canvas').length}|links:${element.querySelectorAll('a,button').length}`,
          });
        }
      }
      return candidates;
    };
    const collectVisibleMediaCandidates = (root, mediaType) => {
      if (mediaType === 'image') {
        return Array.from(root.querySelectorAll('img')).map((img) => {
          const box = img.getBoundingClientRect();
          const width = img.naturalWidth || box.width;
          const height = img.naturalHeight || box.height;
          const src = img.currentSrc || img.src || '';
          return {
            signature: `${src}|${Math.round(width)}x${Math.round(height)}`,
            visible: isGeneratedMediaCandidate(src, width, height) && box.width > 0 && box.height > 0,
          };
        }).filter((item) => item.visible);
      }

      return Array.from(root.querySelectorAll('video')).map((video) => {
        const box = video.getBoundingClientRect();
        const src = video.currentSrc || video.src || video.querySelector?.('source[src]')?.src || '';
        return {
          signature: `${src}|${Math.round(video.videoWidth || box.width)}x${Math.round(video.videoHeight || box.height)}`,
          visible: box.width > 0 && box.height > 0 && Boolean(src),
        };
      }).filter((item) => item.visible);
    };
    const isGeminiStillGenerating = () => {
      const labels = Array.from(document.querySelectorAll('button, [aria-label], mat-icon'))
        .map((el) => `${el.getAttribute?.('aria-label') || ''} ${el.textContent || ''}`.toLowerCase())
        .join(' ');
      const bodyText = String(document.body?.innerText || '');
      const lowerBodyText = bodyText.toLowerCase();
      return labels.includes('stop')
        || labels.includes('停止')
        || labels.includes('cancel')
        || labels.includes('取消')
        || bodyText.includes('Gemini 正在输入')
        || bodyText.includes('正在加载 Nano Banana')
        || lowerBodyText.includes('assessing initial output')
        || lowerBodyText.includes('assessing output')
        || lowerBodyText.includes('verifying the image')
        || lowerBodyText.includes('verifying image')
        || lowerBodyText.includes('finalizing image')
        || lowerBodyText.includes('rendering image')
        || lowerBodyText.includes('gemini is typing');
    };

    const responseCandidates = collectResponseCandidates();
    let latestCandidate = responseCandidates.at(-1) || null;
    for (let index = responseCandidates.length - 1; index >= 0; index -= 1) {
      if (!beforeResponseSet.has(responseCandidates[index].signature)) {
        latestCandidate = responseCandidates[index];
        break;
      }
    }

    const latest = latestCandidate?.element || document.body;
    const text = normalize(latest.innerText || latest.textContent || '').slice(-500);
    const media = Array.from(latest.querySelectorAll(type === 'image' ? 'img' : 'video')).map((el) => el.currentSrc || el.src || '').join('|');
    const signature = `${text}\n${media}`;

    if (type === 'image') {
      if (hasCapabilityError(text)) return true;
      if (isGeminiStillGenerating()) return false;
      const hasSourceLinks = Array.from(latest.querySelectorAll('button,a')).some((node) => {
        const label = normalize(`${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''}`);
        return label.includes('来源') || /source|download/i.test(label);
      });
      if (hasSourceLinks) return true;
      return collectVisibleMediaCandidates(latest, type).some((item) => !beforeSet.has(item.signature));
    }

    if (type === 'video') {
      if (hasCapabilityError(text)) return true;
      if (isGeminiStillGenerating()) return false;
      return collectVisibleMediaCandidates(latest, type).some((item) => !beforeSet.has(item.signature));
    }

    if (isGeminiStillGenerating()) return false;
    return signature && signature !== beforeSignature;
  }, { type, beforeSignature, beforeMediaSignatures, beforeResponseSnapshot, selectors: RESPONSE_SELECTORS }, { timeout: timeoutMs });

  return await page.evaluate(async ({ type, submission, beforeMediaSignatures, beforeResponseSnapshot, selectors }) => {
    const normalize = (text) => String(text || '').replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim();
    const beforeSet = new Set(beforeMediaSignatures);
    const beforeResponseSet = new Set(beforeResponseSnapshot?.signatures || []);
    const isGeneratedMediaCandidate = (src, width, height) => {
      const lower = String(src || '').toLowerCase();
      return width >= 256
        && height >= 256
        && !lower.includes('gstatic.com')
        && !lower.includes('gemini_sparkle')
        && !lower.includes('.svg');
    };
    const fetchAsDataUrl = async (src) => {
      if (!src) return null;
      try {
        const response = await fetch(src);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.addEventListener('loadend', () => resolve(typeof reader.result === 'string' ? reader.result : null), { once: true });
          reader.addEventListener('error', () => resolve(null), { once: true });
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };
    const collectResponseCandidates = () => {
      const seen = new Set();
      const candidates = [];
      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          if (seen.has(element)) continue;
          seen.add(element);
          const text = normalize(element.innerText || element.textContent || '');
          const hasMedia = Boolean(element.querySelector('img, video, canvas'));
          const hasSource = Array.from(element.querySelectorAll('button,a')).some((node) => {
            const label = normalize(`${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''}`);
            return label.includes('来源') || /source|download/i.test(label);
          });
          if (!text && !hasMedia && !hasSource) continue;
          candidates.push({
            element,
            signature: `${text.slice(0, 300)}|media:${element.querySelectorAll('img,video,canvas').length}|links:${element.querySelectorAll('a,button').length}`,
          });
        }
      }
      return candidates;
    };

    const responseCandidates = collectResponseCandidates();
    let latestCandidate = responseCandidates.at(-1) || null;
    for (let index = responseCandidates.length - 1; index >= 0; index -= 1) {
      if (!beforeResponseSet.has(responseCandidates[index].signature)) {
        latestCandidate = responseCandidates[index];
        break;
      }
    }
    const latest = latestCandidate?.element || document.body;

    const text = normalize(latest.innerText || latest.textContent || '');
    const codeBlocks = Array.from(latest.querySelectorAll('pre, code-block, .code-block')).map((el) => normalize(el.innerText || el.textContent || '')).filter(Boolean);
    const media = [];
    const sourceLinks = Array.from(latest.querySelectorAll('button,a')).map((node) => {
      return normalize(`${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''}`);
    }).filter((label) => label.includes('来源') || /source|download/i.test(label));

    if (type === 'image') {
      const images = Array.from(latest.querySelectorAll('img')).filter((img) => {
        const box = img.getBoundingClientRect();
        const width = img.naturalWidth || box.width;
        const height = img.naturalHeight || box.height;
        const src = img.currentSrc || img.src || '';
        const signature = `${src}|${Math.round(width)}x${Math.round(height)}`;
        return isGeneratedMediaCandidate(src, width, height) && box.width > 0 && box.height > 0 && !beforeSet.has(signature);
      });
      for (const [index, img] of images.entries()) {
        let dataUrl = null;
        const src = img.currentSrc || img.src;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            dataUrl = canvas.toDataURL('image/png');
          }
        } catch {}
        if (!dataUrl) dataUrl = await fetchAsDataUrl(src);
        media.push({ kind: 'image', index, url: src, width: img.naturalWidth, height: img.naturalHeight, dataUrl });
      }

      const canvases = Array.from(latest.querySelectorAll('canvas')).filter((canvas) => {
        const box = canvas.getBoundingClientRect();
        return canvas.width >= 256 && canvas.height >= 256 && box.width > 0 && box.height > 0;
      });
      for (const [index, canvas] of canvases.entries()) {
        let dataUrl = null;
        try {
          dataUrl = canvas.toDataURL('image/png');
        } catch {}
        media.push({ kind: 'image', index: images.length + index, url: '', width: canvas.width, height: canvas.height, dataUrl });
      }

      const styledElements = [latest, ...Array.from(latest.querySelectorAll('*'))].filter((element) => {
        const box = element.getBoundingClientRect?.();
        if (!box || box.width < 256 || box.height < 256) return false;
        const backgroundImage = getComputedStyle(element).backgroundImage || '';
        return backgroundImage && backgroundImage !== 'none';
      });
      for (const [index, element] of styledElements.entries()) {
        const backgroundImage = getComputedStyle(element).backgroundImage || '';
        const match = backgroundImage.match(/url\(["']?(.*?)["']?\)/i);
        const src = match?.[1] || '';
        if (!src) continue;
        const dataUrl = await fetchAsDataUrl(src);
        media.push({
          kind: 'image',
          index: images.length + canvases.length + index,
          url: src,
          width: Math.round(element.getBoundingClientRect().width),
          height: Math.round(element.getBoundingClientRect().height),
          dataUrl,
        });
      }
    }

    if (type === 'video') {
      const videos = Array.from(latest.querySelectorAll('video')).filter((video) => {
        const box = video.getBoundingClientRect();
        const src = video.currentSrc || video.src || video.querySelector?.('source[src]')?.src || '';
        const signature = `${src}|${Math.round(video.videoWidth || box.width)}x${Math.round(video.videoHeight || box.height)}`;
        return box.width > 0 && box.height > 0 && Boolean(src) && !beforeSet.has(signature);
      });
      for (const [index, video] of videos.entries()) {
        const src = video.currentSrc || video.src || video.querySelector?.('source[src]')?.src || '';
        const dataUrl = await fetchAsDataUrl(src);
        media.push({ kind: 'video', index, url: src, width: video.videoWidth, height: video.videoHeight, duration: Number.isFinite(video.duration) ? video.duration : null, dataUrl });
      }
    }

    return {
      text,
      codeBlocks,
      media,
      files: [],
      raw: { url: location.href, capturedAt: new Date().toISOString(), submission, sourceLinks },
    };
  }, { type, submission, beforeMediaSignatures, beforeResponseSnapshot, selectors: RESPONSE_SELECTORS });
}
