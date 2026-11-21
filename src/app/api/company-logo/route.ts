import { withApiLog } from '@/lib/api-log';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Public (no login needed) so <img src="/api/company-logo"> works on the login,
// first-login password and legal pages too. It serves only the logo image that
// HR uploaded in Settings > Company Settings; if none is set, the default
// A Plus logo from /public is used.
async function GET_handler(req: Request) {
  try {
    const rows = await query<RowDataPacket[]>('SELECT company_logo FROM company_settings LIMIT 1');
    const logo: string = rows[0]?.company_logo || '';
    const m = logo.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (m) {
      // ?dark=1: the same logo for dark mode - the dark lettering is made light, the colors stay
      if (new URL(req.url).searchParams.get('dark') === '1') {
        try {
          const sharp = (await import('sharp')).default;
          const { data, info } = await sharp(Buffer.from(m[2], 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          for (let i = 0; i < data.length; i += 4) {
            const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            if (data[i + 3] > 0 && lum < 120) { data[i] = 241; data[i + 1] = 232; data[i + 2] = 223; }
          }
          const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
          return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' } });
        } catch { /* the normal logo is sent below */ }
      }
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

export const GET = withApiLog(GET_handler);
