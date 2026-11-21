// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Marks a notification as read: only one that is visible to this person (company-wide, or sent to them). ADMIN and HR may mark any.
async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    if (user.role === 'ADMIN' || user.role === 'HR') {
      await execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    } else {
      let me = '';
      if (user.type === 'employee') me = String(user.id);
      else { const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id = ?', [user.email || '']); me = emp.length ? String(emp[0].id) : ''; }
      await execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND (is_company_wide = 1 OR user_id = ?)', [id, me]);
    }
    return jsonSuccess({ message: 'Marked as read' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const PUT = withApiLog(PUT_handler);
