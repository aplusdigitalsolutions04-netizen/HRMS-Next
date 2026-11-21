// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { revisionReasons } from '@/lib/salary-history';

// Salary revision history (HR who can see payroll). GET ?emp_code= &reason= &search= &page= &per_page=
// Every row: who, from which date, why, the monthly pay before and after, and the structure before and after.
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_payroll')) return jsonError('Insufficient permissions', 403);

    const sp = new URL(req.url).searchParams;
    const { page, perPage, offset } = parsePagination(sp, 10, 100);
    let where = 'WHERE 1=1'; const params: any[] = [];
    const code = sp.get('emp_code') || '', reason = sp.get('reason') || '', search = (sp.get('search') || '').trim();
    if (code) { where += ' AND r.emp_code = ?'; params.push(code); }
    if ((await revisionReasons()).includes(reason)) { where += ' AND r.reason = ?'; params.push(reason); }
    if (search) { where += ' AND (e.full_name LIKE ? OR r.emp_code LIKE ?)'; const q = `%${search}%`; params.push(q, q); }

    const from = 'FROM salary_revisions r LEFT JOIN employees e ON e.emp_code = r.emp_code';
    const total = (await query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from} ${where}`, params))[0].n;
    const rows = await query<RowDataPacket[]>(
      `SELECT r.id, r.emp_code, e.full_name, e.designation, DATE_FORMAT(r.effective_from, '%Y-%m-%d') AS effective_from, r.reason, r.note, r.old_total, r.new_total, r.old_json, r.new_json, r.revised_by, r.created_at
       ${from} ${where} ORDER BY r.effective_from DESC, r.id DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    const parse = (t: any) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };
    return jsonSuccess({
      revisions: rows.map(r => ({
        ...r, old_json: undefined, new_json: undefined, old: parse(r.old_json), new: parse(r.new_json),
        change: r.old_total ? Math.round(((r.new_total - r.old_total) / r.old_total) * 10000) / 100 : null,
      })),
      total, page, per_page: perPage, reasons: await revisionReasons(),
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
