// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { execute } from '@/lib/db';
import { cleanAnnouncement } from '@/lib/announcements';

const canManage = (u: any) => u.type === 'admin' && checkPermission(u, 'manage_announcements');

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const c: any = cleanAnnouncement(await req.json().catch(() => ({})));
    if (c.error) return jsonError(c.error, 422);
    const r: any = await execute('UPDATE announcements SET title=?, body=?, is_pinned=?, starts_on=?, expires_on=? WHERE id=?', [c.title, c.body, c.pinned, c.starts, c.expires, parseInt(id) || 0]);
    if (!r.affectedRows) return jsonError('Announcement not found', 404);
    return jsonSuccess({ message: 'Announcement updated.' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const r: any = await execute('DELETE FROM announcements WHERE id=?', [parseInt(id) || 0]);
    if (!r.affectedRows) return jsonError('Announcement not found', 404);
    return jsonSuccess({ message: 'Announcement removed.' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
