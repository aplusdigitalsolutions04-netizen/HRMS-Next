import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, saveRefreshToken } from '@/lib/googleDrive';
import { verifyPurposeToken } from '@/lib/auth';

// Visiting /api/google-drive/authorize sends the admin through Google's
// consent screen, which redirects back here with a code. We exchange it for
// a refresh token and store it in the DB (google_drive_auth) - takes effect
// immediately, on any request, no process restart needed. Storing it in
// .env.local instead would only work for local dev: on a real deployment
// (e.g. Hostinger) that file isn't reliably writable/restartable by the app,
// so authorizing on the live site would silently never take effect.
//
// `state` is required and must be a valid, unexpired token minted by
// /api/google-drive/authorize for an ADMIN - without this check, anyone
// could complete their own OAuth flow against this app's public client ID
// and hit this URL directly with their own `code`, silently redirecting the
// whole company's Drive storage to an attacker-controlled account.
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    if (!code) return NextResponse.json({ detail: 'Missing authorization code' }, { status: 400 });
    if (!state || !verifyPurposeToken(state, 'google_drive_connect')) {
      return NextResponse.json({ detail: 'Missing or expired authorization state. Start over from Settings > Google Drive.' }, { status: 401 });
    }

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return NextResponse.json({
        detail: "Google did not return a refresh token. Revoke this app's access at https://myaccount.google.com/permissions and try again so Google issues a fresh one.",
      }, { status: 500 });
    }

    await saveRefreshToken(tokens.refresh_token);

    return new NextResponse(
      "<html><body style='font-family:sans-serif;padding:2rem'><h2>Google Drive connected</h2><p>You're all set - uploads and downloads will use this account right away.</p></body></html>",
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Failed to complete Google authorization' }, { status: 500 });
  }
}
