// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '10');
    const offset = (page - 1) * perPage;

    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);

    const empId = String(emp[0].id);
    const cnt = await query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM notifications WHERE is_company_wide=1 OR user_id=?',
      [empId]
    );
    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM notifications WHERE is_company_wide=1 OR user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [empId, perPage, offset]
    );
    return jsonSuccess({ notifications: rows, total: cnt[0].cnt, page, per_page: perPage });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    const notificationIds = body.ids;
    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return jsonError('No notification IDs provided', 422);
    }
    const placeholders = notificationIds.map(() => '?').join(',');
    await execute(
      `UPDATE notifications SET is_read=1 WHERE id IN (${placeholders})`,
      notificationIds
    );
    return jsonSuccess({ message: 'Notifications marked as read' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    const body = await req.json().catch(() => ({}));
    const ids = body.ids;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      await execute(`DELETE FROM notifications WHERE id IN (${placeholders}) AND is_company_wide=0 AND user_id=?`, [...ids, String(emp[0].id)]);
    } else {
      await execute('DELETE FROM notifications WHERE is_company_wide=0 AND user_id=?', [String(emp[0].id)]);
    }
    return jsonSuccess({ message: 'Notifications deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
