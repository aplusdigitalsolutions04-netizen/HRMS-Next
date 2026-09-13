import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';
import * as XLSX from 'xlsx';

const HEADERS = [
  'Name', 'Email', 'Mobile', 'Father/Spouse Name', 'DOB', 'Present Address', 'Permanent Address',
  'College Name', 'Course Name', 'Specialization', 'Course Duration', 'CGPA', 'Alternate Mobile',
  'Official Email', 'Official No', 'Previous Company', 'Bank Name', 'Account Number', 'PAN',
  'Location', 'Date of Joining', 'UAN', 'Pay Mode',
];

const SAMPLE_ROW = [
  'John Doe', 'john.doe@example.com', '9876543210', 'Richard Doe', '1995-05-20', 'City, State', 'City, State',
  'ABC College', 'B.Tech', 'Computer Science', '4 Years', '8.2', '9123456780',
  'john.doe@company.com', '9123456781', 'Previous Pvt Ltd', 'HDFC Bank', '123456789012', 'ABCDE1234F',
  'Gurgaon, HR', '2026-01-15', '123456789012', 'Online',
];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, SAMPLE_ROW]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="employee_import_template.xlsx"',
      },
    });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
