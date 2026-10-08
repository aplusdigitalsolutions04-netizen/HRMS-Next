import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { importTeamOfficeMonth, ImportError } from '@/lib/attendance-import';

// "Sync from TeamOffice" for a whole month. The work itself lives in lib/attendance-import so
// the background job and the automatic page sync use exactly the same code.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);

    const body = await req.json().catch(() => ({}));
    const month = parseInt(body.month) || new Date().getMonth() + 1;
    const year = parseInt(body.year) || new Date().getFullYear();

    const r = await importTeamOfficeMonth(month, year, user.email);
    return jsonSuccess({ message: r.message, importCount: r.importCount, errors: r.errors.length > 0 ? r.errors : undefined });
  } catch (e: any) {
    if (e instanceof ImportError) return jsonError(e.message, e.status);
    console.error('[import-teamoffice] Error:', e);
    return jsonError(e, 500);
  }
}
