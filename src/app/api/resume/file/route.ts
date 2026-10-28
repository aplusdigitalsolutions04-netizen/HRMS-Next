// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { downloadFileFromDrive, getDriveFileMeta, driveErrorMessage } from '@/lib/googleDrive';

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};

// A candidate's resume, read from disk at request time. A file put in /public after the build is not served by a
// production Next.js server (the live site answered with the app's HTML page, which then "downloaded" as a broken PDF),
// so resumes go through here instead. ?path=uploads/documents/<file>&download=1
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_candidates')) return jsonError('Insufficient permissions', 403);
    const sp = new URL(req.url).searchParams;
    const rel = String(sp.get('path') || '').split('\\').join('/');
    let buf: Buffer, name: string;
    if (/^drive:[A-Za-z0-9_-]+$/.test(rel)) {
      // a resume kept on Google Drive
      const id = rel.slice(6);
      try { const [b, meta] = await Promise.all([downloadFileFromDrive(id), getDriveFileMeta(id)]); buf = b; name = meta.name || 'resume'; }
      catch (e: any) { const friendly = driveErrorMessage(e); return jsonError(friendly || 'The resume could not be fetched from Google Drive', friendly ? 503 : 404); }
    } else {
      // older resumes saved on the server
      if (!/^uploads\/documents\/[^/]+$/.test(rel)) return jsonError('Resume not available', 404);
      name = basename(rel);
      try { buf = await readFile(join(process.cwd(), 'public', 'uploads', 'documents', name)); }
      catch { return jsonError('The resume file was not found on the server. Upload it again for this candidate.', 404); }
    }
    const ext = name.split('.').pop()!.toLowerCase();
    if (!TYPES[ext]) return jsonError('This file type cannot be opened', 415);
    // ?format=html: a Word resume as a web page, so it can be previewed in the browser
    if (sp.get('format') === 'html') {
      if (ext !== 'docx' && ext !== 'doc') return jsonError('Only Word files need this', 400);
      let body = '';
      try {
        if (ext === 'docx') body = (await require('mammoth').convertToHtml({ buffer: buf })).value;
        else { const t = (await new (require('word-extractor'))().extract(buf)).getBody() || ''; body = `<div style="white-space:pre-wrap">${String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`; }
      } catch { return jsonError('This Word file could not be read for preview. Use Download.', 422); }
      const page = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#1f2937;max-width:820px;margin:18px auto;padding:0 18px">${body || '<p>This file has no text to show.</p>'}</body>`;
      return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } });
    }
    return new Response(buf, {
      headers: {
        'Content-Type': TYPES[ext],
        'Content-Disposition': `${sp.get('download') ? 'attachment' : 'inline'}; filename="${name.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: any) { return jsonError(e, 500); }
}
