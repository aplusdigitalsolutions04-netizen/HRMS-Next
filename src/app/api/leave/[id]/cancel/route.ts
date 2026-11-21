// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, requireRole, checkPermission, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { unmarkLeaveDays } from '@/lib/leave-attendance';
import { logAudit } from '@/lib/audit';

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayKey = (v: any) => { const d = new Date(v); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;

    const rows = await query<RowDataPacket[]>('SELECT * FROM leave_requests WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Leave request not found', 404);
    const lr = rows[0];
    const status = (lr.status || '').toLowerCase();

    if (user.type === 'employee' && String(lr.employee_id) !== String(user.id)) {
      return jsonError('Not authorized to cancel this leave request', 403);
    }
    if (!requireRole(user, []) && user.type !== 'employee' && !checkPermission(user, 'approve_leave')) {
      return jsonError('Not authorized to cancel this leave request', 403);
    }

    if (status === 'approved') {
      // An approved leave can be taken back by the employee until it starts, and by HR at any time.
      const isHr = user.type !== 'employee' && checkPermission(user, 'approve_leave');
      if (!isHr && !(user.type === 'employee' && dayKey(lr.start_date) > todayKey())) {
        return jsonError('An approved leave can be cancelled only before it starts. Ask HR to cancel it.', 403);
      }
      let reason = '';
      try { reason = String((await req.json())?.reason || '').trim(); } catch { /* no body */ }
      await execute("UPDATE leave_requests SET status='Cancelled' WHERE id=?", [id]);
      const removed = await unmarkLeaveDays(lr.employee_id, lr.start_date, lr.end_date).catch(e => { console.error('[leave] could not undo attendance:', e?.message); return 0; });
      if (isHr && String(lr.employee_id) !== String(user.id)) {
        await createNotification(
          `Leave Cancelled: ${lr.leave_type}`,
          `Your approved ${lr.leave_type} leave (${dayKey(lr.start_date)} to ${dayKey(lr.end_date)}) was cancelled by HR.${reason ? ' Reason: ' + reason : ''}`,
          'leave_cancelled', String(id), false, String(lr.employee_id)
        );
      }
      await logAudit({ action: 'leave_approved_cancelled', entity_type: 'leave_requests', entity_id: id, performed_by: String(user.id), performed_by_email: user.email, details: { leave_type: lr.leave_type, days_restored: removed, reason } });
      return jsonSuccess({ message: `Leave cancelled${removed ? `, ${removed} attendance day${removed > 1 ? 's' : ''} restored` : ''}` });
    }

    if (status !== 'pending') {
      return jsonError('Only pending or approved leave requests can be cancelled', 400);
    }

    await execute("UPDATE leave_requests SET status='Cancelled' WHERE id=?", [id]);
    return jsonSuccess({ message: 'Leave cancelled' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const PUT = withApiLog(PUT_handler);
