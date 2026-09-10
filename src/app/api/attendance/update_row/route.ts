import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, requireRole, calcHours } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ success: false, detail: 'Not authenticated' }, { status: 401 });
    // Matches the ADMIN_HR-only access level '/attendance/update' is routed at.
    if (!requireRole(user, [])) {
      return NextResponse.json({ success: false, detail: 'Insufficient permissions' }, { status: 403 });
    }

    const ct = req.headers.get('content-type') || '';
    let body: Record<string, string>;
    if (ct.includes('application/json')) {
      body = await req.json();
    } else {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    }

    const attendanceId = body.attendance_id;
    const status = body.status;
    if (!attendanceId || !status) {
      return NextResponse.json({ success: false, detail: 'attendance_id and status are required' }, { status: 422 });
    }

    const rows = await query<RowDataPacket[]>('SELECT id FROM attendance WHERE id = ?', [attendanceId]);
    if (rows.length === 0) return NextResponse.json({ success: false, detail: 'Attendance record not found' }, { status: 404 });

    const inTime = body.in_time && body.in_time !== '--:--' ? body.in_time : null;
    const outTime = body.out_time && body.out_time !== '--:--' ? body.out_time : null;
    const workingHours = parseFloat(calcHours(inTime || undefined, outTime || undefined)) || 0;

    await execute(
      'UPDATE attendance SET in_time=?, out_time=?, working_hours=?, status=?, is_status=1 WHERE id=?',
      [inTime, outTime, workingHours, status, attendanceId]
    );

    return NextResponse.json({ success: true, message: 'Attendance updated' });
  } catch (e: any) {
    return NextResponse.json({ success: false, detail: e?.message || 'Server error' }, { status: 500 });
  }
}
