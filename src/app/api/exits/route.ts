// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { exitReasons, EXIT_STATUSES, exitChecklist, parseJson } from '@/lib/exits';
import { getFnfSettings } from '@/lib/fnf';
import { auditFrom } from '@/lib/audit';

// Employees who are leaving (HR). GET ?status= &search= &page= &per_page=   POST (edit_employee) starts an exit:
// { employee_id, resignation_date, last_working_day, reason, notice_days? }
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(new Date(v).getTime());

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    const sp = new URL(req.url).searchParams;
    const { page, perPage, offset } = parsePagination(sp, 10, 100);
    let where = 'WHERE 1=1'; const params: any[] = [];
    const status = sp.get('status') || '', search = (sp.get('search') || '').trim();
    if (EXIT_STATUSES.includes(status)) { where += ' AND x.status = ?'; params.push(status); }
    if (search) { where += ' AND (e.full_name LIKE ? OR x.emp_code LIKE ?)'; const q = `%${search}%`; params.push(q, q); }
    const from = 'FROM employee_exits x JOIN employees e ON e.id = x.employee_id';
    const total = (await query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from} ${where}`, params))[0].n;
    const rows = await query<RowDataPacket[]>(
      `SELECT x.id, x.employee_id, x.emp_code, e.full_name, e.designation, DATE_FORMAT(x.resignation_date, '%Y-%m-%d') AS resignation_date, DATE_FORMAT(x.last_working_day, '%Y-%m-%d') AS last_working_day,
              x.reason, x.status, x.fnf_total, x.checklist ${from} ${where} ORDER BY x.last_working_day ASC, x.id DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    const counts = await query<RowDataPacket[]>('SELECT status, COUNT(*) AS n FROM employee_exits GROUP BY status');
    const c: Record<string, number> = {}; for (const r of counts) c[r.status] = Number(r.n);
    const cfg = await getFnfSettings();
    return jsonSuccess({
      exits: rows.map(r => { const list = parseJson(r.checklist, []); return { ...r, checklist: undefined, done: list.filter((x: any) => x.done).length, items: list.length }; }),
      total, page, per_page: perPage, counts: c, reasons: await exitReasons(), statuses: EXIT_STATUSES, settings: { notice_days: cfg.noticeDays, el_rate: cfg.elRate, notice_recovery: cfg.noticeRecovery },
    });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const emp = (await query<RowDataPacket[]>('SELECT id, emp_code, full_name FROM employees WHERE id = ? AND is_deleted = 0', [String(b.employee_id || '')]))[0];
    if (!emp) return jsonError('Employee not found', 404);
    if (!isDate(b.resignation_date) || !isDate(b.last_working_day)) return jsonError('Please give the resignation date and the last working day', 422);
    if (b.last_working_day < b.resignation_date) return jsonError('The last working day cannot be before the resignation date', 422);
    const dup = await query<RowDataPacket[]>('SELECT id FROM employee_exits WHERE employee_id = ?', [emp.id]);
    if (dup.length) return jsonError('An exit is already started for this employee', 409);
    const cfg = await getFnfSettings();
    const notice = Number.isFinite(parseInt(b.notice_days)) ? Math.min(365, Math.max(0, parseInt(b.notice_days))) : cfg.noticeDays;
    const reasons = await exitReasons();
    const reason = reasons.includes(b.reason) ? b.reason : reasons[0];
    const checklist = (await exitChecklist()).map(label => ({ label, done: false, done_on: null, by: null }));
    const r = await execute(
      'INSERT INTO employee_exits (employee_id, emp_code, resignation_date, last_working_day, notice_days, reason, status, checklist, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [emp.id, emp.emp_code, b.resignation_date, b.last_working_day, notice, reason, 'In Progress', JSON.stringify(checklist), user.email || String(user.id)]);
    await auditFrom(user, 'exit_started', 'employee', String(emp.id), { emp_code: emp.emp_code, last_working_day: b.last_working_day });
    return jsonSuccess({ id: r.insertId, message: `Exit started for ${emp.full_name}.` }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
