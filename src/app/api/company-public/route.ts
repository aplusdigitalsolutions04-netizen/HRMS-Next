import { withApiLog } from '@/lib/api-log';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Public (no login needed): only the company name and contact email, for the login and legal pages, which are shown before anyone signs in.
async function GET_handler() {
  try {
    const r = (await query<RowDataPacket[]>('SELECT company_name, company_email FROM company_settings LIMIT 1'))[0] || {};
    return NextResponse.json({ company_name: r.company_name || '', company_email: r.company_email || '' });
  } catch {
    return NextResponse.json({ company_name: '', company_email: '' });
  }
}

export const GET = withApiLog(GET_handler);
