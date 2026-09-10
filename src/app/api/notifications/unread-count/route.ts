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
    const userId = emp.length > 0 ? String(emp[0].id) : '';
    const rows = await query<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM notifications WHERE is_read=0 AND (is_company_wide=1 OR user_id=?)', [userId]);
    return jsonSuccess({ unread_count: rows[0].cnt || 0 });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
