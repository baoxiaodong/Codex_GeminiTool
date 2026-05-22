import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function backupSqliteDatabase(src, dst) {
  await mkdir(path.dirname(dst), { recursive: true });

  const script = [
    'import sqlite3',
    `src = r"${String(src).replace(/\\/g, '\\\\')}"`,
    `dst = r"${String(dst).replace(/\\/g, '\\\\')}"`,
    'src_conn = sqlite3.connect(f"file:{src}?mode=ro", uri=True)',
    'dst_conn = sqlite3.connect(dst)',
    'src_conn.backup(dst_conn)',
    'dst_conn.close()',
    'src_conn.close()',
    'print("SQLITE_BACKUP_OK")',
  ].join('\n');

  const { stdout } = await execFileAsync('python', ['-c', script], { windowsHide: true });
  if (!stdout.includes('SQLITE_BACKUP_OK')) {
    throw new Error(`SQLite backup did not report success for ${src}`);
  }
}
