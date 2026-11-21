// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmailDetailed } from '@/lib/email';
import { getConfig } from '@/lib/app-config';
import { escapeHtml, helpdeskMailOn, helpdeskCategories, STATUSES } from '@/lib/helpdesk';

// Help Desk. An employee asks HR a question (a ticket) and follows the answers; HR sees every ticket.
// GET  ?status= &category= &search= &page= &per_page=   employee: own tickets, HR: all tickets (+ counts per status)
// POST { category, subject, message }                   employee: opens a ticket
const isHr = (user: any) => user.type === 'admin' && checkPermission(user, 'view_employees');

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const hr = isHr(user);
    if (!hr && user.type !== 'employee') return jsonError('Insufficient permissions', 403);

    const sp = new URL(req.url).searchParams;
    const { page, perPage, offset } = parsePagination(sp, 10, 100);
    let where = 'WHERE 1=1'; const params: any[] = [];
    if (!hr) { where += ' AND t.employee_id = ?'; params.push(String(user.id)); }
    const status = sp.get('status') || '', category = sp.get('category') || '', search = (sp.get('search') || '').trim();
    if (status === 'active') where += " AND t.status IN ('Open', 'In Progress')";
    else if (STATUSES.includes(status)) { where += ' AND t.status = ?'; params.push(status); }
    if ((await helpdeskCategories()).includes(category)) { where += ' AND t.category = ?'; params.push(category); }
    if (search) { where += ' AND (t.subject LIKE ? OR t.ticket_no LIKE ? OR e.full_name LIKE ? OR e.emp_code LIKE ?)'; const q = `%${search}%`; params.push(q, q, q, q); }

    const from = 'FROM help_tickets t JOIN employees e ON e.id = t.employee_id';
    const total = (await query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from} ${where}`, params))[0].n;
    const rows = await query<RowDataPacket[]>(
      `SELECT t.id, t.ticket_no, t.category, t.subject, t.status, t.assigned_to, t.created_at, t.updated_at, e.full_name, e.emp_code,
              (SELECT COUNT(*) FROM help_ticket_messages m WHERE m.ticket_id = t.id) AS messages,
              (SELECT m.author_type FROM help_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_from
       ${from} ${where} ORDER BY t.updated_at DESC, t.id DESC LIMIT ${perPage} OFFSET ${offset}`, params);

    const counts = await query<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS n FROM help_tickets ${hr ? '' : 'WHERE employee_id = ?'} GROUP BY status`, hr ? [] : [String(user.id)]);
    const c: Record<string, number> = {};
    for (const r of counts) c[r.status] = Number(r.n);
    return jsonSuccess({ tickets: rows, total, page, per_page: perPage, counts: c, categories: await helpdeskCategories(), statuses: STATUSES, mail_on: hr ? await helpdeskMailOn() : undefined });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Only an employee can open a ticket', 403);
    const b = await req.json();
    const cats = await helpdeskCategories();
    const category = cats.includes(b.category) ? b.category : cats[cats.length - 1];
    const subject = String(b.subject || '').trim().slice(0, 150);
    const message = String(b.message || '').trim().slice(0, 5000);
    if (subject.length < 3) return jsonError('Please write a subject', 422);
    if (message.length < 5) return jsonError('Please describe your question', 422);

    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code, email_id FROM employees WHERE id = ?', [String(user.id)]))[0];
    if (!emp) return jsonError('Employee not found', 404);

    const r = await execute('INSERT INTO help_tickets (employee_id, category, subject, status) VALUES (?,?,?,?)', [emp.id, category, subject, 'Open']);
    const ticketNo = (await getConfig()).helpdesk_prefix + '-' + String(r.insertId).padStart(4, '0');
    await execute('UPDATE help_tickets SET ticket_no = ? WHERE id = ?', [ticketNo, r.insertId]);
    await execute('INSERT INTO help_ticket_messages (ticket_id, author_type, author_name, author_email, message) VALUES (?,?,?,?,?)',
      [r.insertId, 'employee', emp.full_name, emp.email_id, message]);

    // HR hears about it in the bell, and by mail to the company address when that is switched on
    await createNotification(`New question: ${subject}`, `${emp.full_name} (${emp.emp_code}) asked HR: ${category}. Ticket ${ticketNo}.`, 'helpdesk', String(r.insertId), true, null);
    if (await helpdeskMailOn()) {
      const co = (await query<RowDataPacket[]>('SELECT company_email FROM company_settings LIMIT 1'))[0];
      if (co?.company_email) {
        sendEmailDetailed(co.company_email, `[Help Desk ${ticketNo}] ${subject}`,
          `<p><b>${escapeHtml(emp.full_name)}</b> (${escapeHtml(emp.emp_code)}) opened a ticket.</p><p><b>Category:</b> ${escapeHtml(category)}<br/><b>Subject:</b> ${escapeHtml(subject)}</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">${escapeHtml(message).replace(/\n/g, '<br/>')}</div><p>Answer it in the HRMS: Help Desk.</p>`,
          { replyTo: emp.email_id }).catch(() => {});
      }
    }
    return jsonSuccess({ id: r.insertId, ticket_no: ticketNo, message: 'Your question was sent to HR.' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
