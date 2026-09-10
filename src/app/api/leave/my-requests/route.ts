// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';
    const { page, perPage, offset } = parsePagination(searchParams, 10);
    
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id = ?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    
    let where = 'WHERE employee_id=?'; const params = [emp[0].id];
    if (status) { where += ' AND status=?'; params.push(status); }
    
    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM leave_requests ${where}`, params);
    const rows = await query<RowDataPacket[]>(`SELECT * FROM leave_requests ${where} ORDER BY applied_on DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    return jsonSuccess({ requests: rows, total: cnt[0].cnt, page, per_page: perPage });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
