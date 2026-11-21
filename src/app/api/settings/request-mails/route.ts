// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, hasAnyPermission } from '@/lib/utils';
import { getMailKinds } from '@/lib/masters';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { MAIL_EVENTS, MAIL_VARIABLES, getMailTemplateMap, saveMailTemplateMap, starterTemplate } from '@/lib/request-mail';
import { auditFrom } from '@/lib/audit';
import { ensureTemplateCategories, ensureRequestMailTemplates } from '@/lib/masters';

// Which Email Template is used for each request mail (leave / WFH / missed punch / late coming, per step).
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);
    if (!hasAnyPermission(user, ['settings_templates'])) return jsonError('Insufficient permissions', 403);
    await ensureTemplateCategories();
    await ensureRequestMailTemplates();
    const MAIL_KINDS = await getMailKinds(true);
    // read both lists and match them here, instead of joining in SQL
    const all = await query<RowDataPacket[]>('SELECT * FROM email_templates');
    const categories = await query<RowDataPacket[]>('SELECT name, request_kind FROM template_categories WHERE request_kind IS NOT NULL');
    const kindByName = new Map(categories.map(c => [String(c.name).toLowerCase(), c.request_kind]));
    const templates = all.filter(t => !t.is_deleted).map(t => ({ id: t.id, name: t.name, subject: t.subject, request_kind: kindByName.get(String(t.template_type || 'General').toLowerCase()) || null })).filter(t => t.request_kind).sort((x, y) => String(x.name).localeCompare(String(y.name)));
    const byKind: Record<string, any[]> = {};
    for (const k of Object.keys(MAIL_KINDS)) {
      // the starter templates first, in the order of the steps of a request; HR's own after them, by name
      const order = Object.keys(MAIL_EVENTS).map(ev => starterTemplate(k, ev, MAIL_KINDS[k]).name);
      const rank = (n: string) => { const i = order.indexOf(n); return i < 0 ? 99 : i; };
      byKind[k] = templates.filter(t => t.request_kind === k).sort((x, y) => rank(x.name) - rank(y.name) || String(x.name).localeCompare(String(y.name))).map(t => ({ id: t.id, name: t.name, subject: t.subject }));
    }
    const categoryOf: Record<string, string> = {};
    categories.forEach(c => { categoryOf[c.request_kind] = c.name; });
    // the standard wording of every request and step: "+ New template" starts from it
    const starters: Record<string, any> = {};
    for (const [k, kn] of Object.entries(MAIL_KINDS)) for (const ev of Object.keys(MAIL_EVENTS)) starters[`${k}.${ev}`] = starterTemplate(k, ev, kn as string);
    return jsonSuccess({ map: await getMailTemplateMap(), byKind, categoryOf, kinds: MAIL_KINDS, events: MAIL_EVENTS, variables: MAIL_VARIABLES, starters });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);
    if (!hasAnyPermission(user, ['settings_templates'])) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    const incoming = body.map && typeof body.map === 'object' ? body.map : {};
    await ensureTemplateCategories();
    const MAIL_KINDS = await getMailKinds(true);
    const all = await query<RowDataPacket[]>('SELECT * FROM email_templates');
    const cats = await query<RowDataPacket[]>('SELECT name, request_kind FROM template_categories');
    const kindByName = new Map(cats.map(c => [String(c.name).toLowerCase(), c.request_kind]));
    const kindOf = new Map(all.map(t => [t.id, kindByName.get(String(t.template_type || 'General').toLowerCase()) || null]));
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

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
