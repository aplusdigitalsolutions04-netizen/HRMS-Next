// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { generatePDF } from '@/lib/payslip-pdf';

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>(
      `SELECT p.*, e.full_name, e.designation, e.pay_mode, e.date_of_joining, e.account_number, e.bank_name, e.location, e.pan, e.uan
       FROM payslips p JOIN employees e ON p.emp_code = e.emp_code WHERE p.id=?`,
      [id]
    );
    if (rows.length === 0) return jsonError('Payslip not found', 404);
    if (user.type === 'employee' && rows[0].emp_code !== user.emp_code) {
      return jsonError('Not authorized to access this payslip', 403);
    }
    const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_address, company_logo FROM company_settings LIMIT 1');
    const buf = await generatePDF({ ...rows[0], ...(companyRows[0] || {}) });
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Payslip_${rows[0].emp_code}_${rows[0].month}_${rows[0].year}.pdf"`,
      }
    });
  } catch (e) {
    console.error('Payslip download error:', e);
    return jsonError(e, 500);
  }
}
