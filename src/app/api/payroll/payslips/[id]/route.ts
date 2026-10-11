// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM payslips WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Payslip not found', 404);
    if (user.type === 'employee' && rows[0].emp_code !== user.emp_code) {
      return jsonError('Not authorized to access this payslip', 403);
    }
    if (user.type === 'employee' && String(rows[0].status || 'APPROVED').toUpperCase() !== 'APPROVED') return jsonError('Payslip not found', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'delete_payslips')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const was = await query<RowDataPacket[]>('SELECT emp_code, month, year, status FROM payslips WHERE id=?', [id]);
    await execute('DELETE FROM payslips WHERE id=?', [id]);
    await auditFrom(user, 'payslip_deleted', 'payslip', id, was[0] || null);
    return jsonSuccess({ message: 'Payslip deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
