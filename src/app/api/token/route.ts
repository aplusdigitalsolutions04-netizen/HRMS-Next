import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const username = params.get('username');
    const password = params.get('password');
    const email = username;
    if (!email || !password) {
      return NextResponse.json({ detail: 'Email and password required' }, { status: 422 });
    }

    let authResult = await authenticateUser(email, password, 'admin');
    if (authResult) {
      const resp = {
        access_token: authResult.token,
        token_type: 'bearer',
        role: authResult.user.role,
        permissions: authResult.user.permissions || {},
        must_change_password: authResult.user.must_change_password || false,
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          name: authResult.user.name,
          role: authResult.user.role,
        },
      };
      return NextResponse.json(resp);
    }

    // Detailed check for employee login
    const emps = await query<RowDataPacket[]>('SELECT status FROM employees WHERE email_id = ?', [email]);
    if (emps.length === 0) {
      return NextResponse.json({ detail: 'No account found with this email' }, { status: 401 });
    }
    const loginableStatuses = ['active', 'invited', 'pending', 'needs_correction'];
    if (!loginableStatuses.includes(emps[0].status)) {
      return NextResponse.json({ detail: `Account is ${emps[0].status}. Please contact HR to activate your account.` }, { status: 401 });
    }
    authResult = await authenticateUser(email, password, 'employee');
    if (!authResult) {
      return NextResponse.json({ detail: 'Invalid password. If you forgot your password, contact HR to reset it.' }, { status: 401 });
    }

    const resp = {
      access_token: authResult.token,
      token_type: 'bearer',
      role: authResult.user.role,
      permissions: authResult.user.permissions || {},
      must_change_password: authResult.user.must_change_password || false,
      employee_status: authResult.user.status,
      hr_remarks: authResult.user.hr_remarks || '',
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.name,
        role: authResult.user.role,
      },
    };

    return NextResponse.json(resp);
  } catch (e: any) {
    const msg = e?.message || e?.code || (e?.errors?.map((x: any) => x.message).join('; ')) || 'Login failed';
    console.error('[api/token] LOGIN ERROR: ' + msg + ' | stack: ' + (e?.stack || 'no stack'));
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
