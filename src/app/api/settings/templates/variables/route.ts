import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, hasAnyPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['settings_templates', 'send_candidate_emails', 'view_drafts', 'manage_drafts', 'add_candidate'])) return jsonError('Insufficient permissions', 403);

    const variables = await query<RowDataPacket[]>('SELECT id, name, description, created_at FROM template_variables ORDER BY created_at ASC');
    return jsonSuccess(variables);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['settings_templates', 'send_candidate_emails', 'view_drafts', 'manage_drafts', 'add_candidate'])) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    let { name, description } = body;

    if (!name) return jsonError('Variable name is required');
    
    // Format name to ensure it has { } braces
    name = name.trim().toUpperCase();
    if (!name.startsWith('{')) name = '{' + name;
    if (!name.endsWith('}')) name = name + '}';
    // Replace spaces with underscores
    name = name.replace(/\s+/g, '_');

    const existing = await query<RowDataPacket[]>('SELECT id FROM template_variables WHERE name = ?', [name]);
    if (existing.length > 0) {
      return jsonError('A custom variable with this name already exists');
    }

    const id = uuidv4();
    await execute(
      'INSERT INTO template_variables (id, name, description) VALUES (?, ?, ?)',
      [id, name, description || 'Custom Variable']
    );

    return jsonSuccess({ message: 'Variable created successfully', id, name, description });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
