// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
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
