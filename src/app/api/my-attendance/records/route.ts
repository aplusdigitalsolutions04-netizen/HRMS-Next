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
    const { page, perPage, offset } = parsePagination(searchParams, 15);
    const sort = searchParams.get('sort') || 'date';
    const order = searchParams.get('order') || 'DESC';
    const month = searchParams.get('month') || '';
    const year = searchParams.get('year') || '';
    
    const emp = await query<RowDataPacket[]>('SELECT emp_code FROM employees WHERE email_id = ?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    
    let where = 'WHERE emp_code=?'; const params = [emp[0].emp_code];
    if (month) { where += ' AND MONTH(attendance_date)=?'; params.push(parseInt(month)); }
    if (year) { where += ' AND YEAR(attendance_date)=?'; params.push(parseInt(year)); }
    
    const sortMap = { 'date': 'attendance_date', 'status': 'status', 'in_time': 'in_time', 'out_time': 'out_time' };
    const safeSort = sortMap[sort] || 'attendance_date';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';
    
    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM attendance ${where}`, params);
    const rows = await query<RowDataPacket[]>(
      `SELECT id, attendance_date as date, DAYNAME(attendance_date) as day, status, in_time, out_time, CASE WHEN in_time IS NOT NULL AND in_time!='--:--' AND out_time IS NOT NULL AND out_time!='--:--' THEN ROUND(TIME_TO_SEC(TIMEDIFF(out_time,in_time))/3600,1) ELSE 0 END as working_hours FROM attendance ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    return jsonSuccess({ records: rows, total: cnt[0].cnt, page, per_page: perPage, total_pages: Math.ceil(cnt[0].cnt / perPage) });
  } catch (e: any) { return jsonError(e, 500); }
}
