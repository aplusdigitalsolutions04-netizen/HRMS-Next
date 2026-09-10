// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, requireRole } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;

    const rows = await query<RowDataPacket[]>('SELECT * FROM leave_requests WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Leave request not found', 404);
    const lr = rows[0];

    if (user.type === 'employee' && String(lr.employee_id) !== String(user.id)) {
      return jsonError('Not authorized to cancel this leave request', 403);
    }
    if (!requireRole(user, []) && user.type !== 'employee') {
      return jsonError('Not authorized to cancel this leave request', 403);
    }
    if ((lr.status || '').toLowerCase() !== 'pending') {
      return jsonError('Only pending leave requests can be cancelled', 400);
    }

    await execute("UPDATE leave_requests SET status='Cancelled' WHERE id=?", [id]);
    return jsonSuccess({ message: 'Leave cancelled' });
  } catch (e: any) { return jsonError(e, 500); }
}
