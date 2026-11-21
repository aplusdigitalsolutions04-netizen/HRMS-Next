// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmailDetailed } from '@/lib/email';
import { auditFrom } from '@/lib/audit';
import { plainToHtml } from '@/lib/mail-format';
import { ensureFollowUpTemplate, FOLLOW_UP_CATEGORY } from '@/lib/masters';

const esc = (v: string) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A follow-up mail to a candidate who has not answered. It goes out from the HR person's own connected email, or from the
// company account when they have none (HR's own address). The follow-up counter goes up only when the mail was sent.
async function POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_candidates')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const c = (await query<RowDataPacket[]>('SELECT id, candidate_name, email_id, no_response FROM interview_candidates WHERE id = ?', [id]))[0];
    if (!c) return jsonError('Candidate not found', 404);
    if (!c.email_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email_id)) return jsonError('This candidate has no valid email address', 422);
    const subject = String(b.subject || '').trim().slice(0, 200), message = String(b.message || '').trim().slice(0, 5000);
    if (!subject || !message) return jsonError('Write the subject and the message', 422);

    const html = plainToHtml(message, true);
    const r = await sendEmailDetailed(c.email_id, subject, html, { asUser: { id: user.id, type: user.type } });
    if (!r.success) return jsonError(r.error || 'The mail could not be sent', 502);

    await execute('UPDATE interview_candidates SET follow_up_count = COALESCE(follow_up_count, 0) + 1, last_follow_up_on = NOW() WHERE id = ?', [id]);
    await auditFrom(user, 'candidate_follow_up_sent', 'candidate', id, { name: c.candidate_name });
    return jsonSuccess({ message: 'Follow-up mail sent' });
  } catch (e: any) { return jsonError(e, 500); }
}

// The templates the popup offers, already filled with this candidate's details. HR still edits the text before sending.
// Everything comes from the "Candidate Follow-up" templates (Settings > Template Management); nothing is written in here.
const FILL: Record<string, string[]> = {
  candidate_name: ['candidate_name', 'name'], position: ['position', 'job_role', 'apply_post'], interview_round: ['interview_round', 'round'],
  interview_date: ['interview_date', 'date'], company_name: ['company_name'], hr_name: ['hr_name', 'sender_name'], hr_email: ['hr_email', 'sender_email'],
};
function fill(text: string, vals: Record<string, string>) {
  let out = String(text || '');
  for (const [k, aliases] of Object.entries(FILL)) {
    for (const a of aliases) out = out.replace(new RegExp(`\\{\\{\\s*${a}\\s*\\}\\}|\\{\\s*${a}\\s*\\}`, 'gi'), vals[k] ?? '');
  }
  return out;
}
const fmtDate = (d: any) => { if (!d) return ''; const x = new Date(d); return isNaN(x.getTime()) ? '' : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
// a candidate with no interview yet leaves some values empty: close the gaps they leave
const tidy = (s: string) => s.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,])/g, '$1').trim();

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_candidates')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const c = (await query<RowDataPacket[]>(
      `SELECT ic.candidate_name,
        (SELECT d.apply_post FROM interview_details d WHERE d.candidate_id = ic.id ORDER BY d.created_on DESC LIMIT 1) AS apply_post,
        (SELECT d.interview_round FROM interview_details d WHERE d.candidate_id = ic.id ORDER BY d.created_on DESC LIMIT 1) AS interview_round,
        (SELECT d.interview_date FROM interview_details d WHERE d.candidate_id = ic.id ORDER BY d.created_on DESC LIMIT 1) AS interview_date
       FROM interview_candidates ic WHERE ic.id = ?`, [id]))[0];
    if (!c) return jsonError('Candidate not found', 404);
    await ensureFollowUpTemplate();
    // every template HR keeps, the follow-up ones first; the employee-only ones (invites, letters) are left out because
    // their words are about an employee's account, not a candidate
    const tpls = await query<RowDataPacket[]>(
      `SELECT id, name, subject, body, COALESCE(template_type, 'General') AS category FROM email_templates
       WHERE COALESCE(is_deleted,0) = 0 AND COALESCE(template_type, '') NOT IN ('Employee Invite', 'employee')
       ORDER BY (template_type = ?) DESC, template_type, created_on, name`, [FOLLOW_UP_CATEGORY]);
    const company = (await query<RowDataPacket[]>('SELECT company_name FROM company_settings LIMIT 1'))[0] || {};
    const vals = {
      candidate_name: c.candidate_name || '', position: c.apply_post || '', interview_round: c.interview_round || '',
      interview_date: fmtDate(c.interview_date), company_name: company.company_name || '', hr_name: user.name || 'HR Team', hr_email: user.email || '',
    };
    return jsonSuccess({ templates: tpls.map(t => ({ id: t.id, name: t.name, category: t.category, subject: tidy(fill(t.subject, vals)), message: tidy(fill(t.body, vals)) })) });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
