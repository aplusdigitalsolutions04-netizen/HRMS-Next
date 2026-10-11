// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendPayslipEmail } from '@/lib/payslip-mail';
import { auditFrom } from '@/lib/audit';

// Approve draft payslips (the ones listed in `ids`, or every draft of month/year) and email them.
// Approving is what makes a payslip visible to the employee; the email goes out in the same step
// unless send_email is false. One failed email never undoes the approval - it is reported back.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!(checkPermission(user, 'approve_payslips') || checkPermission(user, 'generate_payslips'))) return jsonError('Insufficient permissions', 403);

    const body = await req.json().catch(() => ({}));
    const sendEmail = body.send_email !== false;
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 2000) : [];
    const month = Number(body.month) || 0, year = Number(body.year) || 0;
    if (ids.length === 0 && !(month && year)) return jsonError('Pick payslips (ids) or a month and year', 422);

    let drafts: RowDataPacket[];
    if (ids.length > 0) {
      drafts = await query<RowDataPacket[]>(`SELECT id, emp_code, month, year FROM payslips WHERE status = 'DRAFT' AND id IN (${ids.map(() => '?').join(',')})`, ids);
    } else {
      drafts = await query<RowDataPacket[]>("SELECT id, emp_code, month, year FROM payslips WHERE status = 'DRAFT' AND month = ? AND year = ?", [month, year]);
    }
    if (drafts.length === 0) return jsonSuccess({ approved: 0, emailed: 0, failed: [], message: 'No draft payslips to approve.' });

    await execute(
      `UPDATE payslips SET status = 'APPROVED', approved_by = ?, approved_on = NOW() WHERE status = 'DRAFT' AND id IN (${drafts.map(() => '?').join(',')})`,
      [user.email, ...drafts.map(d => d.id)]
    );

    let emailed = 0; const failed: { emp_code: string; error: string }[] = [];
    if (sendEmail) {
      for (const d of drafts) {
        try {
          const r = await sendPayslipEmail(d.id, { id: user.id, type: user.type });
          if (r.ok) emailed++; else failed.push({ emp_code: d.emp_code, error: r.message });
        } catch (e: any) { failed.push({ emp_code: d.emp_code, error: e?.message || 'Email failed' }); }
      }
    }
    await auditFrom(user, 'payslips_approved', 'payslip', ids.length ? `${ids.length} selected` : `${month}/${year}`, { count: drafts.length, emailed, failed: failed.length, send_email: sendEmail });
    return jsonSuccess({
      approved: drafts.length, emailed, failed,
      message: `Approved ${drafts.length} payslip(s)` + (sendEmail ? `, emailed ${emailed}` + (failed.length ? `, ${failed.length} email(s) failed (use "Send email" on them again)` : '') : ' (not emailed)') + '.',
    });
  } catch (e: any) { return jsonError(e, 500); }
}
