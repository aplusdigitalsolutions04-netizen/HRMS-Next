import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeToken } from '@/lib/auth';
import { logApi, shortRef, clientIp } from '@/lib/api-log';

// A call refused here never reaches a route, so it is written to the API log from here.
function refuse(request: NextRequest, body: any, status: number, message: string) {
  const ref = shortRef();
  logApi({
    source: 'proxy', ref, method: request.method, path: request.nextUrl.pathname, query_string: request.nextUrl.search.slice(1), status,
    ip: clientIp(request), user_agent: request.headers.get('user-agent') || '', error_message: message,
  });
  return NextResponse.json(body, { status });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API route protection
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/token' ||
        pathname === '/api/logout' ||
        pathname === '/api/company-logo' ||
        pathname === '/api/company-public' ||
        pathname === '/api/app-config' ||
        pathname.startsWith('/api/resume/parse') ||
        pathname === '/api/employee/register') {
      return NextResponse.next();
    }

    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return refuse(request, { detail: 'Not authenticated' }, 401, 'No login token was sent');
    }
    const payload = decodeToken(auth.slice(7));
    if (!payload) {
      return refuse(request, { detail: 'Invalid or expired token' }, 401, 'The login token is invalid or has expired');
    }

    if (payload.must_change_password) {
      if (!pathname.startsWith('/api/change-password') &&
          !pathname.startsWith('/api/employee/change-password') &&
          !pathname.startsWith('/api/logout') &&
          pathname !== '/api/profile') {
        return refuse(request, { detail: 'Password change required', must_change_password: true }, 403, 'The password has to be changed before anything else');
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
