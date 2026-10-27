// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

// Too many wrong passwords lock the login for a while: 5 wrong tries for one email, or 30 from one address (which stops one
// machine trying many emails). The lock ends by itself after LOCK_MINUTES; a right password clears the count.
const MAX_PER_EMAIL = 5, MAX_PER_IP = 30, LOCK_MINUTES = 15, WINDOW_MINUTES = 30;

export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim().slice(0, 60);
const keysFor = (email: string, ip: string) => [`u:${String(email || '').toLowerCase().slice(0, 150)}`, `i:${ip}`];

// minutes still to wait, or 0
export async function lockedMinutes(email: string, ip: string): Promise<number> {
  try {
    const rows = await query<RowDataPacket[]>('SELECT locked_until FROM login_attempts WHERE attempt_key IN (?,?) AND locked_until > NOW()', keysFor(email, ip));
    if (rows.length === 0) return 0;
    const until = Math.max(...rows.map(r => new Date(r.locked_until).getTime()));
    return Math.max(1, Math.ceil((until - Date.now()) / 60000));
  } catch { return 0; }
}

export async function recordFailure(email: string, ip: string) {
  try {
    for (const k of keysFor(email, ip)) {
      const max = k.startsWith('u:') ? MAX_PER_EMAIL : MAX_PER_IP;
      await execute(
        `INSERT INTO login_attempts (attempt_key, fails, last_attempt) VALUES (?,1,NOW())
         ON DUPLICATE KEY UPDATE fails = IF(last_attempt < NOW() - INTERVAL ${WINDOW_MINUTES} MINUTE, 1, fails + 1), last_attempt = NOW(), locked_until = NULL`, [k]);
      await execute(`UPDATE login_attempts SET locked_until = NOW() + INTERVAL ${LOCK_MINUTES} MINUTE, fails = 0 WHERE attempt_key = ? AND fails >= ?`, [k, max]);
    }
  } catch (e: any) { console.error('[login-guard]', e?.message || e); }
}

export async function clearFailures(email: string) {
  try { await execute('DELETE FROM login_attempts WHERE attempt_key = ?', [`u:${String(email || '').toLowerCase().slice(0, 150)}`]); } catch { /* ignore */ }
}
