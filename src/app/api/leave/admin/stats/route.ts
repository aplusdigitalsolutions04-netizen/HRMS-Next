// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, hasAnyPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_leave', 'approve_leave'])) return jsonError('Insufficient permissions', 403);
    const rows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END),0) as pending, COALESCE(SUM(CASE WHEN status='Approved' THEN 1 ELSE 0 END),0) as approved, COALESCE(SUM(CASE WHEN status='Rejected' THEN 1 ELSE 0 END),0) as rejected, COALESCE(SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END),0) as cancelled FROM leave_requests`
    );
    return jsonSuccess(rows[0]);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const GET = withApiLog(GET_handler);
