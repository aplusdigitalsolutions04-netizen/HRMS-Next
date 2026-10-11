// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { readLeaveDoc } from '@/lib/leave-docs';

// The paper attached to a leave request. Only: the employee who sent it, their reporting manager, and HR who can see or
// approve leave.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT lr.supporting_doc, lr.employee_id, e.manager_id FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id WHERE lr.id = ?', [id]);
    if (rows.length === 0 || !rows[0].supporting_doc) return jsonError('No document attached to this request', 404);
    const lr = rows[0];
    const allowed = user.type === 'admin'
      ? (checkPermission(user, 'view_leave') || checkPermission(user, 'approve_leave'))
      : (String(lr.employee_id) === String(user.id) || String(lr.manager_id || '') === String(user.id));
    if (!allowed) return jsonError('Insufficient permissions', 403);
    const f = await readLeaveDoc(lr.supporting_doc);
    if (!f) return jsonError('The file is not on the server any more', 404);
    return new NextResponse(f.buf, { headers: { 'Content-Type': f.mime, 'Content-Disposition': `inline; filename="${f.name}"`, 'X-Content-Type-Options': 'nosniff' } });
  } catch (e: any) { return jsonError(e, 500); }
}
