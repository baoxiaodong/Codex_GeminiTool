const BRIDGE_URL = process.env.GEMINI_BRIDGE_URL ?? 'http://127.0.0.1:8765';
const TOKEN = process.env.GEMINI_BRIDGE_TOKEN ?? '';

const endpoint = process.argv[2] ?? 'ask';
const prompt = process.argv.slice(3).join(' ').trim();

if (!['ask', 'code', 'image', 'video'].includes(endpoint)) {
  console.error('Usage: npm run ask -- "中文 prompt"');
  console.error('       npm run image -- "中文生图 prompt"');
  console.error('       npm run video -- "中文视频 prompt"');
  console.error('       npm run code -- "中文写代码需求"');
  process.exit(2);
}

if (!prompt) {
  console.error(`Missing prompt. Example: npm run ${endpoint} -- "你好，简单回复一句话"`);
  process.exit(2);
}

const waitMs = endpoint === 'video'
  ? 1800000
  : endpoint === 'image'
    ? 600000
    : 120000;

const wait = process.env.GEMINI_BRIDGE_CLI_WAIT === 'true';
const waitAckMs = Number(process.env.GEMINI_BRIDGE_CLI_WAIT_ACK_MS ?? 5000);

const response = await fetch(`${BRIDGE_URL}/${endpoint}`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    ...(TOKEN ? { 'x-gemini-bridge-token': TOKEN } : {}),
  },
  body: JSON.stringify({
    prompt,
    wait,
    waitMs: wait ? waitMs : undefined,
    waitAckMs: wait ? undefined : waitAckMs,
  }),
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
