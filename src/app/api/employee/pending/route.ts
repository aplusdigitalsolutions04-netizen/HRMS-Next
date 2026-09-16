// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, hashPassword, splitEmails, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword as hp } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_employee')) return jsonError('Insufficient permissions', 403);
    const rows = await query<RowDataPacket[]>('SELECT * FROM employees WHERE status = ? AND is_deleted = 0 ORDER BY created_on DESC', ['pending']);
    return jsonSuccess(rows);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
