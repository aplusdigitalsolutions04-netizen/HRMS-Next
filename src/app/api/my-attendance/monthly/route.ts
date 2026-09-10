// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT emp_code FROM employees WHERE email_id = ?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    
    const rows = await query<RowDataPacket[]>(
      `      SELECT MONTH(a.attendance_date) as month, YEAR(a.attendance_date) as year,
        COALESCE(SUM(CASE WHEN a.status='P' THEN 1 ELSE 0 END),0) as present,
        COALESCE(SUM(CASE WHEN a.status='A' THEN 1 ELSE 0 END),0) as absent,
        COALESCE(SUM(CASE WHEN a.status='WO' THEN 1 ELSE 0 END),0) as \`leave\`,
        COALESCE(SUM(CASE WHEN a.in_time IS NOT NULL AND a.in_time!='--:--' AND a.out_time IS NOT NULL AND a.out_time!='--:--' THEN ROUND(TIME_TO_SEC(TIMEDIFF(a.out_time,a.in_time))/3600,1) ELSE 0 END),0) as working_hours
      FROM attendance a WHERE a.emp_code=? GROUP BY YEAR(a.attendance_date), MONTH(a.attendance_date) ORDER BY year DESC, month DESC LIMIT 12`,
      [emp[0].emp_code]
    );
    return jsonSuccess({ months: rows });
  } catch (e: any) { return jsonError(e, 500); }
}
