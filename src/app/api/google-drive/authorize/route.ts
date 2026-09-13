import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/googleDrive';
import { authUserFromToken } from '@/lib/auth';

// This route only makes sense as a full browser navigation (it redirects to
// Google's consent screen), so it can't carry the app's normal Authorization
// header the way fetch calls do - GoogleDriveSettings.jsx instead appends
// the session token as ?token=, checked directly here (rather than the usual
// getAuthUser(req), which only reads the header) so this stays admin-only
// like every other settings route.
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    const user = token ? await authUserFromToken(token) : null;
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ detail: 'Only ADMIN can connect Google Drive.' }, { status: 403 });

    return NextResponse.redirect(await getAuthUrl());
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Failed to start Google authorization' }, { status: 500 });
  }
}
