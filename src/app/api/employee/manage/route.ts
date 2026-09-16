// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    const { searchParams } = new URL(req.url);
    const { page, perPage, offset } = parsePagination(searchParams, 25);
    const s = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const department = searchParams.get('department') || '';

    // 'deleted' is a pseudo-status: soft-deleted employees live in is_deleted,
    // not the status column, and are hidden from every other filter.
    let where = status === 'deleted' ? 'WHERE is_deleted = 1' : 'WHERE is_deleted = 0';
    const params: any[] = [];
    if (s.trim()) { where += ' AND (full_name LIKE ? OR emp_code LIKE ? OR email_id LIKE ? OR mobile_no LIKE ?)'; const q = `%${s.trim()}%`; params.push(q, q, q, q); }
    if (status && status !== 'deleted') { where += ' AND status = ?'; params.push(status); }
    if (department) {
      where += ' AND designation IN (SELECT de.name FROM designations de JOIN departments d ON de.department_id = d.id WHERE d.name = ?)';
      params.push(department);
    }

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM employees ${where}`, params);
    const total = countRows[0].cnt;

    const rows = await query<RowDataPacket[]>(`SELECT * FROM employees ${where} ORDER BY created_on DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    return jsonSuccess({ data: rows, total, page, per_page: perPage });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
