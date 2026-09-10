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
      // Legacy request with no workflow assigned - fall back to the flat permission check.
      if (!checkPermission(user, 'approve_leave')) return jsonError('Insufficient permissions', 403);
    }

    await recordAction('leave', id, lr.current_step || 0, user, 'APPROVED');

    const maxStep = lr.workflow_id ? await getMaxStep(lr.workflow_id) : 0;
    const isFinalStep = !currentStep || lr.current_step >= maxStep;

    if (!isFinalStep) {
      // Advance to the next step (e.g. manager approved, now goes to HR).
      const nextStepOrder = lr.current_step + 1;
      await execute('UPDATE leave_requests SET current_step=? WHERE id=?', [nextStepOrder, id]);

      const nextStep = await getStep(lr.workflow_id, nextStepOrder);
      if (nextStep && nextStep.approver_type === 'HR') {
        const hrAdmins = await query<RowDataPacket[]>('SELECT DISTINCT email FROM hr_admins WHERE email IS NOT NULL AND is_active = 1');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
        if (hrAdmins.length > 0) {
          sendEmail(
            hrAdmins.map(a => a.email).join(','),
            `Leave Request Approved by Manager: ${lr.leave_type} — ${lr.full_name}`,
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#0f172a">Leave Request Awaiting HR Approval</h2>
              <p style="color:#475569">The reporting manager has approved this request. It now needs HR sign-off.</p>
              <p style="margin-top:20px"><a href="${appUrl}/leave/admin/requests" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Review in HRMS</a></p>
            </div>`,
            { asUser: { id: user.id, type: user.type } }
          );
        }
        createNotification(
          `Leave Approval Needed: ${lr.leave_type}`,
          `${lr.full_name}'s ${lr.leave_type} request was approved by their manager and needs HR approval.`,
          'leave_apply',
          String(id),
          true,
          null
        );
      }

      await createNotification(
        `Leave Update: ${lr.leave_type}`,
        `Your ${lr.leave_type} leave request has been approved by your manager and forwarded to HR.`,
        'leave_approved',
        String(id),
        false,
        String(lr.employee_id)
      );

      await logAudit({
        action: 'leave_step_approved',
        entity_type: 'leave_requests',
        entity_id: id,
        performed_by: String(user.id),
        performed_by_email: user.email,
        details: { step: currentStep, leave_type: lr.leave_type }
      });

      return jsonSuccess({ message: 'Approved and forwarded to the next approver' });
    }

    // Final step - the request is fully approved.
    await execute("UPDATE leave_requests SET status='Approved', reviewed_by=?, reviewed_on=NOW() WHERE id=?", [user.email || user.id, id]);

    await createNotification(
      `Leave Approved: ${lr.leave_type}`,
      `Your ${lr.leave_type} leave request (${new Date(lr.start_date).toLocaleDateString('en-IN')} - ${new Date(lr.end_date).toLocaleDateString('en-IN')}) has been approved.`,
      'leave_approved',
      String(id),
      false,
      String(lr.employee_id)
    );

    sendEmail(
      lr.email_id,
      'Leave Approved — ' + lr.leave_type,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#16a34a">Leave Approved</h2>
        <p style="color:#334155">Dear ${lr.full_name || 'Employee'},</p>
        <p style="color:#475569">Your leave request has been <strong style="color:#16a34a">approved</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Leave Type</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${lr.leave_type}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Start Date</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${new Date(lr.start_date).toLocaleDateString('en-IN')}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">End Date</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${new Date(lr.end_date).toLocaleDateString('en-IN')}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Duration</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${lr.duration} day(s)</td></tr>
        </table>
        <p style="color:#64748b;font-size:14px;margin-top:30px">This is an automated message from HRMS.</p>
      </div>`,
      { asUser: { id: user.id, type: user.type } }
    );

    await logAudit({
      action: 'leave_fully_approved',
      entity_type: 'leave_requests',
      entity_id: id,
      performed_by: String(user.id),
      performed_by_email: user.email,
      details: { leave_type: lr.leave_type, employee_id: lr.employee_id }
    });

    return jsonSuccess({ message: 'Leave approved successfully' });
  } catch (e: any) { return jsonError(e, 500); }
}
