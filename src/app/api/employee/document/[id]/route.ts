// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { authUserFromToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { readFile } from 'fs/promises';
import path from 'path';
import { downloadFileFromDrive, getDriveFileMeta } from '@/lib/googleDrive';

const ALLOWED_FIELDS = [
  'identity_proof', 'address_proof', 'resume_path', 'ug_document', 'marksheet10', 'marksheet12',
  'marksheet_10', 'marksheet_12', 'offer_letter', 'pg_document', 'appointment_letter',
  'internship_certificate', 'photograph', 'bank_document',
];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Opened as a plain <a href> navigation (to view/download the file
    // inline), which can't carry the app's usual Authorization header - the
    // token is appended as ?token= instead, same trick as the Google Drive
    // authorize route.
    const queryToken = req.nextUrl.searchParams.get('token');
    const user = queryToken ? await authUserFromToken(queryToken) : await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_employee_details')) return jsonError('Insufficient permissions', 403);

    const { id } = await params;
    const field = req.nextUrl.searchParams.get('field') || '';
    if (!ALLOWED_FIELDS.includes(field)) return jsonError('Invalid document field', 400);

    const rows = await query<RowDataPacket[]>(`SELECT \`${field}\` as val FROM employees WHERE id = ?`, [id]);
    if (rows.length === 0 || !rows[0].val) return jsonError('Document not found', 404);
    const storedPath = rows[0].val as string;

    let buf: Buffer;
    let mime: string;
    if (storedPath.startsWith('drive:')) {
      const fileId = storedPath.slice('drive:'.length);
      const [fileBuf, meta] = await Promise.all([downloadFileFromDrive(fileId), getDriveFileMeta(fileId)]);
      buf = fileBuf;
      mime = meta.mimeType || 'application/octet-stream';
    } else {
      buf = await readFile(path.join(process.cwd(), 'public', storedPath));
      const ext = path.extname(storedPath).toLowerCase();
      mime = ext === '.pdf' ? 'application/pdf'
        : ext === '.png' ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : ext === '.doc' || ext === '.docx' ? 'application/msword'
        : 'application/octet-stream';
    }

    return new NextResponse(buf, { headers: { 'Content-Type': mime } });
  } catch (e: any) {
    if (e.code === 'ENOENT') return jsonError('File not found on server', 404);
    return jsonError(e, 500);
  }
}
