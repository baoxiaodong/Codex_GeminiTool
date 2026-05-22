import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PANEL_PORT = Number(process.env.GEMINI_BRIDGE_PANEL_PORT ?? 9876);
const PANEL_HOST = process.env.GEMINI_BRIDGE_PANEL_HOST ?? '127.0.0.1';
const PANEL_URL = `http://127.0.0.1:${PANEL_PORT}/panel`;
const HEALTH_URL = `http://${PANEL_HOST}:${PANEL_PORT}/health`;

const outputRoot = process.env.GEMINI_BRIDGE_OUTPUT_ROOT
  ?? 'C:\\Users\\Administrator\\Desktop\\codex\\gemini';

console.log(`Codex Gemini Panel: ${PANEL_URL}`);

if (!(await isBridgeHealthy())) {
  console.log(`Bridge is not running on ${PANEL_HOST}:${PANEL_PORT}; starting it now...`);
  startBridge();
  await waitForHealth();
}

openUrl(PANEL_URL);
console.log('Panel opened. If the browser did not appear, open this URL manually:');
console.log(PANEL_URL);

async function isBridgeHealthy() {
  try {
    const response = await fetch(HEALTH_URL);
    if (!response.ok) return false;
    const payload = await response.json().catch(() => ({}));
    return payload.ok === true && payload.bridge === 'gemini-web-bridge';
  } catch {
    return false;
  }
}

function startBridge() {
  const child = spawn(process.execPath, ['src/bridge-server.mjs'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      GEMINI_BRIDGE_PORT: String(PANEL_PORT),
      GEMINI_BRIDGE_HOST: PANEL_HOST,
      GEMINI_BRIDGE_OUTPUT_ROOT: outputRoot,
    },
  });
  child.unref();
}

async function waitForHealth() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isBridgeHealthy()) return;
    await delay(500);
  }

  throw new Error(`Bridge did not become healthy in time: ${HEALTH_URL}`);
}

function openUrl(url) {
  if (process.platform === 'win32') {
    spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Start-Process ${JSON.stringify(url)}`,
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }

  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [url], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}
