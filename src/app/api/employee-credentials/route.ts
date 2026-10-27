// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { decryptSecret } from '@/lib/mailbox';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_employee')) return jsonError('Insufficient permissions', 403);

    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM employee_credentials ORDER BY created_at DESC'
    );
    return jsonSuccess(rows.map(r => ({ ...r, password: decryptSecret(r.password) })));
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
