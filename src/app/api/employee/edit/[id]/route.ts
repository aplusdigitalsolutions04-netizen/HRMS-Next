// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { hashPassword } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const body = await req.json();
    
    const allowedFields = ['emp_code', 'full_name', 'email_id', 'mobile_no', 'father_spouse_name', 'dob', 'present_address',
      'permanent_address', 'college_name', 'course_name', 'specialization', 'course_duration', 'cgpa',
      'alternate_mobile_no', 'official_email', 'official_no', 'previous_company', 'designation', 'status', 'profile_photo',
      'bank_name', 'account_number', 'pan', 'location', 'date_of_joining', 'uan', 'document_sources', 'manager_id', 'pay_mode'];

    if (body.manager_id === id) return jsonError('An employee cannot be their own reporting manager', 422);

    const sets = [];
    const vals = [];
    for (const f of allowedFields) {
      if (body[f] !== undefined) { sets.push(`\`${f}\` = ?`); vals.push(f === 'manager_id' && !body[f] ? null : body[f]); }
    }
    if (body.password && body.password.length >= 6) {
      sets.push('password = ?'); vals.push(hashPassword(body.password));
    }
    if (sets.length === 0) return jsonError('No fields to update', 400);
    vals.push(id);
    await execute(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (body.password && body.password.length >= 6) {
      // Keep the credentials-sent record in sync so "Employee Credentials"
      // reflects the employee's actual current password, not the stale one.
      await execute('UPDATE employee_credentials SET password = ? WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1', [body.password, id]).catch(() => {});
    }
    return jsonSuccess({ message: 'Employee updated' });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY' && String(e.sqlMessage || '').includes('emp_code')) {
      return jsonError('Employee ID already exists', 409);
    }
    return jsonError(e, 500);
  }
}
