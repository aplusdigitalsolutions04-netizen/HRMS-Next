// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Marks one of the person's own (or company-wide) notifications as read. Another person's notification is left alone.
async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    const me = emp.length ? String(emp[0].id) : (user.type === 'employee' ? String(user.id) : '');
    await execute('UPDATE notifications SET is_read=1 WHERE id=? AND is_company_wide=0 AND user_id=?', [id, me]);
    return jsonSuccess({ message: 'Marked as read' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const PUT = withApiLog(PUT_handler);
