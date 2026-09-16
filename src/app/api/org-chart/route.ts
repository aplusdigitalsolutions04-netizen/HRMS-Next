// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    
    // Ensure the user has permission to view employees (Org Chart is for HR/Admin)
    if (!checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);

    // Fetch the employee list with joined department and manager names
    const rows = await query<RowDataPacket[]>(`
      SELECT 
        e.id, 
        e.full_name, 
        e.emp_code, 
        e.designation, 
        e.manager_id, 
        e.profile_photo, 
        e.status,
        d.name as department_name,
        m.full_name as manager_name
      FROM employees e
      LEFT JOIN designations de ON e.designation = de.name
      LEFT JOIN departments d ON de.department_id = d.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.is_deleted = 0
      ORDER BY e.full_name ASC
    `);

    return jsonSuccess({ data: rows });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
