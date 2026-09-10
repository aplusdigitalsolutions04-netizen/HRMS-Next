// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    const rows = await query<RowDataPacket[]>(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE is_read=0 AND (is_company_wide=1 OR user_id=?)',
      [String(emp[0].id)]
    );
    return jsonSuccess({ unread_count: rows[0]?.unread_count || 0 });
  } catch (e: any) { return jsonError(e, 500); }
}
