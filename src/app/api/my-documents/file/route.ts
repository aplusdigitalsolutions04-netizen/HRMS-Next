// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { readFile } from 'fs/promises';
import path from 'path';
import { downloadFileFromDrive, getDriveFileMeta, driveErrorMessage } from '@/lib/googleDrive';
import { DOC_OPTIONS } from '@/lib/documents';

// The employee opens a paper they uploaded during onboarding (kept on their profile). Only their own, only the listed ones.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const type = req.nextUrl.searchParams.get('type') || '';
    const opt = DOC_OPTIONS.find(d => d.key === type);
    if (!opt) return jsonError('Invalid document', 400);
    const rows = await query<RowDataPacket[]>(`SELECT \`${opt.column}\` AS val FROM employees WHERE email_id = ?`, [user.email || user.id]);
    const stored = rows[0]?.val as string;
    if (!stored) return jsonError('Document not found', 404);

    let buf: Buffer, mime: string;
    if (stored.startsWith('drive:')) {
      const id = stored.slice(6);
      const [b, meta] = await Promise.all([downloadFileFromDrive(id), getDriveFileMeta(id)]);
      buf = b; mime = meta.mimeType || 'application/octet-stream';
    } else {
      buf = await readFile(path.join(process.cwd(), 'public', stored));
      const ext = path.extname(stored).toLowerCase();
      mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
    }
    return new NextResponse(buf, { headers: { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff' } });
  } catch (e: any) {
    if (e.code === 'ENOENT') return jsonError('File not found on server', 404);
    const friendly = driveErrorMessage(e);
    return friendly ? jsonError(friendly, 503) : jsonError(e, 500);
  }
}
