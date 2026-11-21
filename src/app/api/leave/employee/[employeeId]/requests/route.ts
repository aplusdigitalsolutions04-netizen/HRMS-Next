// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, parsePagination, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { employeeId } = await params;
    if (user.id !== employeeId && !checkPermission(user, 'view_leave')) return jsonError('Insufficient permissions', 403);
    const { searchParams } = new URL(req.url);
    const { perPage } = parsePagination(searchParams, 5);
    const rows = await query<RowDataPacket[]>(`SELECT * FROM leave_requests WHERE employee_id=? ORDER BY applied_on DESC LIMIT ${perPage}`, [employeeId]);
    return jsonSuccess({ requests: rows });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
