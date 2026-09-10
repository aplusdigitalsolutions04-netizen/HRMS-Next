import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'verify_attendance')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const rows = await query<RowDataPacket[]>('SELECT id FROM attendance_summary WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Attendance summary not found', 404);

    const t = now();
    await execute('UPDATE attendance_summary SET is_verified=1, verified_by=?, verified_on=? WHERE id=?', [user.email, t, id]);
    return jsonSuccess({ message: 'Attendance verified' });
  } catch (e: any) { return jsonError(e, 500); }
}
