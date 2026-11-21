// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { letterTypes, ensureLetterTemplates, letterVars, fillLetter, letterWords, checkLetterRef } from '@/lib/letters';
import { auditFrom } from '@/lib/audit';

// Letters. GET: HR sees every letter that was made (?type= &search= &page= &per_page=); an employee sees their own.
// POST (HR, edit_employee) { employee_id, letter_type, text?, fields? } makes a letter: the template with the employee's details filled
// in, or the text HR edited. fields: { joining_date, resignation_date, last_working_day, effective_date } (dates, YYYY-MM-DD).
const isHr = (u: any) => u.type === 'admin' && checkPermission(u, 'view_employees');

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const hr = isHr(user);
    if (!hr && user.type !== 'employee') return jsonError('Insufficient permissions', 403);
    const sp = new URL(req.url).searchParams;
    const { page, perPage, offset } = parsePagination(sp, 10, 100);
    let where = 'WHERE 1=1'; const params: any[] = [];
    if (!hr) { where += ' AND l.employee_id = ?'; params.push(String(user.id)); }
    const type = sp.get('type') || '', search = (sp.get('search') || '').trim();
    const allTypes = await letterTypes();
    if (allTypes.some(t => t.key === type)) { where += ' AND l.letter_type = ?'; params.push(type); }
    if (search) { where += ' AND (e.full_name LIKE ? OR l.emp_code LIKE ? OR l.ref_no LIKE ?)'; const q = `%${search}%`; params.push(q, q, q); }
    const from = 'FROM letters_issued l LEFT JOIN employees e ON e.id = l.employee_id';
    const total = (await query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from} ${where}`, params))[0].n;
    const rows = await query<RowDataPacket[]>(
      `SELECT l.id, l.ref_no, l.letter_type, l.title, l.emp_code, e.full_name, l.issued_by, l.issued_on, l.no_date, l.emailed_at, l.emailed_to ${from} ${where} ORDER BY l.id DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    return jsonSuccess({ letters: rows, total, page, per_page: perPage, types: allTypes, ask_vars: hr ? (await letterWords()).filter(v => v.kind === 'ask').map(v => ({ key: v.key, label: v.label })) : [] });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const type = (await letterTypes()).find(t => t.key === b.letter_type);
    if (!type) return jsonError('Pick a letter type', 422);
    await ensureLetterTemplates();
    const built = await letterVars(String(b.employee_id || ''), b.fields || {});
    if (!built) return jsonError('Employee not found', 404);

    let text = String(b.text || '').trim();
    if (!text) {
      const t = (await query<RowDataPacket[]>('SELECT body FROM letter_templates WHERE letter_type = ?', [type.key]))[0];
      text = fillLetter(t?.body || '', built.vars);
    }
    if (text.length < 20) return jsonError('The letter is empty', 422);
    if (text.length > 20000) return jsonError('The letter is too long', 422);

    // HR may type a reference number for the letter (it can be left empty); a number that is typed must be new
    const chk = await checkLetterRef(b.ref_no);
    if (chk.ref === undefined) return jsonError(chk.error, chk.status);
    const ref = chk.ref;

    // the date printed on the letter is optional too: a date HR picked is used, an empty one means the letter has no date
    const day = String(b.letter_date || '').trim();
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(new Date(day).getTime()))) return jsonError('Give a valid letter date', 422);
    const r = await execute(day
      ? 'INSERT INTO letters_issued (ref_no, employee_id, emp_code, letter_type, title, body, issued_by, issued_on, no_date) VALUES (?,?,?,?,?,?,?,CONCAT(?, \' \', CURTIME()),0)'
      : 'INSERT INTO letters_issued (ref_no, employee_id, emp_code, letter_type, title, body, issued_by, no_date) VALUES (?,?,?,?,?,?,?,1)',
      day ? [ref, built.employee.id, built.employee.emp_code, type.key, type.label, text, user.email || String(user.id), day]
          : [ref, built.employee.id, built.employee.emp_code, type.key, type.label, text, user.email || String(user.id)]);
    await createNotification(`${type.label} issued`, `Your ${type.label.toLowerCase()}${ref ? ` (${ref})` : ''} is ready. Open Documents > My Letters.`, 'letter', String(r.insertId), false, String(built.employee.id));
    await auditFrom(user, 'letter_issued', 'employee', String(built.employee.id), { emp_code: built.employee.emp_code, letter: type.key, ref });
    return jsonSuccess({ id: r.insertId, ref_no: ref, message: ref ? `${type.label} made (${ref}).` : `${type.label} made.` }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
