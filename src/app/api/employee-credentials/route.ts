// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { decryptSecret } from '@/lib/mailbox';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_employee')) return jsonError('Insufficient permissions', 403);

    // one password, when HR presses the eye: ?reveal=<row id>  (recorded in the Audit Log)
    const reveal = new URL(req.url).searchParams.get('reveal');
    if (reveal) {
      const r = (await query<RowDataPacket[]>('SELECT id, employee_id, emp_code, password FROM employee_credentials WHERE id = ?', [reveal]))[0];
      if (!r) return jsonError('Record not found', 404);
      await auditFrom(user, 'credential_viewed', 'employee', String(r.employee_id), { emp_code: r.emp_code });
      return jsonSuccess({ password: decryptSecret(r.password) });
    }
    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM employee_credentials ORDER BY created_at DESC'
    );
    return jsonSuccess(rows.map(r => ({ ...r, has_password: !!r.password && r.password !== '(own password)', password: r.password === '(own password)' ? r.password : '' })));
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
