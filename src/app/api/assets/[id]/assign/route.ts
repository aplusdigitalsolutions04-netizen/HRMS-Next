// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

const isDate = (s: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// Give an Available asset to an employee, or take it back (action: "return").
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'manage_assets')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const b = await req.json();
    const asset = (await query<RowDataPacket[]>('SELECT * FROM assets WHERE id = ?', [id]))[0];
    if (!asset) return jsonError('Asset not found', 404);
    const today = new Date().toISOString().slice(0, 10);

    if (b.action === 'return') {
      const open = (await query<RowDataPacket[]>('SELECT id, employee_id, notes FROM asset_assignments WHERE asset_id = ? AND returned_on IS NULL', [id]))[0];
      if (!open) return jsonError('This asset is not assigned to anyone', 409);
      const when = isDate(b.returned_on) ? b.returned_on : today;
      const after = ['Available', 'In repair', 'Lost', 'Retired'].includes(b.status_after) ? b.status_after : 'Available';
      await execute('UPDATE asset_assignments SET returned_on = ?, condition_in = ?, returned_by = ?, notes = CONCAT(COALESCE(notes, \'\'), ?) WHERE id = ?',
        [when, String(b.condition_in || '').trim().slice(0, 150) || null, user.email, b.notes ? `${(open.notes ? ' | ' : '')}Return: ${String(b.notes).trim().slice(0, 300)}` : '', open.id]);
      await execute('UPDATE assets SET status = ? WHERE id = ?', [after, id]);
      await auditFrom(user, 'asset_returned', 'asset', id, { asset_tag: asset.asset_tag, employee_id: open.employee_id, returned_on: when, status_after: after });
      return jsonSuccess({ message: 'Asset returned' });
    }

    if (asset.status !== 'Available') return jsonError(`This asset is ${asset.status.toLowerCase()} and cannot be assigned`, 409);
    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code FROM employees WHERE id = ? AND COALESCE(is_deleted, 0) = 0', [b.employee_id]))[0];
    if (!emp) return jsonError('Pick an employee', 422);
    const when = isDate(b.assigned_on) ? b.assigned_on : today;
    await execute('INSERT INTO asset_assignments (id, asset_id, employee_id, assigned_on, condition_out, notes, assigned_by) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), id, emp.id, when, String(b.condition_out || '').trim().slice(0, 150) || null, String(b.notes || '').trim().slice(0, 300) || null, user.email]);
    await execute("UPDATE assets SET status = 'Assigned' WHERE id = ?", [id]);
    await auditFrom(user, 'asset_assigned', 'asset', id, { asset_tag: asset.asset_tag, employee: `${emp.full_name} (${emp.emp_code})`, assigned_on: when });
    createNotification('Company asset assigned to you', `${asset.name} (${asset.asset_tag}) was assigned to you on ${when}. Please look after it and return it when asked.`, 'asset', String(id), false, String(emp.id));
    return jsonSuccess({ message: `Assigned to ${emp.full_name}` });
  } catch (e: any) { return jsonError(e, 500); }
}
