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
    let where = 'WHERE 1=1'; const params = [];
    if (month) { where += ' AND p.month=?'; params.push(parseInt(month)); }
    if (year) { where += ' AND p.year=?'; params.push(parseInt(year)); }
    if (search.trim()) { where += ' AND (e.full_name LIKE ? OR e.emp_code LIKE ?)'; const q = `%${search.trim()}%`; params.push(q, q); }
    
    const from = 'FROM payslips p LEFT JOIN employees e ON p.emp_code=e.emp_code';
    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt ${from} ${where}`, params);
    const rows = await query<RowDataPacket[]>(`SELECT p.*, e.full_name as employee_name ${from} ${where} ORDER BY p.generated_at DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    return jsonSuccess({ payslips: rows, total: cnt[0].cnt, page, per_page: perPage });
  } catch (e: any) { return jsonError(e, 500); }
}
