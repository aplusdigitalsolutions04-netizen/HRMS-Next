// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensureLeaveTypes } from '@/lib/masters';
import { auditFrom } from '@/lib/audit';

// Leave Types master. Everyone signed in may read the active names (the apply form and the filters use them);
// only HR who can approve leave may change the list.
const canManage = (user: any) => user.type === 'admin' && checkPermission(user, 'approve_leave');

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    await ensureLeaveTypes();
    if (new URL(req.url).searchParams.get('manage')) {
      if (user.type !== 'admin' || !(checkPermission(user, 'view_leave') || checkPermission(user, 'approve_leave'))) return jsonError('Insufficient permissions', 403);
      const rows = await query<RowDataPacket[]>(
        `SELECT t.id, t.name, t.is_active,
                (SELECT COUNT(*) FROM leave_requests r WHERE r.leave_type = t.name) AS requests
         FROM leave_types t ORDER BY t.name`);
      return jsonSuccess({ types: rows.map(r => ({ id: r.id, name: r.name, is_active: Number(r.is_active) === 1, requests: Number(r.requests) || 0 })) });
    }
    const rows = await query<RowDataPacket[]>('SELECT name, is_active FROM leave_types ORDER BY name');
    return jsonSuccess({ types: rows.filter(r => Number(r.is_active) === 1).map(r => r.name), all: rows.map(r => r.name) });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    await ensureLeaveTypes();
    const name = String((await req.json()).name || '').trim().slice(0, 60);
    if (!name) return jsonError('Leave type name is required', 422);
    const dup = await query<RowDataPacket[]>('SELECT id FROM leave_types WHERE LOWER(name) = LOWER(?)', [name]);
    if (dup.length > 0) return jsonError('This leave type already exists', 409);
    const r = await execute('INSERT INTO leave_types (name, is_active) VALUES (?, 1)', [name]);
    await auditFrom(user, 'leave_type_added', 'leave_type', String(r.insertId), { name });
    return jsonSuccess({ id: r.insertId, name, message: 'Leave type added' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

// Rename (requests and balances of that type follow the new name) and/or switch a type on or off.
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const cur = (await query<RowDataPacket[]>('SELECT * FROM leave_types WHERE id = ?', [b.id]))[0];
    if (!cur) return jsonError('Leave type not found', 404);
    if (b.name !== undefined && String(b.name).trim() !== cur.name) {
      const name = String(b.name).trim().slice(0, 60);
      if (!name) return jsonError('Leave type name is required', 422);
      const dup = await query<RowDataPacket[]>('SELECT id FROM leave_types WHERE LOWER(name) = LOWER(?) AND id <> ?', [name, cur.id]);
      if (dup.length > 0) return jsonError('Another leave type already has this name', 409);
      await execute('UPDATE leave_types SET name = ? WHERE id = ?', [name, cur.id]);
      await execute('UPDATE leave_requests SET leave_type = ? WHERE leave_type = ?', [name, cur.name]);
      await execute('UPDATE leave_balances SET leave_type = ? WHERE leave_type = ?', [name, cur.name]);
      await auditFrom(user, 'leave_type_renamed', 'leave_type', String(cur.id), { from: cur.name, to: name });
    }
    if (b.is_active !== undefined) {
      await execute('UPDATE leave_types SET is_active = ? WHERE id = ?', [b.is_active ? 1 : 0, cur.id]);
      await auditFrom(user, 'leave_type_changed', 'leave_type', String(cur.id), { name: cur.name, active: !!b.is_active });
    }
    return jsonSuccess({ message: 'Saved' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const id = parseInt(new URL(req.url).searchParams.get('id') || '');
    const cur = (await query<RowDataPacket[]>('SELECT * FROM leave_types WHERE id = ?', [id]))[0];
    if (!cur) return jsonError('Leave type not found', 404);
    const used = await query<RowDataPacket[]>('SELECT (SELECT COUNT(*) FROM leave_requests WHERE leave_type = ?) + (SELECT COUNT(*) FROM leave_balances WHERE leave_type = ?) AS n', [cur.name, cur.name]);
    if (Number(used[0].n) > 0) return jsonError(`"${cur.name}" is used by leave requests or balances. Switch it off instead of deleting it.`, 409);
    await execute('DELETE FROM leave_types WHERE id = ?', [id]);
    await auditFrom(user, 'leave_type_deleted', 'leave_type', String(id), { name: cur.name });
    return jsonSuccess({ message: 'Leave type deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
