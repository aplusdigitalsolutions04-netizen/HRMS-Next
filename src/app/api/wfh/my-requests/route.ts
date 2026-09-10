// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Not authenticated as employee', 401);

    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM wfh_requests WHERE employee_id = ? ORDER BY applied_on DESC',
      [user.id]
    );

    return jsonSuccess(rows);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
