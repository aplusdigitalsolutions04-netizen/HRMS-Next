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
    const rows = await query<RowDataPacket[]>('SELECT * FROM email_drafts WHERE candidate_id=? ORDER BY updated_at DESC LIMIT 1', [id]);
    if (rows.length === 0) return jsonError('No draft found for this candidate', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    await execute('DELETE FROM email_drafts WHERE candidate_id=?', [id]);
    return jsonSuccess({ message: 'Draft deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
