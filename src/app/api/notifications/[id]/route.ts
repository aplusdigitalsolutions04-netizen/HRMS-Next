// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// A notification can only be removed by the person it was sent to. ADMIN and HR may remove any (the same rule as the bulk delete in /api/notifications).
const myEmployeeId = async (user: any): Promise<string> => {
  if (user.type === 'employee') return String(user.id);
  const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id = ?', [user.email || '']);
  return emp.length ? String(emp[0].id) : '';
};

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    if (user.role === 'ADMIN' || user.role === 'HR') {
      await execute('DELETE FROM notifications WHERE id = ?', [id]);
    } else {
      await execute('DELETE FROM notifications WHERE id = ? AND is_company_wide = 0 AND user_id = ?', [id, await myEmployeeId(user)]);
    }
    return jsonSuccess({ message: 'Notification deleted' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const DELETE = withApiLog(DELETE_handler);
