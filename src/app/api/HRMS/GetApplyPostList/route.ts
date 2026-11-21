// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const rows = await query<RowDataPacket[]>('SELECT DISTINCT name as title FROM designations WHERE is_deleted=0 ORDER BY name');
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
