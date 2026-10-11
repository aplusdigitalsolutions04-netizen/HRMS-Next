// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensureTemplateCategories } from '@/lib/masters';
import { MAIL_KINDS } from '@/lib/request-mail';
import { auditFrom } from '@/lib/audit';

// Email Template Categories master: what a template is for (Leave, Work From Home, Interview, ...).
// A category can be linked to one request mail (leave / wfh / missed_punch / late_coming): Settings > Request Mails
// then offers only the templates of that category for that mail.
const canManage = (user: any) => user.type === 'admin' && checkPermission(user, 'settings_templates');
const KINDS = Object.keys(MAIL_KINDS);

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);
    await ensureTemplateCategories();
    const rows = await query<RowDataPacket[]>(
      `SELECT c.id, c.name, c.request_kind, c.is_system,
              (SELECT COUNT(*) FROM email_templates t WHERE t.template_type = c.name AND (t.is_deleted IS NULL OR t.is_deleted = 0)) AS templates
       FROM template_categories c ORDER BY c.is_system DESC, c.name`);
    return jsonSuccess({
      categories: rows.map(r => ({ id: r.id, name: r.name, request_kind: r.request_kind || '', is_system: Number(r.is_system) === 1, templates: Number(r.templates) || 0 })),
      kinds: MAIL_KINDS,
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    await ensureTemplateCategories();
    const b = await req.json();
    const name = String(b.name || '').trim().slice(0, 100);
    if (!name) return jsonError('Category name is required', 422);
    const kind = b.request_kind && KINDS.includes(b.request_kind) ? b.request_kind : null;
    const dup = await query<RowDataPacket[]>('SELECT id FROM template_categories WHERE LOWER(name) = LOWER(?)', [name]);
    if (dup.length > 0) return jsonError('This category already exists', 409);
    const r = await execute('INSERT INTO template_categories (name, request_kind, is_system) VALUES (?,?,0)', [name, kind]);
    await auditFrom(user, 'template_category_added', 'template_category', String(r.insertId), { name, kind });
    return jsonSuccess({ id: r.insertId, name, message: 'Category added' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

// Rename (templates of that category follow) and/or link it to a request mail.
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const cur = (await query<RowDataPacket[]>('SELECT * FROM template_categories WHERE id = ?', [b.id]))[0];
    if (!cur) return jsonError('Category not found', 404);
    if (b.name !== undefined && String(b.name).trim() !== cur.name) {
      if (Number(cur.is_system) === 1) return jsonError(`"${cur.name}" is used by other screens and cannot be renamed`, 409);
      const name = String(b.name).trim().slice(0, 100);
      if (!name) return jsonError('Category name is required', 422);
      const dup = await query<RowDataPacket[]>('SELECT id FROM template_categories WHERE LOWER(name) = LOWER(?) AND id <> ?', [name, cur.id]);
      if (dup.length > 0) return jsonError('Another category already has this name', 409);
      await execute('UPDATE template_categories SET name = ? WHERE id = ?', [name, cur.id]);
      await execute('UPDATE email_templates SET template_type = ? WHERE template_type = ?', [name, cur.name]);
      await auditFrom(user, 'template_category_renamed', 'template_category', String(cur.id), { from: cur.name, to: name });
    }
    if (b.request_kind !== undefined) {
      const kind = b.request_kind && KINDS.includes(b.request_kind) ? b.request_kind : null;
      await execute('UPDATE template_categories SET request_kind = ? WHERE id = ?', [kind, cur.id]);
      await auditFrom(user, 'template_category_changed', 'template_category', String(cur.id), { name: cur.name, kind });
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
    const cur = (await query<RowDataPacket[]>('SELECT * FROM template_categories WHERE id = ?', [id]))[0];
    if (!cur) return jsonError('Category not found', 404);
    if (Number(cur.is_system) === 1) return jsonError(`"${cur.name}" is used by other screens and cannot be deleted`, 409);
    const used = await query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM email_templates WHERE template_type = ?', [cur.name]);
    if (Number(used[0].n) > 0) return jsonError(`${used[0].n} template(s) use "${cur.name}". Move them to another category first.`, 409);
    await execute('DELETE FROM template_categories WHERE id = ?', [id]);
    await auditFrom(user, 'template_category_deleted', 'template_category', String(id), { name: cur.name });
    return jsonSuccess({ message: 'Category deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
