// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { readFile } from 'fs/promises';
import path from 'path';
import { downloadFileFromDrive } from '@/lib/googleDrive';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const { id } = await params;
    const rows = await query<RowDataPacket[]>(
      `SELECT da.* FROM document_approvals da WHERE da.id=?`,
      [id]
    );
    if (rows.length === 0) return jsonError('Document not found', 404);

    const doc = rows[0];

    if (user.type !== 'admin') {
      const emps = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id=?', [user.email || user.id]);
      if (emps.length === 0 || doc.employee_id !== emps[0].id) return jsonError('Unauthorized', 403);
    }

    const buf = doc.temp_file_path.startsWith('drive:')
      ? await downloadFileFromDrive(doc.temp_file_path.slice('drive:'.length))
      : await readFile(path.join(process.cwd(), 'public', doc.temp_file_path));
    const ext = path.extname(doc.original_filename || doc.temp_file_path).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf'
      : ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.doc' || ext === '.docx' ? 'application/msword'
      : 'application/octet-stream';

    return new NextResponse(buf, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename="${doc.original_filename || 'document'}"`,
      },
    });
  } catch (e: any) {
    if (e.code === 'ENOENT') return jsonError('File not found on server', 404);
    return jsonError(e, 500);
  }
}
