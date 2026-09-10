// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const csv = 'Employee Code,Date,In Time,Out Time,Status\nEMP0001,2024-01-01,09:00,18:00,Present\n';
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="Attendance_Format.csv"'
      }
    });
  } catch (e: any) { return jsonError(e, 500); }
}
