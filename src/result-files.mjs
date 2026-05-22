import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveOutputPath } from './output-paths.mjs';

export async function saveCodeResultFiles(root, taskId, result) {
  const files = [];
  const text = usableResultText(result?.text);
  const codeBlocks = Array.isArray(result?.codeBlocks)
    ? deduplicateCodeBlocks(result.codeBlocks.filter((block) => typeof block === 'string' && block.trim()))
    : [];

  if (!text && codeBlocks.length === 0) {
    return files;
  }

  if (text) {
    const relativePath = path.join('code', `${taskId}.md`);
    const outputPath = resolveOutputPath(root, relativePath);
    await writeTextFile(outputPath, `${text}\n`);
    files.push({
      kind: 'code',
      mimeType: 'text/markdown',
      path: outputPath,
    });

    return files;
  }

  for (const [index, block] of codeBlocks.entries()) {
    const extension = extensionForCodeBlock(block);
    const relativePath = path.join('code', `${taskId}-code-${index}.${extension}`);
    const outputPath = resolveOutputPath(root, relativePath);
    await writeTextFile(outputPath, `${block.trim()}\n`);
    files.push({
      kind: 'code',
      mimeType: mimeTypeForExtension(extension),
      path: outputPath,
    });
  }

  return files;
}

function deduplicateCodeBlocks(blocks) {
  const seen = new Set();
  const unique = [];

  for (const block of blocks) {
    const key = canonicalCodeBlock(block);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(block);
  }

  return unique;
}

function canonicalCodeBlock(block) {
  return String(block || '')
    .trim()
    .replace(/^(xml|html|yaml|yml|java|javascript|js|jsx|typescript|ts|tsx|python|py|sql|json|bash|shell|sh|css|markdown|md)\s*\r?\n/i, '')
    .trim()
    .replace(/\r\n/g, '\n');
}

function usableResultText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (/^Gemini\s*(说|says)?\s*$/i.test(text)) return '';
  return text;
}

async function writeTextFile(outputPath, text) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, text, 'utf8');
}

function extensionForCodeBlock(block) {
  const text = block.trim();
  const firstLine = text.split(/\r?\n/, 1)[0]?.trim().toLowerCase() ?? '';

  if (/^(python|py)\b/.test(firstLine) || looksLikePython(text)) return 'py';
  if (/^(javascript|js|jsx|typescript|ts|tsx)\b/.test(firstLine) || looksLikeJavaScript(text)) return 'js';
  if (/^(bash|shell|sh|powershell|ps1)\b/.test(firstLine)) return 'sh';
  if (/^(json)\b/.test(firstLine) || looksLikeJson(text)) return 'json';
  if (/^(markdown|md)\b/.test(firstLine)) return 'md';
  if (/^(html)\b/.test(firstLine) || /<\/?[a-z][\s\S]*>/i.test(text)) return 'html';
  if (/^(css)\b/.test(firstLine)) return 'css';

  return 'txt';
}

function looksLikePython(text) {
  return /(^|\n)\s*(from\s+\S+\s+import\s+|import\s+\S+|def\s+\w+\(|class\s+\w+[:(]|\w+\s*\([^)]*\))/m.test(text);
}

function looksLikeJavaScript(text) {
  return /(^|\n)\s*(const|let|var|import|export|function)\s+/m.test(text);
}

function looksLikeJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function mimeTypeForExtension(extension) {
  if (extension === 'py') return 'text/x-python';
  if (extension === 'js') return 'text/javascript';
  if (extension === 'sh') return 'text/x-shellscript';
  if (extension === 'json') return 'application/json';
  if (extension === 'md') return 'text/markdown';
  if (extension === 'html') return 'text/html';
  if (extension === 'css') return 'text/css';
  return 'text/plain';
}
