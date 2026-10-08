import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getAllStatuses, clearStatusCache, ATTENDANCE_BEHAVIORS } from '@/lib/status-master';

// Everyone who is logged in may READ the master (labels and colours are needed by the
// employee attendance page too). Changing it needs the Attendance Settings permission.
const canEdit = (user: any) => user.type === 'admin' && checkPermission(user, 'settings_attendance');

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const sp = new URL(req.url).searchParams;
    const group = sp.get('group');
    const all = sp.get('all') === '1' && canEdit(user); // editors also see inactive rows
    let rows = await getAllStatuses();
    if (group) rows = rows.filter(r => r.group_key === group);
    if (!all) rows = rows.filter(r => r.is_active === 1);
    return jsonSuccess({ statuses: rows, can_edit: canEdit(user) });
  } catch (e: any) { return jsonError(e, 500); }
}

function clean(body: any, group: string) {
  const label = String(body.label ?? '').trim().slice(0, 60);
  if (!label) throw new Error('Label is required');
  const color = /^#[0-9a-fA-F]{6}$/.test(String(body.color || '')) ? String(body.color) : '#64748b';
  const num = (v: any, min: number, max: number, name: string) => {
    const n = Number(v ?? 0);
    if (isNaN(n) || n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}`);
    return n;
  };
  const flag = (v: any) => (v === true || v === 1 || v === '1' ? 1 : 0);
  const out: any = {
    label, color,
    description: String(body.description ?? '').trim().slice(0, 500),
    used_for: String(body.used_for ?? '').trim().slice(0, 500),
    is_active: body.is_active === undefined ? 1 : flag(body.is_active),
    sort_order: Math.round(num(body.sort_order ?? 100, 0, 9999, 'Order')),
    behavior: '', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: '',
    can_login: 0, is_working: 0, in_attendance: 0,
  };
  if (group === 'attendance') {
    out.behavior = String(body.behavior || 'other');
    if (!ATTENDANCE_BEHAVIORS.includes(out.behavior)) throw new Error('Unknown behaviour');
    out.present_weight = num(body.present_weight, 0, 1, 'Present weight');
    out.unpaid_weight = num(body.unpaid_weight, 0, 1, 'Unpaid weight');
    out.extra_pay = flag(body.extra_pay);
    out.source_codes = String(body.source_codes ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).join(',').slice(0, 200);
  } else {
    out.can_login = flag(body.can_login);
    out.is_working = flag(body.is_working);
    out.in_attendance = flag(body.in_attendance);
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canEdit(user)) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    const group = body.group_key;
    if (!['employee', 'attendance'].includes(group)) return jsonError('group_key must be employee or attendance', 422);
    const code = String(body.code ?? '').trim();
    if (!/^[A-Za-z0-9_/]{1,20}$/.test(code)) return jsonError('Code can use letters, numbers, _ and / (max 20 characters)', 422);
    const dupe = await query<RowDataPacket[]>('SELECT id FROM status_master WHERE group_key = ? AND code = ?', [group, code]);
    if (dupe.length > 0) return jsonError(`A ${group} status with code "${code}" already exists`, 409);
    const d = clean(body, group);
    await execute(
      `INSERT INTO status_master (group_key, code, label, color, description, used_for, behavior, present_weight, unpaid_weight, extra_pay, source_codes, can_login, is_working, in_attendance, is_system, is_active, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
      [group, code, d.label, d.color, d.description, d.used_for, d.behavior, d.present_weight, d.unpaid_weight, d.extra_pay, d.source_codes, d.can_login, d.is_working, d.in_attendance, d.is_active, d.sort_order]
    );
    clearStatusCache();
    return jsonSuccess({ message: 'Status added' }, 201);
  } catch (e: any) { return jsonError(e?.message || e, e?.message && !/ER_|ECONN/.test(e.message) ? 422 : 500); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canEdit(user)) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    const id = parseInt(body.id);
    if (!id) return jsonError('id is required', 422);
    const rows = await query<RowDataPacket[]>('SELECT group_key FROM status_master WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('Status not found', 404);
    const d = clean(body, rows[0].group_key);
    // The code itself is never changed: saved attendance / employee rows refer to it.
    await execute(
      `UPDATE status_master SET label=?, color=?, description=?, used_for=?, behavior=?, present_weight=?, unpaid_weight=?, extra_pay=?, source_codes=?, can_login=?, is_working=?, in_attendance=?, is_active=?, sort_order=? WHERE id=?`,
      [d.label, d.color, d.description, d.used_for, d.behavior, d.present_weight, d.unpaid_weight, d.extra_pay, d.source_codes, d.can_login, d.is_working, d.in_attendance, d.is_active, d.sort_order, id]
    );
    clearStatusCache();
    return jsonSuccess({ message: 'Status saved' });
  } catch (e: any) { return jsonError(e?.message || e, e?.message && !/ER_|ECONN/.test(e.message) ? 422 : 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canEdit(user)) return jsonError('Insufficient permissions', 403);
    const id = parseInt(new URL(req.url).searchParams.get('id') || '');
    if (!id) return jsonError('id is required', 422);
    const rows = await query<RowDataPacket[]>('SELECT group_key, code, is_system FROM status_master WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('Status not found', 404);
    const s = rows[0];
    if (s.is_system === 1) return jsonError('Built-in statuses cannot be deleted. Switch it off (inactive) instead.', 409);
    const table = s.group_key === 'attendance' ? 'attendance' : 'employees';
    const used = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${table} WHERE status = ?`, [s.code]);
    if (Number(used[0].n) > 0) return jsonError(`${used[0].n} record(s) still use "${s.code}". Switch it off (inactive) instead of deleting it.`, 409);
    await execute('DELETE FROM status_master WHERE id = ?', [id]);
    clearStatusCache();
    return jsonSuccess({ message: 'Status deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
