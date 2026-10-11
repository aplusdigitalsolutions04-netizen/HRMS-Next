// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { MAIL_KINDS, MAIL_EVENTS, MAIL_VARIABLES, getMailTemplateMap, saveMailTemplateMap } from '@/lib/request-mail';
import { auditFrom } from '@/lib/audit';
import { ensureTemplateCategories } from '@/lib/masters';

// Which Email Template is used for each request mail (leave / WFH / missed punch / late coming, per step).
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);
    await ensureTemplateCategories();
    const templates = await query<RowDataPacket[]>("SELECT t.id, t.name, t.subject, c.request_kind FROM email_templates t JOIN template_categories c ON c.name = t.template_type WHERE c.request_kind IS NOT NULL AND (t.is_deleted IS NULL OR t.is_deleted = 0) ORDER BY t.name");
    const categories = await query<RowDataPacket[]>('SELECT name, request_kind FROM template_categories WHERE request_kind IS NOT NULL');
    const byKind: Record<string, any[]> = {};
    for (const k of Object.keys(MAIL_KINDS)) byKind[k] = templates.filter(t => t.request_kind === k).map(t => ({ id: t.id, name: t.name, subject: t.subject }));
    const categoryOf: Record<string, string> = {};
    categories.forEach(c => { categoryOf[c.request_kind] = c.name; });
    return jsonSuccess({ map: await getMailTemplateMap(), byKind, categoryOf, kinds: MAIL_KINDS, events: MAIL_EVENTS, variables: MAIL_VARIABLES });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    const incoming = body.map && typeof body.map === 'object' ? body.map : {};
    await ensureTemplateCategories();
    const templates = await query<RowDataPacket[]>('SELECT t.id, c.request_kind FROM email_templates t LEFT JOIN template_categories c ON c.name = t.template_type');
    const kindOf = new Map(templates.map(t => [t.id, t.request_kind]));
    const map: Record<string, string> = {};
    for (const kind of Object.keys(MAIL_KINDS)) {
      for (const ev of Object.keys(MAIL_EVENTS)) {
        const v = incoming[`${kind}.${ev}`];
        if (v) {
          if (!kindOf.has(v)) return jsonError('One of the chosen templates no longer exists', 422);
          if (kindOf.get(v) !== kind) return jsonError(`The template chosen for ${MAIL_KINDS[kind]} does not belong to a ${MAIL_KINDS[kind]} category`, 422);
          map[`${kind}.${ev}`] = v;
        }
      }
    }
    await saveMailTemplateMap(map);
    await auditFrom(user, 'settings_changed', 'settings', 'request_mails', { templates: Object.keys(map).length });
    return jsonSuccess({ message: 'Request mail templates saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
