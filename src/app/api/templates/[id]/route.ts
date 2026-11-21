// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, hasAnyPermission } from '@/lib/utils';
import { templateAddresses } from '@/lib/mail-addresses';
import { execute } from '@/lib/db';

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['settings_templates', 'send_candidate_emails', 'view_drafts', 'manage_drafts', 'add_candidate'])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const body = await req.json();
    if (!body.name) return jsonError('Template name required', 422);
    const addr = templateAddresses(body);
    if (addr.error) return jsonError(addr.error, 422);

    await execute(
      'UPDATE email_templates SET name=?, subject=?, body=?, variables=?, template_type=?, cc_emails=?, bcc_emails=? WHERE id=?',
      [body.name, body.subject || '', body.body || '', body.variables || '[]', body.template_type || 'General', addr.cc, addr.bcc, id]
    );
    return jsonSuccess({ message: 'Template updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['settings_templates', 'send_candidate_emails', 'view_drafts', 'manage_drafts', 'add_candidate'])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('DELETE FROM email_templates WHERE id=?', [id]);
    return jsonSuccess({ message: 'Template deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
