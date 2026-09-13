import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/googleDrive';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { signPurposeToken } from '@/lib/auth';

// Google's consent screen requires a real top-level browser navigation, so
// the frontend can't just `fetch()` this with the usual Authorization
// header the way every other admin-only route works. Rather than accepting
// the session token as a URL query param (which would leak it into server
// logs/history/Referer headers), this is a normal header-authenticated POST
// that hands back the one-time Google URL to navigate to - the session
// token itself never appears in any URL.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.role !== 'ADMIN') return jsonError('Only ADMIN can connect Google Drive.', 403);

    // Google echoes `state` back verbatim on the callback - a short-lived,
    // purpose-scoped token here proves the callback continues *this* admin's
    // request, so an attacker can't complete their own OAuth flow (with the
    // same public client ID) by just hitting the callback URL with their own
    // `code` and no state at all.
    const state = signPurposeToken('google_drive_connect', user.id);
    return jsonSuccess({ url: await getAuthUrl(state) });
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to start Google authorization', 500);
  }
}
