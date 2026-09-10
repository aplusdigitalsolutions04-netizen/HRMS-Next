// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    
    let where = 'WHERE 1=1'; const params = [];
    if (status !== 'all') { where += ' AND da.action=?'; params.push(status); }
    
    const rows = await query<RowDataPacket[]>(
      `SELECT da.*, e.full_name as emp_name, e.emp_code FROM document_approvals da LEFT JOIN employees e ON da.employee_id=e.id ${where} ORDER BY da.created_at DESC`,
      params
    );
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}
