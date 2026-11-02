// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

// What an employee may change once HR has allowed it (employees.profile_edit_allowed). Saving uses the permission up.
const FIELDS: Record<string, number> = {
  bank_name: 100, account_number: 40, pan: 20, uan: 30,
  alternate_mobile_no: 20, present_address: 500, permanent_address: 500,
};

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'employee') return jsonError('Only an employee can change these details here', 403);
    const emp = (await query<RowDataPacket[]>('SELECT id, emp_code, profile_edit_allowed FROM employees WHERE id = ? AND COALESCE(is_deleted,0) = 0', [user.id]))[0];
    if (!emp) return jsonError('Employee not found', 404);
    if (!emp.profile_edit_allowed) return jsonError('HR has not allowed you to change these details. Ask HR to allow it.', 403);

    const b = await req.json().catch(() => ({}));
    const sets: string[] = [];
    const vals: any[] = [];
    const changed: string[] = [];
    for (const [f, max] of Object.entries(FIELDS)) {
      if (b[f] === undefined) continue;
      const v = String(b[f] ?? '').trim();
      if (v.length > max) return jsonError(`${f.replace(/_/g, ' ')} is too long`, 422);
      sets.push(`\`${f}\` = ?`); vals.push(v); changed.push(f);
    }
    if (b.account_number !== undefined && String(b.account_number).trim() && !/^[0-9]{6,24}$/.test(String(b.account_number).trim())) return jsonError('The account number should have digits only (6 to 24)', 422);
    if (b.pan !== undefined && String(b.pan).trim() && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(String(b.pan).trim())) return jsonError('The PAN should look like ABCDE1234F', 422);
    if (!sets.length) return jsonError('Nothing to save', 422);
    // the PAN is kept in capitals
    const panAt = changed.indexOf('pan');
    if (panAt >= 0) vals[panAt] = String(vals[panAt]).toUpperCase();

    await execute(`UPDATE employees SET ${sets.join(', ')}, profile_edit_allowed = 0 WHERE id = ?`, [...vals, user.id]);
    await auditFrom(user, 'profile_details_changed', 'employee', String(user.id), { emp_code: emp.emp_code, fields: changed });
    return jsonSuccess({ message: 'Your details have been updated.' });
  } catch (e: any) { return jsonError(e, 500); }
}
