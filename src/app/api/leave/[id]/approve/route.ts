// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, createNotification, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { getConfig } from '@/lib/app-config';
import { RowDataPacket } from 'mysql2';
import { sendRequestMail, hrRecipients, managerOf, appUrl, ymd } from '@/lib/request-mail';
import { getStep, getMaxStep, canActOnStep, recordAction } from '@/lib/approvalEngine';
import { logAudit } from '@/lib/audit';
import { markLeaveDays } from '@/lib/leave-attendance';

const fd = ymd;
const mailVars = (lr: any, mgr: any, note: string) => ({
  employee_name: lr.full_name, request_type: lr.leave_type, from_date: fd(lr.start_date), to_date: fd(lr.end_date), duration: lr.duration,
  reason: lr.reason || '-', manager_name: mgr?.full_name || '', remarks: note, review_link: `${appUrl()}/leave/admin/requests`,
});

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    let note = '';
    try { note = String((await req.json())?.note || '').trim(); } catch { /* no body */ }
    const mgr = await managerOf(lr.employee_id);
    await recordAction('leave', id, lr.current_step || 0, user, 'APPROVED', note || undefined);

    const maxStep = lr.workflow_id ? await getMaxStep(lr.workflow_id) : 0;
    const isFinalStep = !currentStep || lr.current_step >= maxStep;

    if (!isFinalStep) {
      // Advance to the next step (e.g. manager approved, now goes to HR).
      const nextStepOrder = lr.current_step + 1;
      await execute('UPDATE leave_requests SET current_step=? WHERE id=?', [nextStepOrder, id]);

      const nextStep = await getStep(lr.workflow_id, nextStepOrder);
      if (nextStep && nextStep.approver_type === 'HR') {
        const hr = await hrRecipients();
        if (hr.to) {
          sendRequestMail({
            kind: 'leave', event: 'to_hr', to: hr.to, bcc: hr.bcc || undefined, vars: mailVars(lr, mgr, note),
            asUser: { id: user.id, type: user.type },
          });
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

    // The days of the leave go into attendance: the month's CL first, the rest Unpaid Leave (used by the Salary Sheet).
    const marked = await markLeaveDays(lr.employee_id, lr.start_date, lr.end_date, lr.duration, user.email || String(user.id)).catch(e => { console.error('[leave] could not mark attendance:', e?.message); return null; });

    await createNotification(
      `Leave Approved: ${lr.leave_type}`,
      `Your ${lr.leave_type} leave request (${new Date(lr.start_date).toLocaleDateString((await getConfig()).locale)} - ${new Date(lr.end_date).toLocaleDateString((await getConfig()).locale)}) has been approved.`,
      'leave_approved',
      String(id),
      false,
      String(lr.employee_id)
    );

    sendRequestMail({ kind: 'leave', event: 'approved', to: lr.email_id, vars: mailVars(lr, mgr, note), asUser: { id: user.id, type: user.type } });

    await logAudit({
      action: 'leave_fully_approved',
      entity_type: 'leave_requests',
      entity_id: id,
      performed_by: String(user.id),
      performed_by_email: user.email,
      details: { leave_type: lr.leave_type, employee_id: lr.employee_id }
    });

    return jsonSuccess({ message: 'Leave approved successfully' + (marked ? ` (${[marked.cl && `${marked.cl} CL`, marked.upl && `${marked.upl} unpaid`, marked.half && `${marked.half} half day`, marked.sandwich && `${marked.sandwich} of them sandwich days`].filter(Boolean).join(', ') || 'no working days to mark'})` : '') });
  } catch (e: any) { return jsonError(e, 500); }
}

export const PUT = withApiLog(PUT_handler);
