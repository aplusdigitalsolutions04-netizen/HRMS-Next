import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, verifyPassword, hashPassword } from '@/lib/auth';
import { query } from '@/lib/db';
import { employeeCodes, getStatuses } from '@/lib/status-master';
import { clientIp, lockedMinutes, recordFailure, clearFailures } from '@/lib/login-guard';
import { RowDataPacket } from 'mysql2';

// One message for every failed login, so nobody can find out which emails have an account.
const BAD_LOGIN = 'Invalid email or password';
// compared when the email is unknown, so a missing account takes as long to refuse as a wrong password
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const username = String(params.get('username') || '').trim();
    const password = params.get('password');
    const email = username;
    if (!email || !password) {
      return NextResponse.json({ detail: 'Email and password required' }, { status: 422 });
    }
    if (email.length > 150 || password.length > 200) return NextResponse.json({ detail: BAD_LOGIN }, { status: 401 });

    const ip = clientIp(req);
    const wait = await lockedMinutes(email, ip);
    if (wait > 0) {
      return NextResponse.json({ detail: `Too many wrong attempts. Try again after ${wait} minute${wait > 1 ? 's' : ''}.` }, { status: 429 });
    }

    let authResult = await authenticateUser(email, password, 'admin');
    if (authResult) {
      await clearFailures(email);
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

    // employee login: the password is checked first, and only then is the account status told
    const emps = await query<RowDataPacket[]>('SELECT status, password FROM employees WHERE email_id = ? AND is_deleted = 0', [email]);
    const passwordOk = verifyPassword(password, emps.length > 0 ? emps[0].password : DUMMY_HASH) && emps.length > 0;
    if (!passwordOk) {
      await recordFailure(email, ip);
      return NextResponse.json({ detail: BAD_LOGIN }, { status: 401 });
    }
    // Which statuses may log in comes from Settings > Status Master (Can log in).
    const loginableStatuses = await employeeCodes('can_login');
    if (!loginableStatuses.includes(emps[0].status)) {
      const row = (await getStatuses('employee', true)).find(s => s.code === emps[0].status);
      return NextResponse.json({ detail: `Account is ${row?.label || emps[0].status}. Please contact HR to activate your account.` }, { status: 401 });
    }
    authResult = await authenticateUser(email, password, 'employee');
    if (!authResult) {
      await recordFailure(email, ip);
      return NextResponse.json({ detail: BAD_LOGIN }, { status: 401 });
    }
    await clearFailures(email);

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
    return NextResponse.json({ detail: 'Login failed. Please try again.' }, { status: 500 });
  }
}
