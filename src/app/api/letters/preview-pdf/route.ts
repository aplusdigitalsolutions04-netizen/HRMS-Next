// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { maxLetterLen, renderLetterPdf, longDate, getBreakup, getBreakupColumns } from '@/lib/letters';
import { isDocBody, parseDoc, fillDoc } from '@/lib/letter-doc';
import { compensationMarkup } from '@/lib/compensation';

// The letter as the PDF it will become, before it is made (or before a change to a made letter is saved): the letterhead, the page breaks,
// the tables and the signature are all in it. Nothing is saved. POST { text, ref_no?, letter_date? (YYYY-MM-DD), title? }
async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json().catch(() => ({}));
    let text = String(b.text || '').trim();
    if (text.length < 5) return jsonError('The letter is empty', 422);
    if (text.length > maxLetterLen(text)) return jsonError('The letter is too long', 422);
    // the text of a letter kind (not of a made letter): the words stay as they are, the salary table is shown with a sample salary
    if (b.sample && isDocBody(text)) { const d = parseDoc(text); if (d) text = JSON.stringify(fillDoc(d, { compensation_table: compensationMarkup(60000, 0, await getBreakup(), 'Rs.', 'Variable Pay', await getBreakupColumns()) }, true).doc); }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.letter_date || '')) ? String(b.letter_date) : '';
    const pdf = await renderLetterPdf({ title: String(b.title || 'Letter preview').slice(0, 100), ref: String(b.ref_no || '').trim().slice(0, 30), date: longDate(day), text });
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="letter-preview.pdf"' } });
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
