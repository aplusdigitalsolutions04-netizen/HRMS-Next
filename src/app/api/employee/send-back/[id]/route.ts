// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// HR reviewing a 'pending' submission can send it back to the employee with
// a reason instead of only approve/drop - the employee logs back in, sees
// the reason, edits, and resubmits through the same complete-profile
// endpoint (which lands back in 'pending').
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const body = await req.json();
    const remarks = (body.remarks || '').trim();
    if (!remarks) return jsonError('Please explain what needs to be corrected', 422);

    const existing = await query<RowDataPacket[]>('SELECT status FROM employees WHERE id = ?', [id]);
    if (existing.length === 0) return jsonError('Employee not found', 404);
    if (existing[0].status !== 'pending') return jsonError('Only a pending submission can be sent back', 400);

    await execute('UPDATE employees SET status = ?, hr_remarks = ? WHERE id = ?', ['needs_correction', remarks, id]);

    return jsonSuccess({ message: 'Sent back to the employee for correction' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
