// @ts-nocheck
import { NextRequest } from 'next/server';
import { getConfig } from '@/lib/app-config';
import { withApiLog } from '@/lib/api-log';
import { getAuthUser, jsonError, jsonSuccess, parsePagination } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// API Logs (ADMIN only). The calls themselves are written by lib/api-log.ts.
// GET    ?page= &per_page= &search= (path, person, error) &method= &outcome=ok|error|slow &source= &status= &from= &to= (dates)
// DELETE ?older_than_days=N  (or ?all=1)  - removes entries by hand; the automatic clean-up uses the days set in Settings.
const adminOnly = (user: any) => user && user.type === 'admin' && user.role === 'ADMIN';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!adminOnly(user)) return jsonError('Only the administrator can see the API logs.', 403);

    const sp = new URL(req.url).searchParams;
    const slowMs = (await getConfig()).api_slow_ms;
    const { page, perPage, offset } = parsePagination(sp, 25, 200);
    let where = 'WHERE 1=1'; const params: any[] = [];
    const from = sp.get('from') || '', to = sp.get('to') || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where += ' AND created_at >= ?'; params.push(from + ' 00:00:00'); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where += ' AND created_at <= ?'; params.push(to + ' 23:59:59'); }
    const method = (sp.get('method') || '').toUpperCase(), source = sp.get('source') || '', outcome = sp.get('outcome') || '', status = parseInt(sp.get('status') || '');
    const search = (sp.get('search') || '').trim();
    if (method) { where += ' AND method = ?'; params.push(method); }
    if (source) { where += ' AND source = ?'; params.push(source); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (outcome === 'error') where += ' AND (status >= 400 OR source = \'browser\')';
    else if (outcome === 'ok') where += ' AND status < 400';
    else if (outcome === 'slow') { where += ' AND duration_ms >= ?'; params.push(slowMs); }
    if (search) { where += ' AND (path LIKE ? OR user_email LIKE ? OR error_message LIKE ? OR ref = ?)'; const q = `%${search}%`; params.push(q, q, q, search); }

    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM api_logs ${where}`, params);
    const rows = await query<RowDataPacket[]>(
      `SELECT id, ref, created_at, source, method, path, query_string, status, duration_ms, user_type, user_email, ip, user_agent, request_body, error_message, error_detail
       FROM api_logs ${where} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    const sum = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, SUM(status >= 400 OR source = 'browser') AS errors, SUM(duration_ms >= ?) AS slow FROM api_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`, [slowMs]);
    return jsonSuccess({
      logs: rows, slow_ms: slowMs, total: cnt[0].n, page, per_page: perPage,
      last_24h: { total: Number(sum[0].total) || 0, errors: Number(sum[0].errors) || 0, slow: Number(sum[0].slow) || 0 },
    });
  } catch (e: any) { return jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!adminOnly(user)) return jsonError('Only the administrator can delete the API logs.', 403);
    const sp = new URL(req.url).searchParams;
    let removed = 0;
    if (sp.get('all') === '1') {
      removed = (await execute('DELETE FROM api_logs')).affectedRows;
    } else {
      const days = parseInt(sp.get('older_than_days') || '');
      if (!(days >= 1)) return jsonError('Say how many days of entries to keep', 422);
      removed = (await execute('DELETE FROM api_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [days])).affectedRows;
    }
    return jsonSuccess({ removed, message: `Deleted ${removed} log entr${removed === 1 ? 'y' : 'ies'}.` });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const DELETE = withApiLog(DELETE_handler);
