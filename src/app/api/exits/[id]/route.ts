// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { exitReasons, loadExit, parseJson, cleanLines } from '@/lib/exits';
import { suggestFnf, fnfNet } from '@/lib/fnf';
import { auditFrom } from '@/lib/audit';

// One exit. GET: the exit, its checklist and the settlement (the saved lines, or the suggested ones when none are saved yet).
// PUT (edit_employee): dates, reason, remarks, checklist [{label, done}] and the settlement lines [{label, amount, type}].
// POST { action }: recalculate (new suggestions, HR's own lines are kept) | settle (the settlement is final) | reopen | complete (the employee is dropped).
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(new Date(v).getTime());
const canEdit = (u: any) => u.type === 'admin' && checkPermission(u, 'edit_employee');

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const x = await loadExit(id);
    if (!x) return jsonError('Exit not found', 404);
    let lines = parseJson(x.fnf_json, null);
    let info: any = {};
    const sug = await suggestFnf({ emp_code: x.emp_code, resignation_date: x.resignation, last_working_day: x.lwd, notice_days: x.notice_days }).catch((e: any) => ({ lines: [], info: { warnings: ['The suggestion could not be worked out: ' + (e?.message || '')] } }));
    info = sug.info;
    const saved = lines !== null;
    if (!saved) lines = sug.lines;
    return jsonSuccess({
      exit: { id: x.id, employee_id: x.employee_id, emp_code: x.emp_code, full_name: x.full_name, designation: x.designation, joined: x.joined, resignation_date: x.resignation, last_working_day: x.lwd,
        notice_days: x.notice_days, reason: x.reason, status: x.status, remarks: x.remarks, employee_status: x.employee_status, settled_on: x.settled_on, completed_on: x.completed_on },
      checklist: parseJson(x.checklist, []), lines, saved, net: fnfNet(lines), info, reasons: await exitReasons(),
    });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canEdit(user)) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const x = await loadExit(id);
    if (!x) return jsonError('Exit not found', 404);
    if (x.status === 'Completed') return jsonError('This exit is completed and cannot be changed', 409);
    const b = await req.json();
    const sets: string[] = []; const vals: any[] = [];

    const resignation = b.resignation_date !== undefined ? b.resignation_date : x.resignation, lwd = b.last_working_day !== undefined ? b.last_working_day : x.lwd;
    if (b.resignation_date !== undefined || b.last_working_day !== undefined) {
      if (!isDate(resignation) || !isDate(lwd)) return jsonError('Please give valid dates', 422);
      if (lwd < resignation) return jsonError('The last working day cannot be before the resignation date', 422);
      if (x.status === 'Settled' && (lwd !== x.lwd)) return jsonError('The settlement is final. Reopen it to change the last working day.', 409);
      sets.push('resignation_date = ?', 'last_working_day = ?'); vals.push(resignation, lwd);
    }
    if (b.notice_days !== undefined) { const n = parseInt(b.notice_days); if (!(n >= 0 && n <= 365)) return jsonError('Notice days must be 0 to 365', 422); sets.push('notice_days = ?'); vals.push(n); }
    if (b.reason !== undefined) { sets.push('reason = ?'); { const rs = await exitReasons(); vals.push(rs.includes(b.reason) ? b.reason : rs[rs.length - 1]); } }
    if (b.remarks !== undefined) { sets.push('remarks = ?'); vals.push(String(b.remarks).slice(0, 500) || null); }
    if (Array.isArray(b.checklist)) {
      const old = parseJson(x.checklist, []);
      const next = b.checklist.slice(0, 30).map((c: any, i: number) => {
        const was = old[i] && old[i].label === c.label ? old[i] : null;
        const done = !!c.done;
        return { label: String(c.label || '').slice(0, 150), done, done_on: done ? (was && was.done ? was.done_on : new Date().toISOString().slice(0, 10)) : null, by: done ? (was && was.done ? was.by : (user.email || null)) : null };
      }).filter((c: any) => c.label);
      sets.push('checklist = ?'); vals.push(JSON.stringify(next));
    }
    if (Array.isArray(b.lines)) {
      if (x.status === 'Settled') return jsonError('The settlement is final. Reopen it to change the amounts.', 409);
      const lines = cleanLines(b.lines);
      sets.push('fnf_json = ?', 'fnf_total = ?'); vals.push(JSON.stringify(lines), fnfNet(lines));
    }
    if (!sets.length) return jsonError('Nothing to change', 400);
    vals.push(id);
    await execute(`UPDATE employee_exits SET ${sets.join(', ')} WHERE id = ?`, vals);
    return jsonSuccess({ message: 'Saved' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canEdit(user)) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const x = await loadExit(id);
    if (!x) return jsonError('Exit not found', 404);
    const action = String((await req.json().catch(() => ({}))).action || '');

    if (action === 'recalculate') {
      if (x.status !== 'In Progress') return jsonError('The settlement is final. Reopen it first.', 409);
      const sug = await suggestFnf({ emp_code: x.emp_code, resignation_date: x.resignation, last_working_day: x.lwd, notice_days: x.notice_days });
      const manual = (parseJson(x.fnf_json, []) as any[]).filter(l => !l.auto);
      const lines = [...sug.lines, ...manual];
      await execute('UPDATE employee_exits SET fnf_json = ?, fnf_total = ? WHERE id = ?', [JSON.stringify(lines), fnfNet(lines), id]);
      return jsonSuccess({ message: 'The suggested amounts were worked out again. Your own lines were kept.' });
    }
    if (action === 'settle') {
      if (x.status !== 'In Progress') return jsonError('Already settled', 409);
      let lines = parseJson(x.fnf_json, null);
      if (lines === null) { lines = (await suggestFnf({ emp_code: x.emp_code, resignation_date: x.resignation, last_working_day: x.lwd, notice_days: x.notice_days })).lines; }
      await execute("UPDATE employee_exits SET status = 'Settled', settled_on = NOW(), fnf_json = ?, fnf_total = ? WHERE id = ?", [JSON.stringify(lines), fnfNet(lines), id]);
      await auditFrom(user, 'exit_settled', 'employee', String(x.employee_id), { emp_code: x.emp_code, net: fnfNet(lines) });
      return jsonSuccess({ message: 'The full and final settlement is marked as done.' });
    }
    if (action === 'reopen') {
      if (x.status !== 'Settled') return jsonError('Only a settled exit can be reopened', 409);
      await execute("UPDATE employee_exits SET status = 'In Progress', settled_on = NULL WHERE id = ?", [id]);
      return jsonSuccess({ message: 'Reopened. The amounts can be changed again.' });
    }
    if (action === 'complete') {
      if (x.status !== 'Settled') return jsonError('Mark the full and final settlement as done first', 409);
      await execute("UPDATE employees SET status = 'dropped', exit_date = ? WHERE id = ?", [x.lwd, x.employee_id]);
      await execute("UPDATE employee_exits SET status = 'Completed', completed_on = NOW() WHERE id = ?", [id]);
      await auditFrom(user, 'exit_completed', 'employee', String(x.employee_id), { emp_code: x.emp_code, last_working_day: x.lwd });
      return jsonSuccess({ message: `${x.full_name} is now marked as having left (Dropped). Their login is closed.` });
    }
    return jsonError('Unknown action', 422);
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
export const POST = withApiLog(POST_handler);
