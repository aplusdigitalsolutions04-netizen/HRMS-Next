// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { readFile } from 'fs/promises';
import path from 'path';
import { downloadFileFromDrive } from '@/lib/googleDrive';

const ALLOWED_FIELDS = [
  'identity_proof', 'address_proof', 'resume_path', 'ug_document', 'marksheet10', 'marksheet12',
  'marksheet_10', 'marksheet_12', 'offer_letter', 'pg_document', 'appointment_letter',
  'internship_certificate', 'photograph', 'bank_document',
];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_employee_details')) return jsonError('Insufficient permissions', 403);

    const { id } = await params;
    const field = req.nextUrl.searchParams.get('field') || '';
    if (!ALLOWED_FIELDS.includes(field)) return jsonError('Invalid document field', 400);

    const rows = await query<RowDataPacket[]>(`SELECT \`${field}\` as val FROM employees WHERE id = ?`, [id]);
    if (rows.length === 0 || !rows[0].val) return jsonError('Document not found', 404);
    const storedPath = rows[0].val as string;

    const buf = storedPath.startsWith('drive:')
      ? await downloadFileFromDrive(storedPath.slice('drive:'.length))
      : await readFile(path.join(process.cwd(), 'public', storedPath));

    const ext = path.extname(storedPath).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf'
      : ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.doc' || ext === '.docx' ? 'application/msword'
      : 'application/octet-stream';

    return new NextResponse(buf, { headers: { 'Content-Type': mime } });
  } catch (e: any) {
    if (e.code === 'ENOENT') return jsonError('File not found on server', 404);
    return jsonError(e, 500);
  }
}
