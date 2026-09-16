import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    if (user.type === 'admin') {
      const rows = await query<RowDataPacket[]>('SELECT id, email, full_name, role, mobile_no, department, designation, profile_photo, last_login, is_active, permissions FROM hr_admins WHERE id = ?', [user.id]);
      if (rows.length === 0) return jsonError('User not found', 404);
      const u = rows[0];
      return jsonSuccess({
        id: u.id,
        email: u.email,
        full_name: u.full_name || '',
        role: u.role || 'HR_STAFF',
        mobile_no: u.mobile_no || '',
        department: u.department || '',
        designation: u.designation || '',
        profile_photo: u.profile_photo || '',
        last_login: u.last_login,
        is_active: u.is_active,
        permissions: u.permissions ? JSON.parse(u.permissions) : {},
      });
    } else {
      const rows = await query<RowDataPacket[]>(
        `SELECT id, emp_code, email_id, full_name, status, hr_remarks, profile_photo, last_login, designation, mobile_no,
          dob, present_address, permanent_address, father_spouse_name, college_name, course_name, specialization,
          course_duration, cgpa, alternate_mobile_no, previous_company, bank_name, account_number, pan, location, date_of_joining
         FROM employees WHERE id = ?`,
        [user.id]
      );
      if (rows.length === 0) return jsonError('User not found', 404);
      const u = rows[0];
      return jsonSuccess({
        id: u.id,
        emp_code: u.emp_code,
        email: u.email_id,
        full_name: u.full_name || '',
        status: u.status,
        hr_remarks: u.hr_remarks || '',
        profile_photo: u.profile_photo || '',
        last_login: u.last_login,
        designation: u.designation || '',
        mobile_no: u.mobile_no || '',
        dob: u.dob,
        present_address: u.present_address,
        permanent_address: u.permanent_address,
        father_spouse_name: u.father_spouse_name,
        college_name: u.college_name,
        course_name: u.course_name,
        specialization: u.specialization,
        course_duration: u.course_duration,
        cgpa: u.cgpa,
        alternate_mobile_no: u.alternate_mobile_no,
        previous_company: u.previous_company,
        bank_name: u.bank_name,
        account_number: u.account_number,
        pan: u.pan,
        location: u.location,
        date_of_joining: u.date_of_joining,
        role: 'USER',
      });
    }
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();

    if (user.type === 'admin') {
      const allowedFields = ['full_name', 'mobile_no', 'department', 'designation', 'profile_photo'];
      const sets: string[] = [];
      const vals: any[] = [];
      for (const f of allowedFields) {
        if (body[f] !== undefined) {
          sets.push(`\`${f}\` = ?`);
          vals.push(body[f]);
        }
      }
      if (sets.length > 0) {
        vals.push(user.id);
        await execute(`UPDATE hr_admins SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
    } else {
      const allowedFields = ['full_name', 'mobile_no', 'profile_photo', 'present_address', 'father_spouse_name'];
      const sets: string[] = [];
      const vals: any[] = [];
      for (const f of allowedFields) {
        if (body[f] !== undefined) {
          sets.push(`\`${f}\` = ?`);
          vals.push(body[f]);
        }
      }
      if (sets.length > 0) {
        vals.push(user.id);
        await execute(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
    }
    return jsonSuccess({ message: 'Profile updated' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
