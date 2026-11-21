// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

// Login history and open sessions. Every sign-in (right or wrong) is a row in login_history. A right one carries the id (sid) that is
// also written into the token, so a session can be ended from the Login Activity page: the row is marked revoked and the next request
// with that token is refused. Tokens made before this existed carry no sid and simply keep working until they expire.

const KEEP_DAYS = 90;
let lastClean = 0;

// "Chrome on Windows" from a user agent text, short enough for a table cell
export function deviceName(ua: string): string {
  const s = String(ua || '');
  if (!s) return 'Unknown device';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Browser';
  const os = /Windows/.test(s) ? 'Windows' : /Android/.test(s) ? 'Android' : /iPhone|iPad|iOS/.test(s) ? 'iOS' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export async function recordLogin(o: { sid: string; userType: string; userId: string; email: string; ip: string; ua: string; expiresAt: Date }) {
  try {
    await execute(
      'INSERT INTO login_history (sid, user_type, user_id, email, ip, user_agent, ok, created_at, last_seen, expires_at) VALUES (?,?,?,?,?,?,1,NOW(),NOW(),?)',
      [o.sid, o.userType, String(o.userId), String(o.email).slice(0, 150), String(o.ip || '').slice(0, 60), String(o.ua || '').slice(0, 300), o.expiresAt]
    );
    if (Date.now() - lastClean > 3600_000) {
      lastClean = Date.now();
      await execute(`DELETE FROM login_history WHERE created_at < NOW() - INTERVAL ${KEEP_DAYS} DAY`).catch(() => { });
    }
  } catch (e: any) { console.error('[login-history]', e?.message || e); }
}

export async function recordFailedLogin(email: string, ip: string, ua: string, reason: string) {
  try {
    await execute(
      'INSERT INTO login_history (sid, user_type, user_id, email, ip, user_agent, ok, reason, created_at) VALUES (NULL,NULL,NULL,?,?,?,0,?,NOW())',
      [String(email || '').slice(0, 150), String(ip || '').slice(0, 60), String(ua || '').slice(0, 300), String(reason || '').slice(0, 100)]
    );
  } catch (e: any) { console.error('[login-history]', e?.message || e); }
}

// is this session still allowed? Checked on every request, so the answer is kept for a few seconds.
// kept on globalThis: every API route is its own bundle with its own copy of this file, and an ended session has to be seen by all of them at once
const G: any = globalThis;
const cache: Map<string, { revoked: boolean; at: number }> = (G.__sessionRevokeCache ||= new Map());
const touched: Map<string, number> = (G.__sessionTouched ||= new Map());
export async function sessionRevoked(sid: string): Promise<boolean> {
  const c = cache.get(sid);
  if (c && Date.now() - c.at < 15_000) return c.revoked;
  try {
    const rows = await query<RowDataPacket[]>('SELECT revoked_at FROM login_history WHERE sid = ?', [sid]);
    const revoked = rows.length > 0 && !!rows[0].revoked_at;
    cache.set(sid, { revoked, at: Date.now() });
    if (cache.size > 5000) cache.clear();
    if (!revoked && rows.length > 0 && Date.now() - (touched.get(sid) || 0) > 60_000) {
      touched.set(sid, Date.now());
      if (touched.size > 5000) touched.clear();
      execute('UPDATE login_history SET last_seen = NOW() WHERE sid = ?', [sid]).catch(() => { });
    }
    return revoked;
  } catch { return false; }
}

export async function revokeSession(id: number | string, by: { type: string; id: string }, isAdmin: boolean): Promise<boolean> {
  const rows = await query<RowDataPacket[]>('SELECT id, sid, user_type, user_id FROM login_history WHERE id = ? AND ok = 1 AND revoked_at IS NULL', [id]);
  if (rows.length === 0) return false;
  const r = rows[0];
  if (!isAdmin && !(String(r.user_id) === String(by.id) && r.user_type === by.type)) return false;
  await execute('UPDATE login_history SET revoked_at = NOW() WHERE id = ?', [r.id]);
  cache.set(r.sid, { revoked: true, at: Date.now() });
  return true;
}

// every open session of one person except the one making the request
export async function revokeOthers(userType: string, userId: string, keepSid: string | null): Promise<number> {
  const rows = await query<RowDataPacket[]>('SELECT sid FROM login_history WHERE ok = 1 AND revoked_at IS NULL AND expires_at > NOW() AND user_type = ? AND user_id = ? AND (? IS NULL OR sid <> ?)', [userType, String(userId), keepSid, keepSid]);
  if (rows.length === 0) return 0;
  await execute('UPDATE login_history SET revoked_at = NOW() WHERE ok = 1 AND revoked_at IS NULL AND expires_at > NOW() AND user_type = ? AND user_id = ? AND (? IS NULL OR sid <> ?)', [userType, String(userId), keepSid, keepSid]);
  rows.forEach(r => cache.set(r.sid, { revoked: true, at: Date.now() }));
  return rows.length;
}

// The user signing out ends their own session too
export async function endSession(sid: string) {
  try { await execute('UPDATE login_history SET revoked_at = NOW() WHERE sid = ? AND revoked_at IS NULL', [sid]); cache.set(sid, { revoked: true, at: Date.now() }); } catch { /* ignore */ }
}
