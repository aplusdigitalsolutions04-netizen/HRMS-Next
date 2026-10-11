// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

const STATUSES = ['Available', 'Assigned', 'In repair', 'Lost', 'Retired'];

// One asset with its full history (every person who held it).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !(checkPermission(user, 'view_assets') || checkPermission(user, 'manage_assets'))) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const a = await query<RowDataPacket[]>('SELECT * FROM assets WHERE id = ?', [id]);
    if (a.length === 0) return jsonError('Asset not found', 404);
    const history = await query<RowDataPacket[]>(
      `SELECT s.id, e.full_name, e.emp_code, DATE_FORMAT(s.assigned_on, '%Y-%m-%d') AS assigned_on, DATE_FORMAT(s.returned_on, '%Y-%m-%d') AS returned_on,
              s.condition_out, s.condition_in, s.notes
       FROM asset_assignments s LEFT JOIN employees e ON e.id = s.employee_id WHERE s.asset_id = ? ORDER BY s.assigned_on DESC`, [id]);
    return jsonSuccess({ asset: a[0], history });
  } catch (e: any) { return jsonError(e, 500); }
}

// Edit the details of an asset, or set a status by hand (In repair / Lost / Retired / Available).
// An asset that is with somebody cannot be marked Available until it is returned.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'manage_assets')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const b = await req.json();
    const cur = await query<RowDataPacket[]>('SELECT * FROM assets WHERE id = ?', [id]);
    if (cur.length === 0) return jsonError('Asset not found', 404);

    const sets: string[] = [], vals: any[] = [];
    if (b.name !== undefined) { const v = String(b.name).trim(); if (!v) return jsonError('Name is required', 422); sets.push('name = ?'); vals.push(v.slice(0, 150)); }
    if (b.asset_type !== undefined) { const tr = (await query<RowDataPacket[]>('SELECT name FROM asset_types WHERE LOWER(name) = LOWER(?) AND is_active = 1', [String(b.asset_type).trim()]))[0]; if (!tr && String(b.asset_type).trim() !== cur[0].asset_type) return jsonError('Pick an asset type from the list (add new ones in System Masters > Asset Types)', 422); sets.push('asset_type = ?'); vals.push(tr ? tr.name : cur[0].asset_type); }
    if (b.serial_no !== undefined) { sets.push('serial_no = ?'); vals.push(String(b.serial_no).trim().slice(0, 120) || null); }
    if (b.notes !== undefined) { sets.push('notes = ?'); vals.push(String(b.notes).trim() || null); }
    if (b.asset_tag !== undefined && String(b.asset_tag).trim() !== cur[0].asset_tag) {
      const tag = String(b.asset_tag).trim().slice(0, 60);
      if (!tag) return jsonError('Asset tag is required', 422);
      const dup = await query<RowDataPacket[]>('SELECT id FROM assets WHERE asset_tag = ? AND id <> ?', [tag, id]);
      if (dup.length > 0) return jsonError('Another asset already uses this tag', 409);
      sets.push('asset_tag = ?'); vals.push(tag);
    }
    if (b.status !== undefined && b.status !== cur[0].status) {
      if (!STATUSES.includes(b.status)) return jsonError('Unknown status', 422);
      const held = await query<RowDataPacket[]>('SELECT id FROM asset_assignments WHERE asset_id = ? AND returned_on IS NULL', [id]);
      if (held.length > 0 && b.status !== 'Assigned') return jsonError('This asset is with an employee. Return it first.', 409);
      if (held.length === 0 && b.status === 'Assigned') return jsonError('Use Assign to give the asset to an employee', 409);
      sets.push('status = ?'); vals.push(b.status);
    }
    if (sets.length === 0) return jsonError('Nothing to update', 400);
    vals.push(id);
    await execute(`UPDATE assets SET ${sets.join(', ')} WHERE id = ?`, vals);
    await auditFrom(user, 'asset_updated', 'asset', id, { asset_tag: cur[0].asset_tag, fields: sets.map(s => s.split(' ')[0]) });
    return jsonSuccess({ message: 'Asset updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'manage_assets')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const used = await query<RowDataPacket[]>('SELECT id FROM asset_assignments WHERE asset_id = ? LIMIT 1', [id]);
    if (used.length > 0) return jsonError('This asset has history, so it cannot be deleted. Mark it Retired instead.', 409);
    const cur = await query<RowDataPacket[]>('SELECT asset_tag FROM assets WHERE id = ?', [id]);
    await execute('DELETE FROM assets WHERE id = ?', [id]);
    await auditFrom(user, 'asset_deleted', 'asset', id, { asset_tag: cur[0]?.asset_tag });
    return jsonSuccess({ message: 'Asset deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
