// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, createNotification, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendRequestMail, hrRecipients, managerOf, appUrl, ymd } from '@/lib/request-mail';
import { getStep, getMaxStep, canActOnStep, recordAction } from '@/lib/approvalEngine';
import { logAudit } from '@/lib/audit';
import { markWfhDays } from '@/lib/wfh-attendance';

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

    let note = '';
    try { note = String((await req.json())?.note || '').trim(); } catch { /* no body */ }
    const mgr = await managerOf(lr.employee_id);
    const fd = ymd;
    const mailVars = { employee_name: lr.full_name, request_type: 'Work From Home', from_date: fd(lr.start_date), to_date: fd(lr.end_date), reason: lr.reason || '-', manager_name: mgr?.full_name || '', remarks: note, review_link: `${appUrl()}/wfh/manage` };
    await recordAction('wfh', id, lr.current_step || 0, user, 'APPROVED', note || undefined);

    const maxStep = lr.workflow_id ? await getMaxStep(lr.workflow_id) : 0;
    const isFinalStep = !currentStep || lr.current_step >= maxStep;

    if (!isFinalStep) {
      const nextStepOrder = lr.current_step + 1;
      await execute('UPDATE wfh_requests SET current_step=? WHERE id=?', [nextStepOrder, id]);

      const nextStep = await getStep(lr.workflow_id, nextStepOrder);
      if (nextStep && nextStep.approver_type === 'HR') {
        const hr = await hrRecipients();
        if (hr.to) sendRequestMail({ kind: 'wfh', event: 'to_hr', to: hr.to, bcc: hr.bcc || undefined, vars: mailVars, asUser: { id: user.id, type: user.type } });
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

    // Approved WFH days become paid WFH attendance days (used by the Salary Sheet).
    await markWfhDays(lr.employee_id, lr.start_date, lr.end_date, user.email || String(user.id)).catch(e => console.error('[wfh] could not mark attendance:', e?.message));

    await createNotification(
      `WFH Approved`,
      `Your WFH request (${new Date(lr.start_date).toLocaleDateString('en-IN')} - ${new Date(lr.end_date).toLocaleDateString('en-IN')}) has been approved.`,
      'wfh_approved',
      String(id),
      false,
      String(lr.employee_id)
    );

    sendRequestMail({ kind: 'wfh', event: 'approved', to: lr.email_id, vars: mailVars, asUser: { id: user.id, type: user.type } });

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
