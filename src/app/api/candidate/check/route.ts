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
    const { searchParams } = new URL(req.url);
    const mobile = searchParams.get('mobile') || '';
    if (!mobile) return jsonError('Mobile number required', 422);

    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM interview_candidates WHERE contact_number = ?',
      [mobile]
    );
    if (rows.length > 0) {
      return jsonSuccess({ exists: true, data: rows[0] });
    }
    return jsonSuccess({ exists: false, data: null });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
