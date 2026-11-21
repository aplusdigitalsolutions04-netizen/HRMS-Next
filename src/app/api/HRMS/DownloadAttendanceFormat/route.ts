// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const csv = 'Employee Code,Date,In Time,Out Time,Status\nEMP0001,2024-01-01,09:00,18:00,Present\n';
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="Attendance_Format.csv"'
      }
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
