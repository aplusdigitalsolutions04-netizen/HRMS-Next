// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

async function POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'delete_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const rows = await query<RowDataPacket[]>('SELECT email_id, emp_code FROM employees WHERE id = ? AND is_deleted = 1', [id]);
    if (rows.length === 0) return jsonError('Deleted employee not found', 404);

    // If the email was freed up on delete it carries a "deleted_<time>_" prefix; older deletes also changed the employee ID to
    // "del<time>_<code>". The real values are read back from them and put back only when nobody else is using them now.
    const emailM = /^deleted_\d+_(.+)$/.exec(String(rows[0].email_id || ''));
    const codeM = /^del\d+_(.+)$/.exec(String(rows[0].emp_code || ''));
    const email = emailM ? emailM[1] : rows[0].email_id;
    const code = codeM ? codeM[1] : rows[0].emp_code;
    if (!rows[0].emp_code) {
      return jsonError('This employee has no employee ID any more, so the record cannot be brought back automatically. Edit the record manually if you need it back.', 409);
    }
    if (emailM) {
      const taken = await query<RowDataPacket[]>('SELECT id FROM employees WHERE LOWER(email_id) = LOWER(?) AND id <> ?', [email, id]);
      if (taken.length > 0) return jsonError(`The email ${email} has been given to another employee since, so this record cannot be restored with it. Change that employee's email first.`, 409);
    }
    if (codeM) {
      const taken = await query<RowDataPacket[]>('SELECT id FROM employees WHERE emp_code = ? AND id <> ?', [code, id]);
      if (taken.length > 0) return jsonError(`The employee ID ${code} has been given to another employee since, so this record cannot be restored with it.`, 409);
    }

    await execute('UPDATE employees SET is_deleted = 0, deleted_at = NULL, email_id = ?, emp_code = ? WHERE id = ?', [email, code, id]);
    await auditFrom(user, 'employee_restored', 'employee', id, { email_restored: !!emailM, code_restored: !!codeM });
    return jsonSuccess({ message: 'Employee restored' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const POST = withApiLog(POST_handler);
