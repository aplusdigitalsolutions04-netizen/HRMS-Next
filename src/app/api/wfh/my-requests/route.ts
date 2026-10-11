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
      "SELECT wr.*, (NOT EXISTS (SELECT 1 FROM approval_actions aa WHERE aa.request_type='wfh' AND aa.request_id = wr.id) AND LOWER(wr.status) = 'pending') AS can_edit FROM wfh_requests wr WHERE wr.employee_id = ? ORDER BY wr.applied_on DESC",
      [user.id]
    );

    return jsonSuccess(rows);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
