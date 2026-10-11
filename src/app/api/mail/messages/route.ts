// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { getAccount, listMessages } from '@/lib/mailbox';

// GET /api/mail/messages?folder=inbox|sent&page=1&per_page=20&search=
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const sp = new URL(req.url).searchParams;
    const a = await getAccount(user, sp.get('account_id'));
    if (!a) return jsonError('Connect your email first', 409);
    const folder = sp.get('folder') === 'sent' ? 'sent' : 'inbox';
    const page = Math.max(1, parseInt(sp.get('page') || '1') || 1);
    const perPage = Math.min(50, Math.max(5, parseInt(sp.get('per_page') || '20') || 20));
    const r = await listMessages(a, folder, { page, perPage, search: (sp.get('search') || '').slice(0, 100) });
    return jsonSuccess({ ...r, page, per_page: perPage, folder: undefined, mailbox: r.folder });
  } catch (e: any) { return jsonError(e?.message || e, 502); }
}
