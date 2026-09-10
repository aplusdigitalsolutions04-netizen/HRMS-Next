// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    await execute('DELETE FROM notifications WHERE is_read=1 AND is_company_wide=0 AND user_id=?', [String(emp[0].id)]);
    return jsonSuccess({ message: 'Read notifications cleared' });
  } catch (e: any) { return jsonError(e, 500); }
}
