// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, createNotification, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getStep, canActOnStep, recordAction } from '@/lib/approvalEngine';
import { sendRequestMail, ymd } from '@/lib/request-mail';
import { logAudit } from '@/lib/audit';

const fd = ymd;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;

    const requests = await query<RowDataPacket[]>(
      'SELECT lr.*, e.email_id, e.full_name FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.id = ?',
      [id]
    );
    if (requests.length === 0) return jsonError('Leave request not found', 404);
    const lr = requests[0];
    if (lr.status !== 'Pending') return jsonError('This request has already been reviewed', 409);

    let currentStep = null;
    if (lr.workflow_id && lr.current_step) {
      currentStep = await getStep(lr.workflow_id, lr.current_step);
    }

    if (currentStep) {
      const authorized = await canActOnStep(currentStep, user, lr.employee_id, 'approve_leave');
      if (!authorized) return jsonError('Insufficient permissions', 403);
    } else {
      if (!checkPermission(user, 'approve_leave')) return jsonError('Insufficient permissions', 403);
    }

    let reason = '';
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) { const b = await req.json(); reason = b.reason || ''; }

    await recordAction('leave', id, lr.current_step || 0, user, 'REJECTED', reason);
    await execute("UPDATE leave_requests SET status='Rejected', rejection_reason=?, reviewed_by=?, reviewed_on=NOW() WHERE id=?", [reason, user.email || user.id, id]);

    // Notify the employee in-app
    await createNotification(
      `Leave Rejected: ${lr.leave_type}`,
      `Your ${lr.leave_type} leave request (${new Date(lr.start_date).toLocaleDateString('en-IN')} - ${new Date(lr.end_date).toLocaleDateString('en-IN')}) has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
      'leave_rejected',
      String(id),
      false,
      String(lr.employee_id)
    );

    sendRequestMail({
      kind: 'leave', event: 'rejected', to: lr.email_id, asUser: { id: user.id, type: user.type },
      vars: { employee_name: lr.full_name, request_type: lr.leave_type, from_date: fd(lr.start_date), to_date: fd(lr.end_date), duration: lr.duration, reason: lr.reason || '-', remarks: reason || 'Not specified' },
    });

    await logAudit({
      action: 'leave_rejected',
      entity_type: 'leave_requests',
      entity_id: id,
      performed_by: String(user.id),
      performed_by_email: user.email,
      details: { leave_type: lr.leave_type, reason, employee_id: lr.employee_id }
    });

    return jsonSuccess({ message: 'Leave rejected' });
  } catch (e: any) { return jsonError(e, 500); }
}
