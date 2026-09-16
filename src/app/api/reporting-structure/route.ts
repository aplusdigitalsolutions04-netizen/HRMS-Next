// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    
    const { searchParams } = new URL(req.url);
    const { page, perPage, offset } = parsePagination(searchParams, 25);
    const s = searchParams.get('search') || '';
    
    let where = "WHERE e.is_deleted = 0";
    const params: any[] = [];
    if (s.trim()) { 
      where += ' AND (e.full_name LIKE ? OR e.emp_code LIKE ?)'; 
      const q = `%${s.trim()}%`; 
      params.push(q, q); 
    }

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM employees e ${where}`, params);
    const total = countRows[0].cnt;

    const rows = await query<RowDataPacket[]>(`
      SELECT 
        e.id, 
        e.full_name, 
        e.emp_code, 
        e.designation, 
        e.manager_id, 
        e.status,
        d.name as department_name,
        m.full_name as manager_name
      FROM employees e
      LEFT JOIN designations de ON e.designation = de.name
      LEFT JOIN departments d ON de.department_id = d.id
      LEFT JOIN employees m ON e.manager_id = m.id
      ${where}
      ORDER BY e.full_name ASC 
      LIMIT ${perPage} OFFSET ${offset}
    `, params);

    return jsonSuccess({ data: rows, total, page, per_page: perPage });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
