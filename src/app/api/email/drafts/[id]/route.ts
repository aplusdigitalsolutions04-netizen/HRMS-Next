// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, hasAnyPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_drafts', 'manage_drafts', 'send_candidate_emails', 'add_candidate'])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM email_drafts WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Draft not found', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_drafts', 'manage_drafts', 'send_candidate_emails', 'add_candidate'])) return jsonError('Insufficient permissions', 403);
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

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_drafts', 'manage_drafts', 'send_candidate_emails', 'add_candidate'])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('DELETE FROM email_drafts WHERE id=?', [id]);
    return jsonSuccess({ message: 'Draft deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
