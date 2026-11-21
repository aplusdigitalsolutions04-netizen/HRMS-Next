// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { getConfig } from './app-config';

// Too many wrong passwords lock the login for a while: some wrong tries for one email, or more from one address (which stops one
// machine trying many emails). The numbers and the lock time are set in Settings > Rules & Limits. The lock ends by itself; a right
// password clears the count.

export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim().slice(0, 60);
// When the server cannot tell the caller's address ('unknown'), everybody would share one counter and a few wrong tries by one
// person would lock the login for all. Then only the per-email counter is used.
const keysFor = (email: string, ip: string) => {
  const keys = [`u:${String(email || '').toLowerCase().slice(0, 150)}`];
  if (ip && ip !== 'unknown') keys.push(`i:${ip}`);
  return keys;
};

// minutes still to wait, or 0
export async function lockedMinutes(email: string, ip: string): Promise<number> {
  try {
    const rows = await query<RowDataPacket[]>('SELECT locked_until FROM login_attempts WHERE attempt_key IN (' + keysFor(email, ip).map(() => '?').join(',') + ') AND locked_until > NOW()', keysFor(email, ip));
    if (rows.length === 0) return 0;
    const until = Math.max(...rows.map(r => new Date(r.locked_until).getTime()));
    return Math.max(1, Math.ceil((until - Date.now()) / 60000));
  } catch { return 0; }
}

export async function recordFailure(email: string, ip: string) {
  try {
    const cfg = await getConfig();
    const MAX_PER_EMAIL = Math.floor(cfg.login_max_per_email), MAX_PER_IP = Math.floor(cfg.login_max_per_ip), LOCK_MINUTES = Math.floor(cfg.login_lock_minutes), WINDOW_MINUTES = Math.floor(cfg.login_window_minutes);
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
