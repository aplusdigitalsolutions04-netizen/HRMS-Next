// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const body = await req.json();
    if (!body.name) return jsonError('Template name required', 422);

    await execute(
      'UPDATE email_templates SET name=?, subject=?, body=?, variables=?, template_type=? WHERE id=?',
      [body.name, body.subject || '', body.body || '', body.variables || '[]', body.template_type || 'General', id]
    );
    return jsonSuccess({ message: 'Template updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    await execute('DELETE FROM email_templates WHERE id=?', [id]);
    return jsonSuccess({ message: 'Template deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
