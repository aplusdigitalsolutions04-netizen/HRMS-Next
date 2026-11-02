// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { savePayslipToDrive } from '@/lib/payslip-drive';
import { isDriveConfigured } from '@/lib/googleDrive';
import { auditFrom } from '@/lib/audit';

// Puts a copy of every approved payslip of a month on Google Drive (folder "<Month> <Year>"). Used for months approved before
// Drive saving existed; saving again replaces the same files, so it is safe to run twice.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!(checkPermission(user, 'approve_payslips') || checkPermission(user, 'generate_payslips'))) return jsonError('Insufficient permissions', 403);
    const body = await req.json().catch(() => ({}));
    const month = Number(body.month) || 0, year = Number(body.year) || 0;
    if (!month || !year) return jsonError('Pick a month and a year', 422);
    if (!(await isDriveConfigured())) return jsonError('Google Drive is not connected (Settings > Google Drive)', 422);

    const rows = await query<RowDataPacket[]>("SELECT id FROM payslips WHERE status = 'APPROVED' AND month = ? AND year = ?", [month, year]);
    if (rows.length === 0) return jsonSuccess({ saved: 0, failed: 0, message: 'No approved payslips for that month.' });
    let saved = 0, failed = 0, firstError = '';
    for (const r of rows) {
      const x = await savePayslipToDrive(r.id);
      if (x.ok) saved++; else { failed++; firstError = firstError || x.message; }
    }
    await auditFrom(user, 'payslips_saved_to_drive', 'payslip', `${month}/${year}`, { saved, failed });
    return jsonSuccess({ saved, failed, message: `Saved ${saved} payslip(s) to Google Drive.` + (failed ? ` ${failed} failed: ${firstError}` : '') });
  } catch (e: any) { return jsonError(e, 500); }
}
