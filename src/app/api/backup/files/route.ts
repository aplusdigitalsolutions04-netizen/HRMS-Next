// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { listBackups, backupPath, deleteBackup, runBackupToFile, verifyBackup } from '@/lib/backup-auto';
import { auditFrom } from '@/lib/audit';

// Backup files kept on the server - ADMIN only.
//   GET                 -> the list
//   GET ?download=NAME  -> the file
//   POST {action:'run'} | {action:'verify', name, deep?} | {action:'delete', name}
const adminOnly = async (req: NextRequest) => { const u = await getAuthUser(req); return u && u.type === 'admin' && u.role === 'ADMIN' ? u : null; };

async function GET_handler(req: NextRequest) {
  try {
    const user = await adminOnly(req);
    if (!user) return jsonError('Only the administrator can see backups', 403);
    const dl = new URL(req.url).searchParams.get('download');
    if (dl) {
      const p = backupPath(dl);
      if (!p) return jsonError('Backup file not found', 404);
      await auditFrom(user, 'backup_downloaded', 'backup', dl, null);
      return new Response(Readable.toWeb(createReadStream(p)) as any, { headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${dl}"`, 'Cache-Control': 'no-store' } });
    }
    return jsonSuccess({ files: listBackups() });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await adminOnly(req);
    if (!user) return jsonError('Only the administrator can manage backups', 403);
    const b = await req.json().catch(() => ({}));
    if (b.action === 'run') {
      const r = await runBackupToFile('manual', user.email);
      await auditFrom(user, 'backup_saved_on_server', 'backup', r.name, null);
      return jsonSuccess({ message: 'Backup saved on the server', ...r });
    }
    if (b.action === 'verify') {
      if (!backupPath(String(b.name || ''))) return jsonError('Backup file not found', 404);
      const r = await verifyBackup(String(b.name), b.deep !== false);
      await auditFrom(user, 'backup_tested', 'backup', r.name, { ok: r.ok, rows: r.rows, deep: r.deep.note });
      return jsonSuccess(r);
    }
    if (b.action === 'delete') {
      if (!deleteBackup(String(b.name || ''))) return jsonError('Backup file not found', 404);
      await auditFrom(user, 'backup_deleted', 'backup', String(b.name), null);
      return jsonSuccess({ message: 'Backup deleted' });
    }
    return jsonError('Unknown action', 400);
  } catch (e: any) { console.error('[backup-files]', e?.message || e); return jsonError(e, 500); }
}
export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
