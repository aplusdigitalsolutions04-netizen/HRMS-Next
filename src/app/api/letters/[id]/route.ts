// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { maxLetterLen, renderLetterPdf, longDate, checkLetterRef } from '@/lib/letters';
import { auditFrom } from '@/lib/audit';

// The PDF of a letter that was made (HR, or the employee it is for).
async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const l = (await query<RowDataPacket[]>("SELECT *, IF(no_date = 1, '', DATE_FORMAT(issued_on, '%Y-%m-%d')) AS day FROM letters_issued WHERE id = ?", [id]))[0];
    if (!l) return jsonError('Letter not found', 404);
    const hr = user.type === 'admin' && checkPermission(user, 'view_employees');
    if (!hr && !(user.type === 'employee' && String(l.employee_id) === String(user.id))) return jsonError('Letter not found', 404);
    // ?json=1 gives the details HR edits instead of the PDF
    if (hr && new URL(req.url).searchParams.get('json')) return jsonSuccess({ id: l.id, ref_no: l.ref_no || '', title: l.title, body: l.body, day: l.day, emp_code: l.emp_code, emailed_at: l.emailed_at });
    const pdf = await renderLetterPdf({ title: l.title, ref: l.ref_no || '', date: longDate(l.day), text: l.body });
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${String(l.ref_no || 'letter').replace(/[^\w.-]/g, '_')}_${String(l.emp_code || '').replace(/[^\w.-]/g, '_')}.pdf"` } });
  } catch (e: any) { return jsonError(e, 500); }
}

// HR changes a letter that was made: its reference number, its date and its text. The PDF is drawn from these each time it is opened
// or mailed, so a letter that was already sent by mail has to be sent again to carry the change.
async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const l = (await query<RowDataPacket[]>("SELECT id, ref_no, emp_code, body, IF(no_date = 1, '', DATE_FORMAT(issued_on, '%Y-%m-%d')) AS day FROM letters_issued WHERE id = ?", [id]))[0];
    if (!l) return jsonError('Letter not found', 404);
    const b = await req.json().catch(() => ({}));
    const chk = await checkLetterRef(b.ref_no, id);
    if (chk.ref === undefined) return jsonError(chk.error, chk.status);
    const text = String(b.text || '').trim();
    if (text.length < 20) return jsonError('The letter is empty', 422);
    if (text.length > maxLetterLen(text)) return jsonError('The letter is too long', 422);
    // the letter date is optional: not sent = unchanged, empty = no date on the letter
    const day = b.day === undefined ? l.day : String(b.day || '');
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(new Date(day).getTime()))) return jsonError('Give a valid letter date', 422);
    if (day) await execute('UPDATE letters_issued SET ref_no = ?, body = ?, issued_on = CONCAT(?, \' \', TIME(issued_on)), no_date = 0 WHERE id = ?', [chk.ref, text, day, id]);
    else await execute('UPDATE letters_issued SET ref_no = ?, body = ?, no_date = 1 WHERE id = ?', [chk.ref, text, id]);
    await auditFrom(user, 'letter_edited', 'employee', String(l.emp_code || id), { letter_id: Number(id), ref_before: l.ref_no, ref_after: chk.ref, text_changed: text !== l.body, date_changed: day !== l.day });
    return jsonSuccess({ message: 'Letter updated', ref_no: chk.ref });
  } catch (e: any) { return jsonError(e, 500); }
}

// HR removes a letter that was made. The letter is gone for good: the employee no longer sees it under My Letters and its PDF cannot be
// opened again. Its "letter issued" notice is removed too. Mails that were already sent stay with whoever received them.
async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const l = (await query<RowDataPacket[]>('SELECT id, ref_no, title, emp_code, employee_id FROM letters_issued WHERE id = ?', [id]))[0];
    if (!l) return jsonError('Letter not found', 404);
    await execute('DELETE FROM letters_issued WHERE id = ?', [id]);
    await execute("DELETE FROM notifications WHERE category = 'letter' AND reference_id = ?", [String(l.id)]).catch(() => {});
    await auditFrom(user, 'letter_deleted', 'employee', String(l.emp_code || l.employee_id), { letter_id: Number(l.id), ref: l.ref_no || '', letter: l.title });
    return jsonSuccess({ message: 'Letter deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
