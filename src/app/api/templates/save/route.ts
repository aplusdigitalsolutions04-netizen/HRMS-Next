// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4 } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    if (!body.name) return jsonError('Template name required', 422);
    
    const existing = await execute('SELECT id FROM email_templates WHERE name=?', [body.name]);
    if (existing && existing.length > 0) {
      await execute('UPDATE email_templates SET subject=?, body=?, variables=? WHERE name=?',
        [body.subject||'', body.body||'', body.variables||'[]', body.name]);
    } else {
      await execute('INSERT INTO email_templates (id, name, subject, body, variables, created_on) VALUES (?,?,?,?,?,NOW())',
        [uuidv4(), body.name, body.subject||'', body.body||'', body.variables||'[]']);
    }
    return jsonSuccess({ message: 'Template saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
