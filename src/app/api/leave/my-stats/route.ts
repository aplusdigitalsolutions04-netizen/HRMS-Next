// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id = ?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    const rows = await query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END),0) as pending, COALESCE(SUM(CASE WHEN status='Approved' THEN 1 ELSE 0 END),0) as approved, COALESCE(SUM(CASE WHEN status='Rejected' THEN 1 ELSE 0 END),0) as rejected, COALESCE(SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END),0) as cancelled, COUNT(*) as total FROM leave_requests WHERE employee_id=?`,
      [emp[0].id]
    );
    return jsonSuccess(rows[0]);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
