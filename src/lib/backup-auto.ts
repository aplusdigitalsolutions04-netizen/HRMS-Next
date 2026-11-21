// @ts-nocheck
import { createWriteStream, createReadStream, mkdirSync, readdirSync, statSync, unlinkSync, renameSync, existsSync } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';
import path from 'path';
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { sqlDumpStream, rowCounts } from './backup';

// Automatic backups: the same full .sql dump as the manual download, compressed (.sql.gz) and kept in the storage/backups folder on the
// server. The schedule (daily or weekly, at an hour, how many files to keep) is set on the Backup & Export page. A backup can be tested
// afterwards: the file is read back and compared with the live tables, and, when the database user may create a scratch database,
// really restored into it.

const DIR = path.join(process.cwd(), 'storage', 'backups');
const g: any = globalThis;
export const NAME_RE = /^hrms-(auto|manual)-\d{4}-\d{2}-\d{2}-\d{4}\.sql\.gz$/;

async function getKeys(keys: string[]): Promise<Record<string, string>> {
  const rows = await query<RowDataPacket[]>(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`, keys);
  const m: Record<string, string> = {};
  rows.forEach(r => { m[r.setting_key] = r.setting_value; });
  return m;
}
async function setKey(key: string, value: string) {
  const rows = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
  if (rows.length > 0) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [value, key]);
  else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [key, value]);
}

export interface Schedule { on: boolean; frequency: 'daily' | 'weekly'; hour: number; weekday: number; keep: number; last_at: string; last_status: string }
const KEYS = ['backup_auto_on', 'backup_auto_frequency', 'backup_auto_hour', 'backup_auto_weekday', 'backup_auto_keep', 'backup_auto_last', 'backup_auto_status'];

export async function getSchedule(): Promise<Schedule> {
  const m = await getKeys(KEYS);
  const n = (v: any, d: number, lo: number, hi: number) => { const x = Number(v); return Number.isFinite(x) && v !== undefined && v !== '' ? Math.min(hi, Math.max(lo, Math.round(x))) : d; };
  return {
    on: m.backup_auto_on === '1', frequency: m.backup_auto_frequency === 'weekly' ? 'weekly' : 'daily',
    hour: n(m.backup_auto_hour, 2, 0, 23), weekday: n(m.backup_auto_weekday, 0, 0, 6), keep: n(m.backup_auto_keep, 7, 1, 60),
    last_at: m.backup_auto_last || '', last_status: m.backup_auto_status || '',
  };
}

export async function saveSchedule(b: any): Promise<Schedule> {
  const cur = await getSchedule();
  const num = (v: any, lo: number, hi: number, d: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d; };
  if (b.on !== undefined) await setKey('backup_auto_on', b.on ? '1' : '0');
  if (b.frequency !== undefined) await setKey('backup_auto_frequency', b.frequency === 'weekly' ? 'weekly' : 'daily');
  if (b.hour !== undefined) await setKey('backup_auto_hour', String(num(b.hour, 0, 23, cur.hour)));
  if (b.weekday !== undefined) await setKey('backup_auto_weekday', String(num(b.weekday, 0, 6, cur.weekday)));
  if (b.keep !== undefined) await setKey('backup_auto_keep', String(num(b.keep, 1, 60, cur.keep)));
  return getSchedule();
}

export interface BackupFile { name: string; size: number; created: string; kind: 'auto' | 'manual' }
export function listBackups(): BackupFile[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR).filter(f => NAME_RE.test(f)).map(f => {
    const st = statSync(path.join(DIR, f));
    return { name: f, size: st.size, created: st.mtime.toISOString(), kind: f.includes('-auto-') ? 'auto' : 'manual' } as BackupFile;
  }).sort((a, b) => b.created.localeCompare(a.created));
}
export function backupPath(name: string): string | null { return NAME_RE.test(name) && existsSync(path.join(DIR, name)) ? path.join(DIR, name) : null; }
export function deleteBackup(name: string): boolean { const p = backupPath(name); if (!p) return false; unlinkSync(p); return true; }

function pruneOld(keep: number) {
  // only the automatic ones are rotated; a manual backup is kept until someone deletes it
  const autos = listBackups().filter(f => f.kind === 'auto');
  autos.slice(keep).forEach(f => { try { unlinkSync(path.join(DIR, f.name)); } catch { /* ignore */ } });
}

const stamp = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

// the file ends with the "End of backup" line and has no failure marker
async function looksComplete(file: string): Promise<boolean> {
  let sawEnd = false, failed = false;
  const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) { if (line.startsWith('-- BACKUP FAILED')) failed = true; if (line.startsWith('-- End of backup')) sawEnd = true; }
  return sawEnd && !failed;
}

export async function runBackupToFile(kind: 'auto' | 'manual', by: string): Promise<{ name: string; size: number }> {
  mkdirSync(DIR, { recursive: true });
  const name = `hrms-${kind}-${stamp()}.sql.gz`;
  const final = path.join(DIR, name), tmp = final + '.tmp';
  try {
    await pipeline(Readable.fromWeb(sqlDumpStream() as any), createGzip(), createWriteStream(tmp));
    if (!(await looksComplete(tmp))) throw new Error('The backup file came out incomplete');
    renameSync(tmp, final);
  } catch (e) { try { unlinkSync(tmp); } catch { /* ignore */ } throw e; }
  await setKey('last_backup_at', new Date().toISOString());
  await setKey('last_backup_kind', `Saved on the server (${kind}) by ${by}`);
  pruneOld((await getSchedule()).keep);
  return { name, size: statSync(final).size };
}

// ---- restore test ----
export interface VerifyResult { ok: boolean; name: string; complete: boolean; tables: number; rows: number; compare: { table: string; backup: number; now: number }[]; deep: { done: boolean; ok?: boolean; note: string }; notes: string[] }

export async function verifyBackup(name: string, deep = true): Promise<VerifyResult> {
  const file = backupPath(name);
  if (!file) throw new Error('Backup file not found');
  const counts: Record<string, number> = {};
  const created = new Set<string>();
  let complete = false, failedMarker = false, cur = '';
  const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.startsWith('-- Table: ')) { cur = line.slice(10).trim(); counts[cur] = 0; }
    else if (line.startsWith('CREATE TABLE')) created.add(cur);
    else if (line.startsWith('(') && cur) counts[cur]++;
    else if (line.startsWith('INSERT INTO') && line.includes('VALUES') && !line.trimEnd().endsWith('VALUES') && cur) counts[cur]++;   // a one-row insert written on one line
    else if (line.startsWith('-- BACKUP FAILED')) failedMarker = true;
    else if (line.startsWith('-- End of backup')) complete = true;
  }
  const live = await rowCounts();
  const liveMap: Record<string, number> = {}; live.forEach(x => { liveMap[x.table] = x.rows; });
  const compare = Object.keys(counts).map(t => ({ table: t, backup: counts[t], now: liveMap[t] ?? 0 }));
  const notes: string[] = [];
  const missing = live.filter(x => !(x.table in counts)).map(x => x.table);
  if (missing.length) notes.push(`Tables that exist now but are not in this backup: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
  const noCreate = Object.keys(counts).filter(t => !created.has(t));
  if (noCreate.length) notes.push(`No table definition found for: ${noCreate.join(', ')}`);
  const rows = Object.values(counts).reduce((a, b) => a + b, 0);
  const res: VerifyResult = { ok: complete && !failedMarker && noCreate.length === 0, name, complete: complete && !failedMarker, tables: Object.keys(counts).length, rows, compare, deep: { done: false, note: 'Not tried' }, notes };
  if (!res.ok) return res;
  if (deep) {
    try { res.deep = await restoreIntoScratch(file, counts); if (res.deep.done && !res.deep.ok) res.ok = false; }
    catch (e: any) { res.deep = { done: false, note: 'The restore test could not run: ' + (e?.message || e) }; }
  }
  return res;
}

// Restore the file into a throw-away database next to the real one, count the rows, and drop it again. The real tables are never touched:
// the connection is bound to the scratch database, and the dump never writes a database name.
async function restoreIntoScratch(file: string, expected: Record<string, number>): Promise<{ done: boolean; ok?: boolean; note: string }> {
  const mysql = require('mysql2/promise');
  const real = process.env.MYSQL_DB || 'HR';
  const scratch = `${real}_restore_test`.replace(/[^\w]/g, '_');
  if (scratch === real) return { done: false, note: 'Skipped: no safe scratch database name' };
  const MAX = 64 * 1024 * 1024;
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of createReadStream(file).pipe(createGunzip())) { size += c.length; if (size > MAX) return { done: false, note: 'Skipped: the backup is too large for an in-app restore test. Test it from the command line.' }; chunks.push(c as Buffer); }
  const sql = Buffer.concat(chunks).toString('utf8');
  const conn = await mysql.createConnection({ host: process.env.MYSQL_HOST || 'localhost', user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD, multipleStatements: true, charset: 'utf8mb4' });
  try {
    try { await conn.query(`DROP DATABASE IF EXISTS \`${scratch}\``); await conn.query(`CREATE DATABASE \`${scratch}\` CHARACTER SET utf8mb4`); }
    catch (e: any) { return { done: false, note: 'Skipped: this database user may not create a test database. The file itself was checked and is complete.' }; }
    try {
      await conn.query(`USE \`${scratch}\``);
      await conn.query(sql);
      const bad: string[] = [];
      for (const [t, n] of Object.entries(expected)) {
        const [r] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
        if (Number(r[0].n) !== n) bad.push(`${t} (${r[0].n} of ${n})`);
      }
      return bad.length ? { done: true, ok: false, note: 'Restored, but row counts differ: ' + bad.slice(0, 6).join(', ') } : { done: true, ok: true, note: `Restored into a scratch database and every table has the rows the file says (${Object.keys(expected).length} tables). The scratch copy was removed.` };
    } catch (e: any) { return { done: true, ok: false, note: 'The restore failed: ' + String(e?.message || e).slice(0, 200) }; }
    finally { await conn.query(`DROP DATABASE IF EXISTS \`${scratch}\``).catch(() => { }); }
  } finally { await conn.end().catch(() => { }); }
}

// ---- the schedule ----
export async function runDueBackup(): Promise<string | null> {
  const s = await getSchedule();
  if (!s.on) return null;
  const now = new Date();
  if (s.frequency === 'weekly' && now.getDay() !== s.weekday) return null;
  const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.hour, 0, 0);
  if (now < slot) return null;
  if (s.last_at && new Date(s.last_at) >= slot) return null;
  // mark first, so a slow or failing backup is not started again by the next check
  await setKey('backup_auto_last', now.toISOString());
  try {
    const r = await runBackupToFile('auto', 'schedule');
    await setKey('backup_auto_status', `OK: ${r.name} (${Math.round(r.size / 1024)} KB)`);
    return r.name;
  } catch (e: any) {
    await setKey('backup_auto_status', 'FAILED: ' + String(e?.message || e).slice(0, 200));
    throw e;
  }
}

export function startBackupJob() {
  if (g.__backupJobStarted) return;
  g.__backupJobStarted = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { const n = await runDueBackup(); if (n) console.log('[backup-auto] saved', n); }
    catch (e: any) { console.error('[backup-auto] failed:', e?.message || e); }
    finally { running = false; }
  };
  setTimeout(tick, 2 * 60_000);
  setInterval(tick, 10 * 60_000);
  console.log('[backup-auto] started');
}
