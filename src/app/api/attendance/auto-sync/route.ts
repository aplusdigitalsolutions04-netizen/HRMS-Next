import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { autoImportMonth, ImportError } from '@/lib/attendance-import';

// Called by pages that show a month of attendance (Daily Attendance, Salary Sheet) the moment
// they open, so nobody has to press a Sync button. It pulls the month from TeamOffice unless
// that month was already pulled in the last few minutes, and says whether it did anything.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    // People who can view attendance may trigger the automatic refresh (it only reads TeamOffice).
    if (user.type !== 'admin' || !(checkPermission(user, 'view_attendance') || checkPermission(user, 'view_payroll') || checkPermission(user, 'upload_attendance'))) {
      return jsonError('Insufficient permissions', 403);
    }
    const body = await req.json().catch(() => ({}));
    const month = parseInt(body.month) || new Date().getMonth() + 1;
    const year = parseInt(body.year) || new Date().getFullYear();
    if (month < 1 || month > 12) return jsonError('Invalid month', 422);

    const r = await autoImportMonth(month, year, 'auto-sync', 10);
    return jsonSuccess({ ran: r.ran, message: r.message, at: new Date(r.at).toISOString() });
  } catch (e: any) {
    if (e instanceof ImportError) return jsonSuccess({ ran: false, error: e.message });
    console.error('[auto-sync] Error:', e);
    return jsonError(e, 500);
  }
}
