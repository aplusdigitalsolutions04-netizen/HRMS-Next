import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { verifyEmailConnection } from '@/lib/email';

// Verifies the shared company SMTP account authenticates - doesn't send an
// actual email, so clicking "Test" repeatedly doesn't spam anyone's inbox.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

    const result = await verifyEmailConnection();

    if (result.ok) {
      return jsonSuccess({ message: `SMTP connection succeeded! ${result.message}` });
    } else {
      return jsonError(`SMTP connection failed: ${result.message}`);
    }
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
