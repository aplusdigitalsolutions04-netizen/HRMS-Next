// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensureRequestTypes } from '@/lib/masters';
import { getMailTemplateMap, saveMailTemplateMap } from '@/lib/request-mail';
import { auditFrom } from '@/lib/audit';

// Request Types master: the kinds of request a request mail can be for (Leave, Work From Home, ...). Email template categories
// are linked to one of them, and Settings > Request Mails sets the mail templates per type.
// Nothing is locked: every type, including the four it starts with, can be renamed, switched off or deleted. Those four start
// here only once (the first use); a deleted one does not come back. Sending a type's mails needs the request flow behind it.
const canManage = (user: any) => user.type === 'admin' && checkPermission(user, 'settings_templates');
const slug = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'request';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);
    await ensureRequestTypes();
    const rows = await query<RowDataPacket[]>('SELECT id, type_key, name, is_system, is_active FROM request_types ORDER BY is_system DESC, name');
    const cats = await query<RowDataPacket[]>('SELECT request_kind, COUNT(*) AS n FROM template_categories WHERE request_kind IS NOT NULL GROUP BY request_kind');
    const used = new Map(cats.map(c => [c.request_kind, Number(c.n)]));
    return jsonSuccess({ types: rows.map(r => ({ id: r.id, key: r.type_key, name: r.name, is_active: Number(r.is_active) === 1, categories: used.get(r.type_key) || 0 })) });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    await ensureRequestTypes();
    const b = await req.json();
    const name = String(b.name || '').trim().slice(0, 60);
    if (!name) return jsonError('Name is required', 422);
    const dup = await query<RowDataPacket[]>('SELECT id FROM request_types WHERE LOWER(name) = LOWER(?)', [name]);
    if (dup.length > 0) return jsonError('This request type already exists', 409);
    let key = slug(name), n = 2;
    while ((await query<RowDataPacket[]>('SELECT id FROM request_types WHERE type_key = ?', [key])).length > 0) key = slug(name).slice(0, 26) + '_' + n++;
    const r = await execute('INSERT INTO request_types (type_key, name, is_system, is_active) VALUES (?,?,0,1)', [key, name]);
    await auditFrom(user, 'request_type_added', 'request_type', String(r.insertId), { name, key });
    return jsonSuccess({ id: r.insertId, key, message: 'Request type added' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

// rename and/or switch on or off
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const cur = (await query<RowDataPacket[]>('SELECT * FROM request_types WHERE id = ?', [b.id]))[0];
    if (!cur) return jsonError('Request type not found', 404);
    if (b.name !== undefined && String(b.name).trim() !== cur.name) {
      const name = String(b.name).trim().slice(0, 60);
      if (!name) return jsonError('Name is required', 422);
      const dup = await query<RowDataPacket[]>('SELECT id FROM request_types WHERE LOWER(name) = LOWER(?) AND id <> ?', [name, cur.id]);
      if (dup.length > 0) return jsonError('Another request type already has this name', 409);
      await execute('UPDATE request_types SET name = ? WHERE id = ?', [name, cur.id]);
      await auditFrom(user, 'request_type_renamed', 'request_type', String(cur.id), { from: cur.name, to: name });
    }
    if (b.is_active !== undefined) {
      await execute('UPDATE request_types SET is_active = ? WHERE id = ?', [b.is_active ? 1 : 0, cur.id]);
      await auditFrom(user, 'request_type_changed', 'request_type', String(cur.id), { name: cur.name, active: !!b.is_active });
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
    const cur = (await query<RowDataPacket[]>('SELECT * FROM request_types WHERE id = ?', [id]))[0];
    if (!cur) return jsonError('Request type not found', 404);
    // template categories linked to it are unlinked, and the mail templates chosen for it in Request Mails are dropped
    await execute('UPDATE template_categories SET request_kind = NULL WHERE request_kind = ?', [cur.type_key]);
    const map = await getMailTemplateMap();
    const kept = Object.fromEntries(Object.entries(map).filter(([k]) => !k.startsWith(cur.type_key + '.')));
    if (Object.keys(kept).length !== Object.keys(map).length) await saveMailTemplateMap(kept);
    await execute('DELETE FROM request_types WHERE id = ?', [id]);
    await auditFrom(user, 'request_type_deleted', 'request_type', String(id), { name: cur.name });
    return jsonSuccess({ message: 'Request type deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
