import { withApiLog } from '@/lib/api-log';
import { NextRequest, NextResponse } from 'next/server';
import { decodeToken } from '@/lib/auth';
import { endSession } from '@/lib/login-history';

// Signing out also ends this session on the server, so the token cannot be used again.
async function POST_handler(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const p: any = decodeToken(auth.slice(7));
    if (p?.sid) await endSession(p.sid);
  }
  return NextResponse.json({ message: 'Logged out successfully' });
}

export const POST = withApiLog(POST_handler);
