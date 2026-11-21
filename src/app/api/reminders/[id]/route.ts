// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now } from '@/lib/utils';
import { execute, query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM email_reminders WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Reminder not found', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const { id } = await params;
    const body = await req.json();
    const t = now();
    const sets = []; const vals = [];
    if (body.status) { sets.push('status=?'); vals.push(body.status); }
    if (body.reminder_time) { sets.push('reminder_time=?'); vals.push(body.reminder_time); }
    if (body.custom_delay) { sets.push('delay_minutes=?'); vals.push(body.custom_delay); }
    sets.push('updated_at=?'); vals.push(t);
    if (sets.length > 1) { vals.push(id); await execute(`UPDATE email_reminders SET ${sets.join(',')} WHERE id=?`, vals); }
    return jsonSuccess({ message: 'Reminder updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const { id } = await params;
    await execute('DELETE FROM email_reminders WHERE id=?', [id]);
    return jsonSuccess({ message: 'Reminder deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
