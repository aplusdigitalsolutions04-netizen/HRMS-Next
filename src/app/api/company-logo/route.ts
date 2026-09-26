import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Public (no login needed) so <img src="/api/company-logo"> works on the login,
// first-login password and legal pages too. It serves only the logo image that
// HR uploaded in Settings > Company Settings; if none is set, the default
// A Plus logo from /public is used.
export async function GET(req: Request) {
  try {
    const rows = await query<RowDataPacket[]>('SELECT company_logo FROM company_settings LIMIT 1');
    const logo: string = rows[0]?.company_logo || '';
    const m = logo.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (m) {
      return new Response(new Uint8Array(Buffer.from(m[2], 'base64')), {
        headers: {
          'Content-Type': m[1],
          // Always re-check so a newly uploaded logo shows up straight away.
          'Cache-Control': 'no-cache',
        },
      });
    }
    if (/^https?:\/\//i.test(logo)) return NextResponse.redirect(logo);
  } catch {
    // fall through to the default logo
  }
  return NextResponse.redirect(new URL('/aplus.png', req.url));
}
