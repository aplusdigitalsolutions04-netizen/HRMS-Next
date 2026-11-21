// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { mutedCategories } from '@/lib/preferences';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    const userId = emp.length > 0 ? String(emp[0].id) : '';
    const muted = await mutedCategories(user);
    const rows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM notifications WHERE is_read=0 AND (is_company_wide=1 OR user_id=?)` + (muted.length ? ` AND (category IS NULL OR category NOT IN (${muted.map(() => '?').join(',')}))` : ''),
      [userId, ...muted]
    );
    return jsonSuccess({ unread_count: rows[0].cnt || 0 });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const GET = withApiLog(GET_handler);
