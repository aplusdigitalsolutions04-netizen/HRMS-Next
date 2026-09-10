import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4 } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const variables = await query<RowDataPacket[]>('SELECT id, name, description, created_at FROM template_variables ORDER BY created_at ASC');
    return jsonSuccess(variables);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

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
