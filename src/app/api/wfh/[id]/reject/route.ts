// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, createNotification, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from '@/lib/email';
import { getStep, canActOnStep, recordAction } from '@/lib/approvalEngine';
import { logAudit } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const { reason } = await req.json();

    if (!reason || reason.trim() === '') return jsonError('Rejection reason is required', 400);

    const requests = await query<RowDataPacket[]>(
      'SELECT lr.*, e.email_id, e.full_name FROM wfh_requests lr JOIN employees e ON lr.employee_id = e.id WHERE lr.id = ?',
      [id]
    );
    if (requests.length === 0) return jsonError('WFH request not found', 404);
    const lr = requests[0];
    if (lr.status !== 'Pending') return jsonError('This request has already been reviewed', 409);

    let currentStep = null;
    if (lr.workflow_id && lr.current_step) {
      currentStep = await getStep(lr.workflow_id, lr.current_step);
    }

    if (currentStep) {
      const authorized = await canActOnStep(currentStep, user, lr.employee_id, 'approve_wfh');
      if (!authorized) return jsonError('Insufficient permissions', 403);
    } else {
      if (!checkPermission(user, 'approve_wfh')) return jsonError('Insufficient permissions', 403);
    }

    await recordAction('wfh', id, lr.current_step || 0, user, 'REJECTED', reason);

    await execute(
      "UPDATE wfh_requests SET status='Rejected', rejection_reason=?, reviewed_by=?, reviewed_on=NOW() WHERE id=?",
      [reason, user.email || user.id, id]
    );

    await createNotification(
      `WFH Rejected`,
      `Your WFH request has been rejected. Reason: ${reason}`,
      'wfh_rejected',
      String(id),
      false,
      String(lr.employee_id)
    );

    sendEmail(
      lr.email_id,
      'WFH Request Rejected',
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#ef4444">WFH Rejected</h2>
        <p style="color:#334155">Dear ${lr.full_name || 'Employee'},</p>
        <p style="color:#334155">Your Work From Home request has been rejected.</p>
        <p style="color:#334155"><strong>Reason:</strong> ${reason}</p>
      </div>`,
      { asUser: { id: user.id, type: user.type } }
    );

    await logAudit({
      action: 'wfh_rejected',
      entity_type: 'wfh_requests',
      entity_id: id,
      performed_by: String(user.id),
      performed_by_email: user.email,
      details: { reason, employee_id: lr.employee_id }
    });

    return jsonSuccess({ message: 'WFH request rejected' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
