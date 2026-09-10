import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeToken } from '@/lib/auth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API route protection
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/token' ||
        pathname === '/api/logout' ||
        pathname.startsWith('/api/resume/parse') ||
        pathname === '/api/employee/register') {
      return NextResponse.next();
    }

    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    const payload = decodeToken(auth.slice(7));
    if (!payload) {
      return NextResponse.json({ detail: 'Invalid or expired token' }, { status: 401 });
    }

    if (payload.type === 'employee' && payload.must_change_password) {
      if (!pathname.startsWith('/api/change-password') &&
          !pathname.startsWith('/api/employee/change-password') &&
          !pathname.startsWith('/api/logout') &&
          pathname !== '/api/profile') {
        return NextResponse.json({ detail: 'Password change required', must_change_password: true }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
