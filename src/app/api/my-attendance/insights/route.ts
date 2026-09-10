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
    
    const row = await query<RowDataPacket[]>(
      `      SELECT ROUND(
        (COALESCE(SUM(CASE WHEN a.status='P' THEN 1 ELSE 0 END),0) * 100.0 /
        NULLIF(COUNT(*),0)), 1) as consistency_score
      FROM attendance a WHERE a.emp_code=? AND YEAR(a.attendance_date)=YEAR(CURDATE())`,
      [emp[0].emp_code]
    );
    return jsonSuccess({ consistency_score: row[0]?.consistency_score || 0 });
  } catch (e: any) { return jsonError(e, 500); }
}
