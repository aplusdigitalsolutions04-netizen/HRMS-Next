// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensureElFrequencies } from '@/lib/masters';
import { auditFrom } from '@/lib/audit';

// EL Frequencies master (Monthly / Quarterly / Half Yearly / Yearly ...): how often EL encashment is paid with the salary.
// Anyone who can see payroll may read it (the salary structure form uses it); managing it needs the salary-structure permission.
const canManage = (user: any) => user.type === 'admin' && checkPermission(user, 'manage_salary_structures');

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !(checkPermission(user, 'view_payroll') || canManage(user))) return jsonError('Insufficient permissions', 403);
    await ensureElFrequencies();
    const rows = await query<RowDataPacket[]>(
      `SELECT f.id, f.name, f.months, f.is_active, (SELECT COUNT(*) FROM salary_structures s WHERE s.el_frequency_id = f.id) AS used
       FROM el_frequencies f ORDER BY f.months, f.name`);
    return jsonSuccess({ frequencies: rows.map(r => ({ id: r.id, name: r.name, months: Number(r.months), is_active: Number(r.is_active) === 1, used: Number(r.used) || 0 })) });
  } catch (e: any) { return jsonError(e, 500); }
}

const cleanMonths = (v: any) => { const n = parseInt(v); return n >= 1 && n <= 12 ? n : 0; };

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    await ensureElFrequencies();
    const b = await req.json();
    const name = String(b.name || '').trim().slice(0, 60);
    const months = cleanMonths(b.months);
    if (!name) return jsonError('Name is required', 422);
    if (!months) return jsonError('Months must be a whole number from 1 to 12', 422);
    const dup = await query<RowDataPacket[]>('SELECT id FROM el_frequencies WHERE LOWER(name) = LOWER(?)', [name]);
    if (dup.length > 0) return jsonError('This frequency already exists', 409);
    const r = await execute('INSERT INTO el_frequencies (name, months, is_active) VALUES (?,?,1)', [name, months]);
    await auditFrom(user, 'el_frequency_added', 'el_frequency', String(r.insertId), { name, months });
    return jsonSuccess({ id: r.insertId, message: 'EL frequency added' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

// Rename, change the number of months, or switch on/off. Employees already on it follow the change from the next salary sheet.
async function PUT_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const cur = (await query<RowDataPacket[]>('SELECT * FROM el_frequencies WHERE id = ?', [b.id]))[0];
    if (!cur) return jsonError('Not found', 404);
    const name = b.name !== undefined ? String(b.name).trim().slice(0, 60) : cur.name;
    const months = b.months !== undefined ? cleanMonths(b.months) : Number(cur.months);
    const active = b.is_active !== undefined ? (b.is_active ? 1 : 0) : Number(cur.is_active);
    if (!name) return jsonError('Name is required', 422);
    if (!months) return jsonError('Months must be a whole number from 1 to 12', 422);
    const dup = await query<RowDataPacket[]>('SELECT id FROM el_frequencies WHERE LOWER(name) = LOWER(?) AND id <> ?', [name, cur.id]);
    if (dup.length > 0) return jsonError('Another frequency already has this name', 409);
    await execute('UPDATE el_frequencies SET name = ?, months = ?, is_active = ? WHERE id = ?', [name, months, active, cur.id]);
    await auditFrom(user, 'el_frequency_updated', 'el_frequency', String(cur.id), { name, months, active });
    return jsonSuccess({ message: 'Saved' });
  } catch (e: any) { return jsonError(e, 500); }
}

// A frequency that salary structures use is switched off instead of removed.
async function DELETE_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const id = new URL(req.url).searchParams.get('id');
    const used = (await query<RowDataPacket[]>('SELECT COUNT(*) AS c FROM salary_structures WHERE el_frequency_id = ?', [id]))[0]?.c || 0;
    if (Number(used) > 0) return jsonError(`${used} salary structure(s) use this frequency. Switch it off instead of deleting it.`, 409);
    await execute('DELETE FROM el_frequencies WHERE id = ?', [id]);
    await auditFrom(user, 'el_frequency_deleted', 'el_frequency', String(id), {});
    return jsonSuccess({ message: 'Deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
