// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const rows = await query<RowDataPacket[]>('SELECT * FROM company_settings LIMIT 1');
    return jsonSuccess(rows[0] || {});
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    const existing = await query<RowDataPacket[]>('SELECT id FROM company_settings LIMIT 1');
    const t = now();
    if (existing.length > 0) {
      await execute('UPDATE company_settings SET company_name=?, company_address=?, company_email=?, company_phone=?, company_website=?, company_logo=?, updated_on=? WHERE id=?',
        [body.company_name||'', body.company_address||'', body.company_email||'', body.company_phone||'', body.company_website||'', body.company_logo||'', t, existing[0].id]);
    } else {
      await execute('INSERT INTO company_settings (company_name, company_address, company_email, company_phone, company_website, company_logo, updated_on) VALUES (?,?,?,?,?,?,?)',
        [body.company_name||'', body.company_address||'', body.company_email||'', body.company_phone||'', body.company_website||'', body.company_logo||'', t]);
    }
    return jsonSuccess({ message: 'Company settings saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
