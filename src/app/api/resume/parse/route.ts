// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4 } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUPPORTED_EXTS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

// pdfjs-dist (used both directly and internally by pdf-to-img for rendering
// scanned PDFs to images) loads a "worker" module via a dynamic import at
// runtime. That cannot be made to work inside Turbopack's bundled server
// route chunks - Turbopack either rewrites the import to a chunk path that
// doesn't exist, or refuses to bundle it at all as "too dynamic". Running
// the extraction in a plain, unbundled Node child process sidesteps
// Turbopack entirely, which is where pdf.js's worker loading works fine.
async function extractPdfViaSubprocess(buffer: Buffer): Promise<{ text: string; images: Buffer[] }> {
  const dir = join(tmpdir(), `pdf-extract-${uuidv4()}`);
  await mkdir(dir, { recursive: true });
  const pdfPath = join(dir, 'input.pdf');
  await writeFile(pdfPath, buffer);
  const scriptPath = join(process.cwd(), 'scripts', 'pdf-extract.mjs');

  try {
    await new Promise<void>((resolve) => {
      // The script writes its result to a file (see pdf-extract.mjs) rather
      // than stdout, because pdf.js internals print warnings straight to
      // stdout which would corrupt a JSON-over-stdout payload. So a non-zero
      // exit here doesn't mean "no result" - always fall through to read the
      // result file, which the script writes even on its own caught errors.
      execFile(process.execPath, [scriptPath, pdfPath, dir], { maxBuffer: 1024 * 1024 * 50 }, () => resolve());
    });
    const resultPath = join(dir, 'result.json');
    let result: any;
    try {
      result = JSON.parse(await readFile(resultPath, 'utf8'));
    } catch {
      throw new Error('PDF extraction process did not produce a result');
    }
    if (!result.ok) throw new Error(result.error || 'PDF extraction failed');
    const images = await Promise.all((result.images || []).map((p: string) => readFile(p)));
    return { text: result.text || '', images };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

async function extractTextFromDoc(buffer: Buffer): Promise<string> {
  const WordExtractor = require('word-extractor');
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody() || '';
}

function extractionPrompt() {
  return `Extract the following information from this resume in JSON format (no markdown, no code fences, pure JSON object only):
{
  "candidate_name": "Full name",
  "email_id": "Email address or empty string",
  "date_of_birth": "Date of birth in YYYY-MM-DD format or null if not found",
  "qualification": "Highest education qualification",
  "work_experience": "Summary of work experience including years and roles",
  "skills": "Comma-separated list of skills",
  "location": "City/location",
  "career_objective": "Career objective or professional summary",
  "certificates": "Certifications listed"
}`;
}

function buildResumeRecord(parsed: any, mobile: string, resumePath: string, originalFileName: string) {
  return {
    candidate_name: parsed.candidate_name || '',
    contact_number: mobile,
    email_id: parsed.email_id || '',
    date_of_birth: parsed.date_of_birth || null,
    qualification: parsed.qualification || '',
    work_experience: parsed.work_experience || '',
    skills: parsed.skills || '',
    location: parsed.location || '',
    career_objective: parsed.career_objective || '',
    certificates: parsed.certificates || '',
    resume_pdf_path: resumePath,
    raw_json: JSON.stringify({ originalFileName, openaiResponse: parsed }),
  };
}

function parseModelJson(content: string): any {
  const cleaned = (content || '{}').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

async function parseResumeFromText(text: string, mobile: string, resumePath: string, originalFileName: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You extract structured candidate data from resumes. Return only valid JSON.' },
      { role: 'user', content: `${extractionPrompt()}\n\nResume text:\n"""${text.slice(0, 8000)}"""` },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });
  const parsed = parseModelJson(response.choices?.[0]?.message?.content);
  return buildResumeRecord(parsed, mobile, resumePath, originalFileName);
}

// Used for photo uploads (JPG/PNG) and for scanned/image-only PDFs that have
// no extractable text layer - reads the resume directly off page images.
async function parseResumeFromImages(images: { buffer: Buffer; mime: string }[], mobile: string, resumePath: string, originalFileName: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You extract structured candidate data from resume images. Return only valid JSON.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: extractionPrompt() },
          ...images.map(img => ({
            type: 'image_url',
            image_url: { url: `data:${img.mime};base64,${img.buffer.toString('base64')}` },
          })),
        ] as any,
      },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });
  const parsed = parseModelJson(response.choices?.[0]?.message?.content);
  return buildResumeRecord(parsed, mobile, resumePath, originalFileName);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const fd = await req.formData();
    const file = fd.get('resume') as File | null;
    const mobile = fd.get('mobileNumber') as string | '';

    if (!file || !mobile) return jsonError('Resume file and mobile number required', 422);

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) {
      return jsonError('Unsupported file type. Please upload a PDF, Word document (doc/docx) or a photo (jpg/png) of the resume.', 422);
    }

    // Check for existing candidate by mobile
    const existing = await query<RowDataPacket[]>(
      'SELECT * FROM interview_candidates WHERE contact_number = ?',
      [mobile]
    );
    if (existing.length > 0) {
      return jsonSuccess({ success: false, data: existing[0], message: 'Duplicate record found' });
    }

    // Save resume file
    const fileName = `resume_${mobile}_${Date.now()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents');
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(uploadDir, fileName), buffer);
    const resumePath = `uploads/documents/${fileName}`;

    let parsed: any;
    try {
      if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
        parsed = await parseResumeFromImages([{ buffer, mime: MIME_BY_EXT[ext] }], mobile, resumePath, file.name);
      } else if (ext === 'docx') {
        const text = await extractTextFromDocx(buffer);
        if (!text.trim()) return jsonError('No text could be found in this document.', 422);
        parsed = await parseResumeFromText(text, mobile, resumePath, file.name);
      } else if (ext === 'doc') {
        const text = await extractTextFromDoc(buffer);
        if (!text.trim()) return jsonError('No text could be found in this document.', 422);
        parsed = await parseResumeFromText(text, mobile, resumePath, file.name);
      } else {
        // pdf: extraction runs in a child process (see extractPdfViaSubprocess).
        // It returns text when the PDF has a text layer, otherwise rendered
        // page images (for scanned/image-only PDFs, or photos saved as PDF).
        let result: { text: string; images: Buffer[] };
        try {
          result = await extractPdfViaSubprocess(buffer);
        } catch (e: any) {
          console.error('[resume/parse] PDF extraction failed:', e?.message || e);
          return jsonError('Could not read this PDF - it may be corrupted or password-protected. Please try re-saving/re-exporting the resume and upload it again.', 422);
        }

        if (result.text.trim()) {
          parsed = await parseResumeFromText(result.text, mobile, resumePath, file.name);
        } else if (result.images.length > 0) {
          parsed = await parseResumeFromImages(result.images.map(p => ({ buffer: p, mime: 'image/png' })), mobile, resumePath, file.name);
        } else {
          return jsonError('No text could be found in this PDF. It may be a scanned/image-only resume without a text layer.', 422);
        }
      }
    } catch (e: any) {
      console.error('[resume/parse] Extraction/parsing failed:', e?.message || e);
      return jsonError('Could not read this file. Please try re-saving/re-exporting the resume and upload it again.', 422);
    }

    return jsonSuccess({ success: true, data: parsed });
  } catch (e: any) {
    console.error('[resume/parse] Error:', e?.message || e);
    return jsonError(e, 500);
  }
}
