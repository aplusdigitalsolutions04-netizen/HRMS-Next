// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { hashPassword } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { saveEmployeeDocument } from '@/lib/googleDrive';

const allowedFields = ['emp_code', 'full_name', 'email_id', 'mobile_no', 'father_spouse_name', 'dob', 'present_address',
  'permanent_address', 'college_name', 'course_name', 'specialization', 'course_duration', 'cgpa',
  'alternate_mobile_no', 'official_email', 'official_no', 'previous_company', 'designation', 'status', 'profile_photo',
  'bank_name', 'account_number', 'pan', 'location', 'date_of_joining', 'uan', 'document_sources', 'manager_id', 'pay_mode'];

const docColumns = ['identity_proof', 'address_proof', 'resume_path', 'ug_document', 'marksheet10', 'marksheet12',
  'offer_letter', 'pg_document', 'appointment_letter', 'internship_certificate', 'photograph', 'bank_document'];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const ct = req.headers.get('content-type') || '';
    const isMultipart = ct.includes('multipart/form-data');
    const body: Record<string, any> = {};
    const fileMap: Record<string, File> = {};
    let additionalFiles: File[] = [];

    if (isMultipart) {
      const fd = await req.formData();
      for (const [key, val] of fd.entries()) {
        if (val instanceof File) {
          if (key === 'additional_documents_new') additionalFiles.push(val);
          else if (docColumns.includes(key)) fileMap[key] = val;
        } else {
          body[key] = val;
        }
      }
    } else {
      Object.assign(body, await req.json());
    }

    if (body.manager_id === id) return jsonError('An employee cannot be their own reporting manager', 422);

    const dateFields = new Set(['dob', 'date_of_joining']);
    const sets: string[] = [];
    const vals: any[] = [];
    for (const f of allowedFields) {
      if (body[f] !== undefined) {
        let v = body[f];
        if (f === 'manager_id' && !v) v = null;
        else if (dateFields.has(f) && v === '') v = null;
        sets.push(`\`${f}\` = ?`); vals.push(v);
      }
    }
    if (body.password && body.password.length >= 6) {
      sets.push('password = ?'); vals.push(hashPassword(body.password));
    }

    if (Object.keys(fileMap).length > 0 || additionalFiles.length > 0) {
      const existing = await query<RowDataPacket[]>('SELECT emp_code, full_name, additional_documents FROM employees WHERE id = ?', [id]);
      if (existing.length === 0) return jsonError('Employee not found', 404);
      const empCode = body.emp_code || existing[0].emp_code;
      const fullName = body.full_name || existing[0].full_name;

      const fileCols = Object.keys(fileMap);
      const savedPaths = await Promise.all(fileCols.map(col => saveEmployeeDocument(empCode, fullName, fileMap[col])));
      fileCols.forEach((col, i) => { sets.push(`\`${col}\` = ?`); vals.push(savedPaths[i]); });

      if (additionalFiles.length > 0) {
        let current: string[] = [];
        try { current = JSON.parse(existing[0].additional_documents || '[]'); } catch { current = []; }
        const newPaths = await Promise.all(additionalFiles.map(file => saveEmployeeDocument(empCode, fullName, file)));
        sets.push('`additional_documents` = ?'); vals.push(JSON.stringify([...current, ...newPaths]));
      }
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
