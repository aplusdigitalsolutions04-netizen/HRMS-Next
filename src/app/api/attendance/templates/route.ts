// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const rows = await query<RowDataPacket[]>('SELECT * FROM attendance_templates ORDER BY created_at DESC');
    return jsonSuccess(rows.map(r => ({ ...r, columns: typeof r.columns === 'string' ? JSON.parse(r.columns) : r.columns })));
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    if (!body.name) return jsonError('Template name required', 422);
    const id = uuidv4();
    const t = now();
    await execute('INSERT INTO attendance_templates (id, name, columns, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      [id, body.name, JSON.stringify(body.columns || []), false, t, t]);
    return jsonSuccess({ id, message: 'Template created' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}
