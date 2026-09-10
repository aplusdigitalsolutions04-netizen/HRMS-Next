// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, parsePagination } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    // Get current employee ID for user-scoped filtering
    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    const userId = emp.length > 0 ? String(emp[0].id) : null;

    const { searchParams } = new URL(req.url);
    const { page, perPage, offset } = parsePagination(searchParams, 20);
    const category = searchParams.get('category') || '';

    const conditions: string[] = ['(is_company_wide = 1 OR user_id = ?)'];
    const params: any[] = [userId || ''];
    if (category) { conditions.push('category = ?'); params.push(category); }

    const where = ' WHERE ' + conditions.join(' AND ');

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM notifications${where}`, params);
    const total = countRows[0].cnt;

    const rows = await query<RowDataPacket[]>(`SELECT * FROM notifications${where} ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    return jsonSuccess({
      notifications: rows,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const body = await req.json().catch(() => ({}));
    const ids = body?.ids;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return jsonError('ids is required and must be a non-empty array', 400);
    }

    // Admins/HR can delete any notification; everyone else may only delete
    // notifications visible to them (company-wide or their own).
    if (user.role === 'ADMIN' || user.role === 'HR') {
      const placeholders = ids.map(() => '?').join(',');
      const result = await execute(`DELETE FROM notifications WHERE id IN (${placeholders})`, ids);
      return jsonSuccess({ message: `${result.affectedRows ?? ids.length} notification(s) deleted` });
    }

    const emp = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
    const userId = emp.length > 0 ? String(emp[0].id) : null;
    const placeholders = ids.map(() => '?').join(',');
    const result = await execute(
      `DELETE FROM notifications WHERE id IN (${placeholders}) AND (is_company_wide = 1 OR user_id = ?)`,
      [...ids, userId || '']
    );
    return jsonSuccess({ message: `${result.affectedRows ?? 0} notification(s) deleted` });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
