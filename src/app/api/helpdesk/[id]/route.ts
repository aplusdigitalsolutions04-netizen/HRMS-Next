// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmailDetailed } from '@/lib/email';
import { escapeHtml, helpdeskMailOn, STATUSES } from '@/lib/helpdesk';
import { auditFrom } from '@/lib/audit';

// One Help Desk ticket.
// GET            the ticket and its messages (the employee who opened it, or HR)
// POST { message }  an answer: from HR (the employee is told) or from the employee
// PUT  { status?, assign? }  HR changes the status / takes the ticket; the employee can only close their own
const isHr = (user: any) => user.type === 'admin' && checkPermission(user, 'view_employees');

async function load(id: string, user: any) {
  const t = (await query<RowDataPacket[]>(
    `SELECT t.*, e.full_name, e.emp_code, e.email_id, e.designation FROM help_tickets t JOIN employees e ON e.id = t.employee_id WHERE t.id = ?`, [id]))[0];
  if (!t) return { err: jsonError('Ticket not found', 404) };
  const hr = isHr(user);
  if (!hr && !(user.type === 'employee' && String(t.employee_id) === String(user.id))) return { err: jsonError('Ticket not found', 404) };
  return { t, hr };
}

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const { t, err } = await load(id, user);
    if (err) return err;
    const messages = await query<RowDataPacket[]>('SELECT id, author_type, author_name, message, created_at FROM help_ticket_messages WHERE ticket_id = ? ORDER BY id ASC', [id]);
    return jsonSuccess({ ticket: t, messages });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const { t, hr, err } = await load(id, user);
    if (err) return err;
    const message = String((await req.json()).message || '').trim().slice(0, 5000);
    if (message.length < 2) return jsonError('Please write a message', 422);
    if (t.status === 'Closed') return jsonError('This ticket is closed. Please open a new one.', 409);

    const asHr = hr;
    await execute('INSERT INTO help_ticket_messages (ticket_id, author_type, author_name, author_email, message) VALUES (?,?,?,?,?)',
      [id, asHr ? 'hr' : 'employee', asHr ? (user.name || user.email) : t.full_name, user.email || null, message]);

    if (asHr) {
      // HR answers: the ticket is being worked on, and it belongs to the person who answered first
      await execute("UPDATE help_tickets SET status = IF(status = 'Open', 'In Progress', status), assigned_to = COALESCE(assigned_to, ?) WHERE id = ?", [user.email || String(user.id), id]);
      await createNotification(`HR answered: ${t.subject}`, `Ticket ${t.ticket_no} has a new answer from HR.`, 'helpdesk', String(id), false, String(t.employee_id));
      if (await helpdeskMailOn() && t.email_id) {
        sendEmailDetailed(t.email_id, `[Help Desk ${t.ticket_no}] HR answered: ${t.subject}`,
          `<p>Hello ${escapeHtml(t.full_name)},</p><p>HR answered your question <b>${escapeHtml(t.subject)}</b>:</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">${escapeHtml(message).replace(/\n/g, '<br/>')}</div><p>You can reply in the portal: Help Desk.</p>`,
          { asUser: { id: user.id, type: user.type } }).catch(() => {});
      }
    } else {
      // the employee writes again: a resolved ticket is open again
      await execute("UPDATE help_tickets SET status = IF(status = 'Resolved', 'Open', status), resolved_at = IF(status = 'Resolved', NULL, resolved_at) WHERE id = ?", [id]);
      await createNotification(`New reply: ${t.subject}`, `${t.full_name} replied on ticket ${t.ticket_no}.`, 'helpdesk', String(id), true, null);
    }
    return jsonSuccess({ message: 'Sent' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const { t, hr, err } = await load(id, user);
    if (err) return err;
    const b = await req.json();
    const sets: string[] = []; const vals: any[] = [];

    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return jsonError('Unknown status', 422);
      if (!hr && b.status !== 'Closed') return jsonError('You can only close your own ticket', 403);
      sets.push('status = ?'); vals.push(b.status);
      if (b.status === 'Resolved' || b.status === 'Closed') sets.push('resolved_at = NOW()'); else sets.push('resolved_at = NULL');
    }
    if (hr && b.assign !== undefined) { sets.push('assigned_to = ?'); vals.push(b.assign ? (user.email || String(user.id)) : null); }
    if (sets.length === 0) return jsonError('Nothing to change', 400);
    vals.push(id);
    await execute(`UPDATE help_tickets SET ${sets.join(', ')} WHERE id = ?`, vals);

    if (hr && b.status && b.status !== t.status) {
      await createNotification(`Your ticket is ${b.status.toLowerCase()}`, `Ticket ${t.ticket_no}: ${t.subject}`, 'helpdesk', String(id), false, String(t.employee_id));
      await auditFrom(user, 'helpdesk_status_changed', 'helpdesk', String(id), { ticket: t.ticket_no, from: t.status, to: b.status });
    }
    return jsonSuccess({ message: 'Saved' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
export const PUT = withApiLog(PUT_handler);
