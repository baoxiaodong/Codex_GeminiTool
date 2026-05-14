import path from 'node:path';

export function defaultOutputRoot() {
  return path.join(process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(), 'Desktop', 'codex', 'gemini');
}

export function resolveOutputPath(root, requestedPath) {
  const absoluteRoot = path.resolve(root);
  const absoluteTarget = path.resolve(absoluteRoot, requestedPath || '.');
  const relative = path.relative(absoluteRoot, absoluteTarget);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Output path escapes root: ${requestedPath}`);
  }

  return absoluteTarget;
}
