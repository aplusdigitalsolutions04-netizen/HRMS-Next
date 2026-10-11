// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';
import { getAccount, getAttachment } from '@/lib/mailbox';

// GET /api/mail/attachment?folder=&uid=&index=  - downloads one attachment. Always sent as a download, never shown in the page.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const sp = new URL(req.url).searchParams;
    const a = await getAccount(user, sp.get('account_id'));
    if (!a) return jsonError('Connect your email first', 409);
    const uid = parseInt(sp.get('uid') || ''), index = parseInt(sp.get('index') || '0');
    if (!uid || isNaN(index)) return jsonError('Attachment not found', 422);
    const f = await getAttachment(a, sp.get('folder') === 'sent' ? 'sent' : 'inbox', uid, index);
    const name = String(f.filename).replace(/[\r\n"\\/]/g, '_');
    return new Response(f.content, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"`, 'X-Content-Type-Options': 'nosniff' } });
  } catch (e: any) { return jsonError(e?.message || e, 502); }
}
