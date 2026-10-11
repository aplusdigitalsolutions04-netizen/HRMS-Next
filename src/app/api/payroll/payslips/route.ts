// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, parsePagination, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_payroll')) return jsonError('Insufficient permissions', 403);
    const { searchParams } = new URL(req.url);
    const { page, perPage, offset } = parsePagination(searchParams, 20);
    const month = searchParams.get('month') || '';
    const year = searchParams.get('year') || '';
    
    const search = searchParams.get('search') || '';
    const status = (searchParams.get('status') || '').toUpperCase();
    let where = 'WHERE 1=1'; const params = [];
    if (month) { where += ' AND p.month=?'; params.push(parseInt(month)); }
    if (year) { where += ' AND p.year=?'; params.push(parseInt(year)); }
    if (status === 'DRAFT' || status === 'APPROVED') { where += ' AND p.status=?'; params.push(status); }
    if (search.trim()) { where += ' AND (e.full_name LIKE ? OR e.emp_code LIKE ?)'; const q = `%${search.trim()}%`; params.push(q, q); }
    
    const from = 'FROM payslips p LEFT JOIN employees e ON p.emp_code=e.emp_code';
    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt ${from} ${where}`, params);
    const rows = await query<RowDataPacket[]>(`SELECT p.*, e.full_name as employee_name, e.email_id as employee_email ${from} ${where} ORDER BY p.generated_at DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    // how many drafts are waiting for the chosen month/year (drives the "Approve all" button)
    const dWhere = 'WHERE p.status = \'DRAFT\'' + (month ? ' AND p.month=' + parseInt(month) : '') + (year ? ' AND p.year=' + parseInt(year) : '');
    const drafts = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM payslips p ${dWhere}`);
    return jsonSuccess({ payslips: rows, total: cnt[0].cnt, page, per_page: perPage, drafts: drafts[0].cnt });
  } catch (e: any) { return jsonError(e, 500); }
}
