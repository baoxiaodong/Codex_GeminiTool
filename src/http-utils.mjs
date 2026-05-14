export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, 'Request body must be valid JSON');
  }
}

export function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-gemini-bridge-token',
  });
  response.end(body);
}

export function sendError(response, error) {
  const statusCode = Number(error.statusCode ?? 500);
  sendJson(response, statusCode, {
    error: error.message ?? 'Internal bridge error',
  });
}

export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function requireToken(request, token) {
  if (!token) return;
  const provided = request.headers['x-gemini-bridge-token'];
  if (provided !== token) {
    throw httpError(401, 'Missing or invalid bridge token');
  }
}
