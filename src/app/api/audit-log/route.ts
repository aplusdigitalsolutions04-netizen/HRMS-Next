// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Who changed what, and when. Read-only. ?from= &to= (dates) &action= &entity= &search=(person / record) &page= &per_page=
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_audit_log')) return jsonError('Insufficient permissions', 403);

    const sp = new URL(req.url).searchParams;
    const { page, perPage, offset } = parsePagination(sp, 25, 200);
    let where = 'WHERE 1=1'; const params: any[] = [];
    const from = sp.get('from') || '', to = sp.get('to') || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where += ' AND l.created_on >= ?'; params.push(from + ' 00:00:00'); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where += ' AND l.created_on <= ?'; params.push(to + ' 23:59:59'); }
    const action = sp.get('action') || '', entity = sp.get('entity') || '', search = (sp.get('search') || '').trim();
    if (action) { where += ' AND l.action = ?'; params.push(action); }
    if (entity) { where += ' AND l.entity_type = ?'; params.push(entity); }
    if (search) { where += ' AND (l.performed_by_email LIKE ? OR l.details LIKE ? OR l.entity_id LIKE ? OR e.full_name LIKE ?)'; const q = `%${search}%`; params.push(q, q, q, q); }

    const from_ = `FROM audit_logs l LEFT JOIN employees e ON l.entity_type = 'employee' AND e.id = l.entity_id`;
    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from_} ${where}`, params);
    const rows = await query<RowDataPacket[]>(
      `SELECT l.id, l.action, l.entity_type, l.entity_id, l.performed_by_email, l.details, l.created_on, e.full_name AS entity_name, e.emp_code AS entity_code
       ${from_} ${where} ORDER BY l.id DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    const actions = await query<RowDataPacket[]>('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    const entities = await query<RowDataPacket[]>('SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type');
    return jsonSuccess({
      logs: rows.map(r => { let d = null; try { d = r.details ? JSON.parse(r.details) : null; } catch { d = r.details; } return { ...r, details: d }; }),
      total: cnt[0].n, page, per_page: perPage,
      actions: actions.map(a => a.action), entities: entities.map(e => e.entity_type),
    });
  } catch (e: any) { return jsonError(e, 500); }
}
