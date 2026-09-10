// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM email_drafts WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Draft not found', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const body = await req.json();
    const t = now();
    await execute(
      `UPDATE email_drafts SET to_email=?, subject=?, body=?, cc=?, bcc=?, attachments=?, status=?, updated_at=? WHERE id=?`,
      [body.to_email||'', body.subject||'', body.body||'', body.cc||'', body.bcc||'', JSON.stringify(body.attachments||[]), body.status||'draft', t, id]
    );
    return jsonSuccess({ message: 'Draft updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    await execute('DELETE FROM email_drafts WHERE id=?', [id]);
    return jsonSuccess({ message: 'Draft deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
