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
    
    const balances = await query<RowDataPacket[]>(
      `SELECT leave_type, total_days, used_days, (total_days - used_days) as remaining FROM leave_balances WHERE employee_id=?`, [emp[0].id]
    );
    return jsonSuccess({ balances });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
