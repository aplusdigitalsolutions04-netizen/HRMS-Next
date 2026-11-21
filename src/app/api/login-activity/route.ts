// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, parsePagination } from '@/lib/utils';
import { decodeToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { deviceName, revokeSession, revokeOthers } from '@/lib/login-history';
import { auditFrom } from '@/lib/audit';
import { RowDataPacket } from 'mysql2';

// Login activity: who signed in, from where, and which sessions are open.
//   GET  ?scope=mine|all&page=&per_page=&status=ok|failed   (all = administrator only)
//   POST { action: 'revoke', id }  or  { action: 'revoke_others' }
const tokenSid = (req: NextRequest) => { const a = req.headers.get('authorization'); return a?.startsWith('Bearer ') ? (decodeToken(a.slice(7)) as any)?.sid || null : null; };
const isAdmin = (u: any) => u?.type === 'admin' && u?.role === 'ADMIN';
const shape = (r: any) => ({ id: r.id, email: r.email, user_type: r.user_type, ip: r.ip, device: deviceName(r.user_agent), ok: !!r.ok, reason: r.reason, created_at: r.created_at, last_seen: r.last_seen, expires_at: r.expires_at, revoked_at: r.revoked_at, sid: r.sid });

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const sp = new URL(req.url).searchParams;
    const all = sp.get('scope') === 'all';
    if (all && !isAdmin(user)) return jsonError('Only the administrator can see everyone\'s logins', 403);
    const { page, perPage, offset } = parsePagination(sp, 25, 100);
    const status = sp.get('status');
    const search = String(sp.get('search') || '').trim().slice(0, 100);

    // own rows: made by this person; failed tries are matched by the email they were tried on
    const scope = all ? '1=1' : '((user_type = ? AND user_id = ?) OR (ok = 0 AND LOWER(email) = LOWER(?)))';
    const scopeP = all ? [] : [user.type, String(user.id), user.email];
    const where = [scope]; const params = [...scopeP];
    if (status === 'ok') where.push('ok = 1'); else if (status === 'failed') where.push('ok = 0');
    if (search) { where.push('(email LIKE ? OR ip LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const total = Number((await query<RowDataPacket[]>(`SELECT COUNT(*) n FROM login_history WHERE ${where.join(' AND ')}`, params))[0].n);
    const history = await query<RowDataPacket[]>(`SELECT * FROM login_history WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    const open = await query<RowDataPacket[]>(`SELECT * FROM login_history WHERE ${scope} AND ok = 1 AND revoked_at IS NULL AND expires_at > NOW() ORDER BY COALESCE(last_seen, created_at) DESC LIMIT 200`, scopeP);
    const failed24 = Number((await query<RowDataPacket[]>(`SELECT COUNT(*) n FROM login_history WHERE ${scope} AND ok = 0 AND created_at > NOW() - INTERVAL 1 DAY`, scopeP))[0].n);
    return jsonSuccess({ current_sid: tokenSid(req), is_admin: isAdmin(user), sessions: open.map(shape), history: history.map(shape), total, page, per_page: perPage, failed_24h: failed24 });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const b = await req.json().catch(() => ({}));
    const me = tokenSid(req);
    if (b.action === 'revoke') {
      const rows = await query<RowDataPacket[]>('SELECT sid, email FROM login_history WHERE id = ?', [b.id]);
      if (rows.length && rows[0].sid && rows[0].sid === me) return jsonError('This is the session you are using. Use Logout to end it.', 400);
      const ok = await revokeSession(b.id, { type: user.type, id: String(user.id) }, isAdmin(user));
      if (!ok) return jsonError('Session not found, or it is already ended', 404);
      await auditFrom(user, 'session_revoked', 'login_history', String(b.id), { email: rows[0]?.email });
      return jsonSuccess({ message: 'Session ended' });
    }
    if (b.action === 'revoke_others') {
      const n = await revokeOthers(user.type, String(user.id), me);
      await auditFrom(user, 'sessions_revoked', 'login_history', String(user.id), { count: n });
      return jsonSuccess({ message: n ? `${n} other session${n > 1 ? 's' : ''} ended` : 'No other open sessions', count: n });
    }
    return jsonError('Unknown action', 400);
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
