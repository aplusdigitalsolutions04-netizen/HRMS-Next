// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { employeeId } = await params;
    if (user.id !== employeeId && !checkPermission(user, 'view_leave')) return jsonError('Insufficient permissions', 403);
    const balances = await query<RowDataPacket[]>(
      `SELECT leave_type, total_days, used_days, (total_days - used_days) as remaining FROM leave_balances WHERE employee_id=?`,
      [employeeId]
    );
    return jsonSuccess({ balances });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
