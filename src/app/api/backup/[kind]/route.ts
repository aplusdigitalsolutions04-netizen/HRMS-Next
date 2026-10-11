// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { sqlDumpStream, excelExport, rowCounts, lastBackup, markBackup } from '@/lib/backup';
import { auditFrom } from '@/lib/audit';

// Backup and export - ADMIN only (the files contain everything, including password hashes in the .sql).
//   GET /api/backup/status  -> last backup time + row counts
//   GET /api/backup/sql     -> full restorable .sql dump (streamed)
//   GET /api/backup/excel   -> day-to-day data as one Excel file (no passwords / photos)
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || user.role !== 'ADMIN') return jsonError('Only the administrator can take a backup', 403);
    const { kind } = await params;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

    if (kind === 'status') return jsonSuccess({ last: await lastBackup(), tables: await rowCounts() });

    if (kind === 'sql') {
      await markBackup('Full backup (.sql)', user.email);
      await auditFrom(user, 'backup_downloaded', 'backup', 'sql', null);
      return new Response(sqlDumpStream(), { headers: {
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="hrms-backup-${stamp}.sql"`,
        'Cache-Control': 'no-store',
      } });
    }
    if (kind === 'excel') {
      const buf = await excelExport();
      await markBackup('Excel export', user.email);
      await auditFrom(user, 'data_exported', 'backup', 'excel', null);
      return new Response(new Uint8Array(buf), { headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="hrms-data-${stamp}.xlsx"`,
        'Cache-Control': 'no-store',
      } });
    }
    return jsonError('Unknown backup type', 404);
  } catch (e: any) {
    console.error('[backup] failed:', e?.message || e);
    return jsonError(e, 500);
  }
}
