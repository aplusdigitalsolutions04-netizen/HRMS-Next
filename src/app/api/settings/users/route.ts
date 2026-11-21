// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { validatePassword } from '@/lib/password-policy';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, requireRole } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword } from '@/lib/auth';
import { auditFrom } from '@/lib/audit';
import { BUILT_IN_ROLES, roleName, EMAIL_RE } from '@/lib/admin-users';

// The people who sign in to run the system (administrator only).
// GET: every account with its role name and last sign-in. POST: makes one.
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const rows = await query<RowDataPacket[]>(
      `SELECT h.id, h.email, h.full_name, h.full_name AS name, h.role, h.is_active, h.last_login, h.must_change_password,
              r.name AS role_name, (h.permissions IS NOT NULL AND h.permissions <> '' AND h.permissions <> '{}') AS has_own_permissions
       FROM hr_admins h LEFT JOIN system_roles r ON r.id = h.role ORDER BY h.is_active DESC, h.full_name, h.email`);
    return jsonSuccess(rows.map(r => ({ ...r, role_name: r.role_name || BUILT_IN_ROLES.find(b => b.id === r.role)?.name || r.role, has_own_permissions: !!Number(r.has_own_permissions) })));
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const ct = req.headers.get('content-type') || '';
    let body;
    if (ct.includes('application/json')) {
      body = await req.json();
    } else {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
    }
    const email = String(body.email || '').trim();
    if (!email) return jsonError('Email required', 422);
    if (!EMAIL_RE.test(email)) return jsonError('Enter a valid email address', 422);

    // the least powerful role unless one is chosen; a role must exist (built in, or made on the Roles page)
    const role = String(body.role || 'HR_STAFF');
    const rname = await roleName(role);
    if (!rname) return jsonError('That role does not exist', 422);

    const existing = await query<RowDataPacket[]>('SELECT id FROM hr_admins WHERE LOWER(email) = LOWER(?)', [email]);
    if (existing.length > 0) return jsonError('A user with this email already exists', 409);

    const pwErr = await validatePassword(body.password, email);
    if (pwErr) return jsonError(pwErr, 422);

    // HR and HR Staff start with the basic view permissions (more are given under Permissions); a custom role brings its own
    const defaultPerms = ['HR', 'HR_STAFF'].includes(role) ? JSON.stringify({
      view_dashboard: true, view_employees: true, view_employee_details: true, view_leave: true, view_attendance: true,
    }) : null;
    const active = body.is_active === undefined ? 1 : (body.is_active === true || body.is_active === 'true' || body.is_active === 1 ? 1 : 0);
    const mustChange = body.must_change_password === undefined ? 1 : (body.must_change_password === true || body.must_change_password === 'true' || body.must_change_password === 1 ? 1 : 0);
    const id = uuidv4();
    await execute(
      `INSERT INTO hr_admins (id, email, full_name, password, role, is_active, permissions, must_change_password, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, email, String(body.full_name || body.name || '').trim(), hashPassword(body.password), role, active, defaultPerms, mustChange, now()]
    );
    await auditFrom(user, 'admin_user_created', 'admin_user', id, { email, role: rname, active: !!active });
    return jsonSuccess({ id, message: 'User created' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
