// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT is_company_wide FROM notifications WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Notification not found', 404);
    if (rows[0].is_company_wide) {
      return jsonError('Company-wide announcements cannot be deleted individually', 403);
    }
    await execute('DELETE FROM notifications WHERE id=? AND is_company_wide=0 AND user_id=?', [id, String(emp[0].id)]);
    return jsonSuccess({ message: 'Notification deleted' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
