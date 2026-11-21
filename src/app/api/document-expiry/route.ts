// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { DOC_OPTIONS } from '@/lib/documents';
import { auditFrom } from '@/lib/audit';
import { runDocumentExpiryCheck } from '@/lib/document-expiry';

// Document expiry: the date until which an employee's document is valid, so HR and the employee are reminded before it ends.
// GET  HR:       ?window=expired|30|60|all (default 60) &search= &page= &per_page=   - every document with an expiry date
//      employee: their own dates ({ items: [{ document_type, label, expiry_date, days_left }] })
//      HR with ?employee_id=  - the dates of one employee (used on the Documents tab of the employee profile)
// PUT  HR (edit_employee) { employee_id, document_type, expiry_date | null } sets or clears one date
const LABEL = (k: string) => DOC_OPTIONS.find(d => d.key === k)?.label || k;
const daysLeft = (d: any) => Math.round((new Date(String(d).slice(0, 10) + 'T00:00:00Z').getTime() - Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000);

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const sp = new URL(req.url).searchParams;

    if (user.type === 'employee') {
      const rows = await query<RowDataPacket[]>("SELECT document_type, DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date FROM document_expiry WHERE employee_id = ? ORDER BY expiry_date", [String(user.id)]);
      return jsonSuccess({ items: rows.map(r => ({ ...r, label: LABEL(r.document_type), days_left: daysLeft(r.expiry_date) })) });
    }
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);

    const one = sp.get('employee_id');
    if (one) {
      const rows = await query<RowDataPacket[]>("SELECT document_type, DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date FROM document_expiry WHERE employee_id = ?", [one]);
      return jsonSuccess({ items: rows.map(r => ({ ...r, label: LABEL(r.document_type), days_left: daysLeft(r.expiry_date) })) });
    }

    const { page, perPage, offset } = parsePagination(sp, 10, 100);
    const win = sp.get('window') || '60';
    let where = 'WHERE e.is_deleted = 0'; const params: any[] = [];
    if (win === 'expired') where += ' AND x.expiry_date < CURDATE()';
    else if (win === '30' || win === '60') { where += ' AND x.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)'; params.push(Number(win)); }
    const search = (sp.get('search') || '').trim();
    if (search) { where += ' AND (e.full_name LIKE ? OR e.emp_code LIKE ?)'; const q = `%${search}%`; params.push(q, q); }

    const from = 'FROM document_expiry x JOIN employees e ON e.id = x.employee_id';
    const total = (await query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from} ${where}`, params))[0].n;
    const rows = await query<RowDataPacket[]>(
      `SELECT x.employee_id, x.document_type, DATE_FORMAT(x.expiry_date, '%Y-%m-%d') AS expiry_date, e.full_name, e.emp_code, e.designation ${from} ${where} ORDER BY x.expiry_date ASC, e.full_name LIMIT ${perPage} OFFSET ${offset}`, params);
    const sum = (await query<RowDataPacket[]>(
      `SELECT SUM(x.expiry_date < CURDATE()) AS expired, SUM(x.expiry_date >= CURDATE() AND x.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS soon, COUNT(*) AS all_dates
       FROM document_expiry x JOIN employees e ON e.id = x.employee_id WHERE e.is_deleted = 0`))[0];
    return jsonSuccess({
      items: rows.map(r => ({ ...r, label: LABEL(r.document_type), days_left: daysLeft(r.expiry_date) })), total, page, per_page: perPage,
      summary: { expired: Number(sum.expired) || 0, within_30: Number(sum.soon) || 0, all: Number(sum.all_dates) || 0 },
    });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const type = String(b.document_type || '');
    if (!DOC_OPTIONS.some(d => d.key === type)) return jsonError('Unknown document', 422);
    const emp = (await query<RowDataPacket[]>('SELECT id, emp_code FROM employees WHERE id = ? AND is_deleted = 0', [String(b.employee_id || '')]))[0];
    if (!emp) return jsonError('Employee not found', 404);

    if (!b.expiry_date) {
      await execute('DELETE FROM document_expiry WHERE employee_id = ? AND document_type = ?', [emp.id, type]);
      await auditFrom(user, 'document_expiry_cleared', 'employee', String(emp.id), { emp_code: emp.emp_code, document: type });
      return jsonSuccess({ message: 'Expiry date removed' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.expiry_date)) || isNaN(new Date(b.expiry_date).getTime())) return jsonError('Please give a valid date', 422);
    // a new date starts the reminders again
    await execute(
      `INSERT INTO document_expiry (employee_id, document_type, expiry_date, last_notice, updated_by, updated_at) VALUES (?,?,?,NULL,?,NOW())
       ON DUPLICATE KEY UPDATE expiry_date = VALUES(expiry_date), last_notice = NULL, updated_by = VALUES(updated_by), updated_at = NOW()`,
      [emp.id, type, b.expiry_date, user.email || String(user.id)]);
    await auditFrom(user, 'document_expiry_set', 'employee', String(emp.id), { emp_code: emp.emp_code, document: type, expiry_date: b.expiry_date });
    return jsonSuccess({ message: 'Expiry date saved' });
  } catch (e: any) { return jsonError(e, 500); }
}

// Sends the reminders that are due now (the server also does this by itself every few hours). Each reminder goes out once.
async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const r = await runDocumentExpiryCheck();
    return jsonSuccess({ ...r, message: r.reminded ? `Sent ${r.reminded} reminder(s).` : 'No new reminders are due.' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
export const POST = withApiLog(POST_handler);
