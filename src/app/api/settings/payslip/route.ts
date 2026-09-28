// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { getPayslipSignatories, getEwMultiplier, getElPayoutInterval, SIGNATORY_KEYS } from '@/lib/payroll-calc';
import { getMonthDaysMode } from '@/lib/salary-sheet';

// system_settings.setting_value is TEXT (64KB); the page shrinks signatures
// well below this before uploading.
const MAX_SIGNATURE_LEN = 60000;
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    return jsonSuccess({ ...(await getPayslipSignatories()), ew_pay_multiplier: String(await getEwMultiplier()), el_payout_interval_months: String(await getElPayoutInterval()), salary_month_days_mode: await getMonthDaysMode() });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!checkPermission(user, 'manage_salary_structures')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const values: Record<string, string> = {};
    for (const field of ['prepared_by', 'authorised_by']) {
      values[SIGNATORY_KEYS[field]] = String(body[field] ?? '').trim().slice(0, 100);
    }
    for (const field of ['prepared_signature', 'authorised_signature']) {
      const v = String(body[field] ?? '');
      if (v && (v.length > MAX_SIGNATURE_LEN || !IMAGE_DATA_URL.test(v))) {
        return jsonError('Signature must be a PNG, JPG or WEBP image under 60KB', 422);
      }
      values[SIGNATORY_KEYS[field]] = v; // empty string removes the signature
    }

    // Extra Work pay = one day's pay x this multiplier (1 = normal day rate, 2 = double).
    const mult = parseFloat(body.ew_pay_multiplier);
    if (body.ew_pay_multiplier !== undefined && (isNaN(mult) || mult < 0 || mult > 10)) return jsonError('Extra work multiplier must be between 0 and 10', 422);
    if (!isNaN(mult)) values.ew_pay_multiplier = String(mult);

    // Month Days used for PerDaySalary and Paid Days: the month's real length, or a fixed 30.
    if (body.salary_month_days_mode !== undefined) {
      values.salary_month_days_mode = body.salary_month_days_mode === '30' ? '30' : 'actual';
    }

    // EL Encashment is paid together every N months (1 = every month).
    if (body.el_payout_interval_months !== undefined) {
      const n = parseInt(body.el_payout_interval_months);
      if (isNaN(n) || n < 1 || n > 12) return jsonError('EL payout interval must be between 1 and 12 months', 422);
      values.el_payout_interval_months = String(n);
    }

    const t = now();
    for (const [key, value] of Object.entries(values)) {
      const existing = await query('SELECT id FROM system_settings WHERE setting_key=?', [key]);
      if (existing.length > 0) {
        await execute('UPDATE system_settings SET setting_value=?, updated_on=? WHERE setting_key=?', [value, t, key]);
      } else {
        await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,?)', [key, value, t]);
      }
    }
    return jsonSuccess({ message: 'Payslip settings saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
