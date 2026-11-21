// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, hasAnyPermission } from '@/lib/utils';
import { execute } from '@/lib/db';
import { templateAddresses } from '@/lib/mail-addresses';

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['settings_templates'])) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    if (!body.name) return jsonError('Template name required', 422);
    
    const addr = templateAddresses(body);
    if (addr.error) return jsonError(addr.error, 422);
    const existing = await execute('SELECT id FROM email_templates WHERE name=?', [body.name]);
    if (existing && existing.length > 0) {
      await execute('UPDATE email_templates SET subject=?, body=?, variables=?, template_type=?, cc_emails=?, bcc_emails=? WHERE name=?',
        [body.subject||'', body.body||'', body.variables||'[]', body.template_type||'General', addr.cc, addr.bcc, body.name]);
    } else {
      await execute('INSERT INTO email_templates (id, name, subject, body, variables, template_type, cc_emails, bcc_emails, created_on) VALUES (?,?,?,?,?,?,?,?,NOW())',
        [uuidv4(), body.name, body.subject||'', body.body||'', body.variables||'[]', body.template_type||'General', addr.cc, addr.bcc]);
    }
    return jsonSuccess({ message: 'Template saved' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
