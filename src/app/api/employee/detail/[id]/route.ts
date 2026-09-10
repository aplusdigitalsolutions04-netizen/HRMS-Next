// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_employee_details')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM employees WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('Employee not found', 404);
    // This route also backs the edit form (which needs bank/PAN fields), but
    // the password hash is never legitimate to send to any client.
    const { password, ...safeRow } = rows[0];
    return jsonSuccess(safeRow);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
