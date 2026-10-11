import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Read-only lookup behind the top-bar search. Each group is only searched when the caller already has
// the permission to view that data (same permissions the matching list pages use), and every group fails
// on its own, so one problem never hides the others.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);

    const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 60);
    if (q.length < 2) return jsonSuccess({ employees: [], candidates: [], departments: [] });
    const like = `%${q}%`;
    const run = async <T,>(allowed: boolean, fn: () => Promise<T>): Promise<T | []> => {
      if (!allowed) return [];
      try { return await fn(); } catch (e: any) { console.error('[search] group failed:', e?.message || e); return []; }
    };

    const [employees, candidates, departments] = await Promise.all([
      run(checkPermission(user, 'view_employees'), () => query<RowDataPacket[]>(
        `SELECT id, full_name, emp_code, email_id, designation, status FROM employees
         WHERE is_deleted = 0 AND (full_name LIKE ? OR emp_code LIKE ? OR email_id LIKE ? OR mobile_no LIKE ?)
         ORDER BY full_name LIMIT 6`, [like, like, like, like])),
      run(checkPermission(user, 'view_candidates'), () => query<RowDataPacket[]>(
        `SELECT id, candidate_name, email_id, contact_number FROM interview_candidates
         WHERE candidate_name LIKE ? OR email_id LIKE ? OR contact_number LIKE ?
         ORDER BY uploaded_on DESC LIMIT 5`, [like, like, like])),
      run(checkPermission(user, 'view_departments'), () => query<RowDataPacket[]>(
        `SELECT id, name FROM departments WHERE name LIKE ? ORDER BY name LIMIT 4`, [like])),
    ]);
    return jsonSuccess({ employees, candidates, departments });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
