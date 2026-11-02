// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

// HR/Admin lets an employee change their bank and contact details once (or takes the permission back).
// The employee can only look at these details until HR allows it; the permission is used up when they save.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const allow = !!b.allow;
    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code FROM employees WHERE id = ? AND COALESCE(is_deleted,0) = 0', [id]))[0];
    if (!emp) return jsonError('Employee not found', 404);

    await execute('UPDATE employees SET profile_edit_allowed = ? WHERE id = ?', [allow ? 1 : 0, id]);
    if (allow) createNotification('You can update your details', 'HR has allowed you to update your bank and contact details. Open My Profile and use Edit details.', 'profile_edit', String(id), false, String(id));
    await auditFrom(user, allow ? 'profile_edit_allowed' : 'profile_edit_revoked', 'employee', String(id), { emp_code: emp.emp_code });
    return jsonSuccess({ allowed: allow, message: allow ? `${emp.full_name} can now update the bank and contact details once.` : 'Permission taken back.' });
  } catch (e: any) { return jsonError(e, 500); }
}
