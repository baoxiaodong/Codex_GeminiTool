import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { backupSqliteDatabase } from '../src/sqlite-copy.mjs';

test('backs up sqlite database file to a new destination', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sqlite-backup-test-'));
  try {
    const src = path.join(root, 'src.db');
    const dst = path.join(root, 'nested', 'dst.db');

    await writeFile(path.join(root, 'seed.py'), `import sqlite3\nconn=sqlite3.connect(r'${src.replace(/\\/g, '\\\\')}')\ncur=conn.cursor()\ncur.execute(\"create table demo(id integer primary key, name text)\")\ncur.execute(\"insert into demo(name) values('gemini')\")\nconn.commit()\nconn.close()\n`, 'utf8');
    const { execFileSync } = await import('node:child_process');
    execFileSync('python', [path.join(root, 'seed.py')]);

    await backupSqliteDatabase(src, dst);

    await writeFile(path.join(root, 'verify.py'), `import sqlite3\nconn=sqlite3.connect(r'${dst.replace(/\\/g, '\\\\')}')\ncur=conn.cursor()\ncur.execute('select name from demo limit 1')\nrow=cur.fetchone()\nprint(row[0])\nconn.close()\n`, 'utf8');
    const output = execFileSync('python', [path.join(root, 'verify.py')], { encoding: 'utf8' }).trim();
    assert.equal(output, 'gemini');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
