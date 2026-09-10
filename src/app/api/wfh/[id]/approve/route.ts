// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, createNotification, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from '@/lib/email';
import { getStep, getMaxStep, canActOnStep, recordAction } from '@/lib/approvalEngine';
import { logAudit } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;

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

    await recordAction('wfh', id, lr.current_step || 0, user, 'APPROVED');

    const maxStep = lr.workflow_id ? await getMaxStep(lr.workflow_id) : 0;
    const isFinalStep = !currentStep || lr.current_step >= maxStep;

    if (!isFinalStep) {
      const nextStepOrder = lr.current_step + 1;
      await execute('UPDATE wfh_requests SET current_step=? WHERE id=?', [nextStepOrder, id]);

      const nextStep = await getStep(lr.workflow_id, nextStepOrder);
      if (nextStep && nextStep.approver_type === 'HR') {
        const hrAdmins = await query<RowDataPacket[]>('SELECT DISTINCT email FROM hr_admins WHERE email IS NOT NULL AND is_active = 1');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
        if (hrAdmins.length > 0) {
          sendEmail(
            hrAdmins.map(a => a.email).join(','),
            `WFH Request Approved by Manager — ${lr.full_name}`,
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#0f172a">WFH Request Awaiting HR Approval</h2>
              <p style="color:#475569">The reporting manager has approved this request. It now needs HR sign-off.</p>
            </div>`,
            { asUser: { id: user.id, type: user.type } }
          );
        }
        createNotification(
          `WFH Approval Needed`,
          `${lr.full_name}'s WFH request was approved by their manager and needs HR approval.`,
          'wfh_apply',
          String(id),
          true,
          null
        );
      }

      await createNotification(
        `WFH Update`,
        `Your WFH request has been approved by your manager and forwarded to HR.`,
        'wfh_approved',
        String(id),
        false,
        String(lr.employee_id)
      );

      await logAudit({
        action: 'wfh_step_approved',
        entity_type: 'wfh_requests',
        entity_id: id,
        performed_by: String(user.id),
        performed_by_email: user.email,
        details: { step: currentStep }
      });

      return jsonSuccess({ message: 'Approved and forwarded to the next approver' });
    }

    // Final step - the request is fully approved.
    await execute("UPDATE wfh_requests SET status='Approved', reviewed_by=?, reviewed_on=NOW() WHERE id=?", [user.email || user.id, id]);

    await createNotification(
      `WFH Approved`,
      `Your WFH request (${new Date(lr.start_date).toLocaleDateString('en-IN')} - ${new Date(lr.end_date).toLocaleDateString('en-IN')}) has been approved.`,
      'wfh_approved',
      String(id),
      false,
      String(lr.employee_id)
    );

    sendEmail(
      lr.email_id,
      'WFH Approved',
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#16a34a">WFH Approved</h2>
        <p style="color:#334155">Dear ${lr.full_name || 'Employee'},</p>
        <p style="color:#334155">Your Work From Home request has been approved.</p>
      </div>`,
      { asUser: { id: user.id, type: user.type } }
    );

    await logAudit({
      action: 'wfh_fully_approved',
      entity_type: 'wfh_requests',
      entity_id: id,
      performed_by: String(user.id),
      performed_by_email: user.email,
      details: { employee_id: lr.employee_id }
    });

    return jsonSuccess({ message: 'WFH request fully approved' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
