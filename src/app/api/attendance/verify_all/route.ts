import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'verify_attendance')) return jsonError('Insufficient permissions', 403);

    const t = now();
    const result = await execute('UPDATE attendance_summary SET is_verified=1, verified_by=?, verified_on=? WHERE is_verified IS NULL OR is_verified=0', [user.email, t]);
    return jsonSuccess({ message: `All attendance records verified`, affected: result.affectedRows });
  } catch (e: any) { return jsonError(e, 500); }
}
