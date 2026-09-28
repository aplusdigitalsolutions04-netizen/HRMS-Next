// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const rows = await query<RowDataPacket[]>('SELECT * FROM email_templates ORDER BY created_on DESC');
    return jsonSuccess(rows.map(r => ({ ...r, variables: typeof r.variables === 'string' ? r.variables : JSON.stringify(r.variables || []) })));
  } catch (e: any) { return jsonError(e, 500); }
}
