// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

// Asset Types master: the list of types an asset can have (Laptop, ID Card, ...). Nothing is built in -
// HR adds what the company uses. Types already used by assets from before the master existed are
// copied in the first time this is opened.
async function adopt() {
  await execute("INSERT IGNORE INTO asset_types (name, is_active) SELECT DISTINCT asset_type, 1 FROM assets WHERE asset_type IS NOT NULL AND asset_type <> ''");
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !(checkPermission(user, 'view_assets') || checkPermission(user, 'manage_assets'))) return jsonError('Insufficient permissions', 403);
    await adopt();
    const rows = await query<RowDataPacket[]>(
      `SELECT t.id, t.name, t.is_active, COUNT(a.id) AS assets
       FROM asset_types t LEFT JOIN assets a ON a.asset_type = t.name GROUP BY t.id, t.name, t.is_active ORDER BY t.name`);
    return jsonSuccess({ types: rows.map(r => ({ id: r.id, name: r.name, is_active: Number(r.is_active) === 1, assets: Number(r.assets) || 0 })) });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'manage_assets')) return jsonError('Insufficient permissions', 403);
    const name = String((await req.json()).name || '').trim().slice(0, 60);
    if (!name) return jsonError('Type name is required', 422);
    const dup = await query<RowDataPacket[]>('SELECT id FROM asset_types WHERE LOWER(name) = LOWER(?)', [name]);
    if (dup.length > 0) return jsonError('This type already exists', 409);
    const r = await execute('INSERT INTO asset_types (name, is_active) VALUES (?, 1)', [name]);
    await auditFrom(user, 'asset_type_added', 'asset_type', String(r.insertId), { name });
    return jsonSuccess({ id: r.insertId, name, message: 'Type added' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

// Rename (assets of that type follow the new name) and/or switch a type on or off.
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'manage_assets')) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const cur = (await query<RowDataPacket[]>('SELECT * FROM asset_types WHERE id = ?', [b.id]))[0];
    if (!cur) return jsonError('Type not found', 404);

    if (b.name !== undefined && String(b.name).trim() !== cur.name) {
      const name = String(b.name).trim().slice(0, 60);
      if (!name) return jsonError('Type name is required', 422);
      const dup = await query<RowDataPacket[]>('SELECT id FROM asset_types WHERE LOWER(name) = LOWER(?) AND id <> ?', [name, cur.id]);
      if (dup.length > 0) return jsonError('Another type already has this name', 409);
      await execute('UPDATE asset_types SET name = ? WHERE id = ?', [name, cur.id]);
      await execute('UPDATE assets SET asset_type = ? WHERE asset_type = ?', [name, cur.name]);
      await auditFrom(user, 'asset_type_renamed', 'asset_type', String(cur.id), { from: cur.name, to: name });
    }
    if (b.is_active !== undefined) {
      await execute('UPDATE asset_types SET is_active = ? WHERE id = ?', [b.is_active ? 1 : 0, cur.id]);
      await auditFrom(user, 'asset_type_changed', 'asset_type', String(cur.id), { name: cur.name, active: !!b.is_active });
    }
    return jsonSuccess({ message: 'Saved' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'manage_assets')) return jsonError('Insufficient permissions', 403);
    const id = parseInt(new URL(req.url).searchParams.get('id') || '');
    const cur = (await query<RowDataPacket[]>('SELECT * FROM asset_types WHERE id = ?', [id]))[0];
    if (!cur) return jsonError('Type not found', 404);
    const used = await query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM assets WHERE asset_type = ?', [cur.name]);
    if (Number(used[0].n) > 0) return jsonError(`${used[0].n} asset(s) use "${cur.name}". Switch it off instead of deleting it.`, 409);
    await execute('DELETE FROM asset_types WHERE id = ?', [id]);
    await auditFrom(user, 'asset_type_deleted', 'asset_type', String(id), { name: cur.name });
    return jsonSuccess({ message: 'Type deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
