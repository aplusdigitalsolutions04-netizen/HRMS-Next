// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { getAccount, readMessage } from '@/lib/mailbox';

// GET /api/mail/message?folder=inbox|sent&uid=123  - one mail, opened (and marked read)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const sp = new URL(req.url).searchParams;
    const a = await getAccount(user, sp.get('account_id'));
    if (!a) return jsonError('Connect your email first', 409);
    const uid = parseInt(sp.get('uid') || '');
    if (!uid) return jsonError('Mail not found', 422);
    return jsonSuccess(await readMessage(a, sp.get('folder') === 'sent' ? 'sent' : 'inbox', uid));
  } catch (e: any) { return jsonError(e?.message || e, 502); }
}
