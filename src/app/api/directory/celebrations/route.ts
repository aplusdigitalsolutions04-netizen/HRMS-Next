// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { employeeCodes, inList } from '@/lib/status-master';

// Birthdays and work anniversaries of a month, for everyone to see. Only the day and month of a birthday are given (never the year),
// and an anniversary shows the number of years completed. GET ?month=1-12 (this month when missing)
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const now = new Date();
    const month = parseInt(new URL(req.url).searchParams.get('month') || '') || now.getMonth() + 1;
    if (month < 1 || month > 12) return jsonError('Month must be 1 to 12', 422);

    const working = inList(await employeeCodes('is_working'));
    const base = `FROM employees e WHERE e.is_deleted = 0 AND e.status IN ${working.sql}`;
    const birthdays = await query<RowDataPacket[]>(
      `SELECT e.id, e.full_name, e.designation, DAY(e.dob) AS day FROM employees e WHERE e.is_deleted = 0 AND e.status IN ${working.sql} AND e.dob IS NOT NULL AND MONTH(e.dob) = ? ORDER BY DAY(e.dob), e.full_name`,
      [...working.params, month]);
    const anniversaries = await query<RowDataPacket[]>(
      `SELECT e.id, e.full_name, e.designation, DAY(e.date_of_joining) AS day, (? - YEAR(e.date_of_joining)) AS years
       FROM employees e WHERE e.is_deleted = 0 AND e.status IN ${working.sql} AND e.date_of_joining IS NOT NULL AND MONTH(e.date_of_joining) = ? AND YEAR(e.date_of_joining) < ?
       ORDER BY DAY(e.date_of_joining), e.full_name`,
      [now.getFullYear(), ...working.params, month, now.getFullYear()]);
    return jsonSuccess({
      month, year: now.getFullYear(), today: { day: now.getDate(), month: now.getMonth() + 1 },
      birthdays: birthdays.map(b => ({ ...b, day: Number(b.day) })),
      anniversaries: anniversaries.map(a => ({ ...a, day: Number(a.day), years: Number(a.years) })),
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
