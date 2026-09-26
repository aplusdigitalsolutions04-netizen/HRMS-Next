import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { syncTodayPunches } from '@/lib/teamoffice';

// The HR page polls this; one TeamOffice call for everyone at most this often.
const MIN_INTERVAL_MS = 15000;
let lastSync = 0;

// Pulls today's IN/OUT punches for ALL employees so check-ins and check-outs
// appear on the HR daily attendance page without pressing sync.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_attendance')) return jsonError('Insufficient permissions', 403);

    const now = Date.now();
    if (now - lastSync < MIN_INTERVAL_MS) return jsonSuccess({ synced: false, throttled: true });
    lastSync = now;

    return jsonSuccess(await syncTodayPunches('ALL', user.email));
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
