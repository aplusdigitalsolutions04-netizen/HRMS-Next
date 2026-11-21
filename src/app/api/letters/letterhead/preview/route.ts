// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { renderLetterPdf, getLetterhead, longDate } from '@/lib/letters';

// A sample letter drawn with the letterhead settings as they are on the screen (not yet saved), so HR sees the result first.
// POST { mode, image?, top_mm, bottom_mm }: an image that is not sent is the saved one.
const SAMPLE = `# SAMPLE LETTER

Dear Employee,

This is a sample letter to show how the text sits on your letterhead. The text starts below the space kept at the top and stops above the space kept at the bottom.

- First point of the letter
- Second point of the letter
- Third point of the letter

When a letter is longer than one page, the letterhead is drawn on every page in the same way. Change the space at the top or the bottom if the text covers a part of the letterhead, then preview again.

Sample text, line one.
Sample text, line two.

Thank you.

Authorised Signatory`;

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    const b = await req.json().catch(() => ({}));
    const saved = await getLetterhead();
    const lh = {
      mode: ['company', 'image', 'none'].includes(b.mode) ? b.mode : saved.mode,
      image: typeof b.image === 'string' ? b.image : saved.image,
      placement: ['auto', 'top', 'bottom', 'full'].includes(b.placement) ? b.placement : saved.placement,
      top_mm: Math.min(120, Math.max(0, Math.round(Number(b.top_mm)) || 0)),
      bottom_mm: Math.min(80, Math.max(0, Math.round(Number(b.bottom_mm)) || 0)),
    };
    const pdf = await renderLetterPdf({ title: 'Sample letter', ref: '', date: longDate(new Date().toISOString().slice(0, 10)), text: SAMPLE }, lh);
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="letterhead-preview.pdf"' } });
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
