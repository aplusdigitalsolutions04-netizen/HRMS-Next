// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cleanAnnouncement } from '@/lib/announcements';

// Notices for the home page. Everyone signed in reads the ones that are running today; HR with "Post Announcements" manages them.
// GET            running notices (pinned first, newest next)
// GET ?all=1     every notice, for the people who manage them
// POST { title, body, is_pinned, starts_on, expires_on }
const canManage = (u: any) => u.type === 'admin' && checkPermission(u, 'manage_announcements');
const COLS = `id, title, body, is_pinned, DATE_FORMAT(starts_on, '%Y-%m-%d') AS starts_on, DATE_FORMAT(expires_on, '%Y-%m-%d') AS expires_on, created_by, created_at`;

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (new URL(req.url).searchParams.get('all') === '1') {
      if (!canManage(user)) return jsonError('Insufficient permissions', 403);
      const rows = await query<RowDataPacket[]>(`SELECT ${COLS} FROM announcements ORDER BY is_pinned DESC, created_at DESC LIMIT 300`);
      return jsonSuccess({ announcements: rows });
    }
    const rows = await query<RowDataPacket[]>(
      `SELECT ${COLS} FROM announcements WHERE (starts_on IS NULL OR starts_on <= CURDATE()) AND (expires_on IS NULL OR expires_on >= CURDATE())
       ORDER BY is_pinned DESC, created_at DESC LIMIT 20`);
    return jsonSuccess({ announcements: rows });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const c: any = cleanAnnouncement(await req.json().catch(() => ({})));
    if (c.error) return jsonError(c.error, 422);
    const r: any = await execute('INSERT INTO announcements (title, body, is_pinned, starts_on, expires_on, created_by) VALUES (?,?,?,?,?,?)',
      [c.title, c.body, c.pinned, c.starts, c.expires, user.name || user.email || null]);
    return jsonSuccess({ id: r.insertId, message: 'Announcement posted.' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
