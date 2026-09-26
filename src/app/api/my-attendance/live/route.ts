// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { syncTodayPunches } from '@/lib/teamoffice';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// The page polls this; don't hit TeamOffice more often than this per employee.
const MIN_INTERVAL_MS = 15000;
const lastSync = new Map<string, number>();

// Pulls today's punch for the logged-in employee so a fresh check-in shows up
// without any manual sync.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const emp = await query<RowDataPacket[]>('SELECT emp_code FROM employees WHERE email_id = ?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    const empCode = emp[0].emp_code;

    const now = Date.now();
    if (now - (lastSync.get(empCode) || 0) < MIN_INTERVAL_MS) return jsonSuccess({ synced: false, throttled: true });
    lastSync.set(empCode, now);

    return jsonSuccess(await syncTodayPunches(empCode, user.email));
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
