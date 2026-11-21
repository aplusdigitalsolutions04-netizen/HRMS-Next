// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getConfig } from '@/lib/app-config';
import { getAuthUser, jsonError, jsonSuccess, uuidv4 } from '@/lib/utils';
import { query } from '@/lib/db';
import { saveToDriveFolder, driveErrorMessage } from '@/lib/googleDrive';
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
    model: (await getConfig()).resume_model,
    messages: [
      { role: 'system', content: 'You extract structured candidate data from resumes. Return only valid JSON.' },
      { role: 'user', content: `${extractionPrompt()}\n\nResume text:\n"""${text.slice(0, (await getConfig()).resume_text_chars)}"""` },
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
    model: (await getConfig()).resume_model,
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

// A PDF that is only a picture (a scan, or a photo saved as PDF) normally is turned into page pictures here and read from them. That step needs
// native parts that some servers do not have. When it does not work, the PDF file itself is handed to the reading service, which can read a
// picture-only PDF directly, so such a resume is read all the same.
async function parseResumeFromPdfFile(buffer: Buffer, mobile: string, resumePath: string, originalFileName: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: (await getConfig()).resume_model,
    messages: [
      { role: 'system', content: 'You extract structured candidate data from resumes. Return only valid JSON.' },
      { role: 'user', content: [
        { type: 'text', text: extractionPrompt() },
        { type: 'file', file: { filename: 'resume.pdf', file_data: `data:application/pdf;base64,${buffer.toString('base64')}` } },
      ] as any },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });
  return buildResumeRecord(parseModelJson(response.choices?.[0]?.message?.content), mobile, resumePath, originalFileName);
}

// What is said to HR when a resume could not be read. The resume itself is always saved; each message tells what the real problem is.
const ISSUES: Record<string, { title: string; text: string }> = {
  image: { title: 'The picture could not be read', text: 'This resume is a picture and the writing in it could not be read. It may be blurry, too small, too dark or cut off. Upload a clearer picture or a PDF with real text.' },
  image_empty: { title: 'No resume details found', text: 'The file was opened but no resume details could be found in it. If it is a picture or a scan, it may be blurry, too dark or cut off. Please check that it is the right resume.' },
  no_text: { title: 'No text in the file', text: 'This document has no text in it (it may hold only pictures), so nothing could be read. Upload the resume as a PDF with text, or as a clear photo.' },
  password: { title: 'The PDF is password-protected', text: 'This PDF is protected with a password, so it cannot be read. Remove the password and upload it again.' },
  damaged: { title: 'The file looks damaged', text: 'This file looks damaged, or it is not a real PDF or Word document, so it cannot be read. Open it on your computer to check it, save it again and upload it again.' },
  service: { title: 'Automatic reading is not available', text: 'The automatic reading of resumes is not available right now (it may be busy, not set up, or without connection). Try again a little later.' },
  empty: { title: 'No details found', text: 'The file was read but no candidate details were found in it. Please check that it is the right resume.' },
};
// an error from the reading service itself (no key, no balance, too many requests, no connection) - not a problem of the file
const isServiceError = (e: any) => [401, 403, 408, 429, 500, 502, 503, 504].includes(Number(e?.status)) || /ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|fetch failed|timed? ?out|api key|quota|rate limit|overloaded/i.test(String(e?.message || e?.code || ''));
const hasDetails = (p: any) => ['candidate_name', 'email_id', 'qualification', 'work_experience', 'skills', 'location', 'career_objective', 'certificates'].some(k => String(p?.[k] || '').trim());

async function POST_handler(req: NextRequest) {
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
    const sizeLimit = (await getConfig()).upload_max_mb;
    if (file.size > sizeLimit * 1024 * 1024) return jsonError(`The resume must be smaller than ${sizeLimit} MB. Make the picture smaller or save the PDF again with a smaller size.`, 422);

    // Check for existing candidate by mobile
    const existing = await query<RowDataPacket[]>(
      'SELECT * FROM interview_candidates WHERE contact_number = ?',
      [mobile]
    );
    if (existing.length > 0) {
      return jsonSuccess({ success: false, data: existing[0], message: 'Duplicate record found' });
    }

    // The file is read here and saved on Google Drive once it has been read successfully (nothing is kept on the server's disk).
    const fileName = `resume_${mobile}_${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const resumePath = '';

    // Reading the resume (to fill the candidate's details) is a convenience. It can fail for many reasons - a photo-only or scanned
    // resume, a broken or password-protected file, no answer from the reading service - and none of them may stop the resume from being
    // saved. So the file is stored first, whatever happens, and when it cannot be read the details are left empty (or filled as far as
    // they can be found) for HR to type in.
    let parsed: any = null;
    let issue: string | null = null;
    let plainText = '';
    let isPicture = false;
    try {
      if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
        isPicture = true;
        try { parsed = await parseResumeFromImages([{ buffer, mime: MIME_BY_EXT[ext] }], mobile, resumePath, file.name); }
        catch (e: any) { console.error('[resume/parse] photo:', e?.message || e); issue = isServiceError(e) ? 'service' : 'image'; }
      } else if (ext === 'docx' || ext === 'doc') {
        try { plainText = ext === 'docx' ? await extractTextFromDocx(buffer) : await extractTextFromDoc(buffer); }
        catch (e: any) { console.error('[resume/parse] word file:', e?.message || e); issue = 'damaged'; }
        if (!issue) {
          if (!plainText.trim()) issue = 'no_text';
          else try { parsed = await parseResumeFromText(plainText, mobile, resumePath, file.name); }
          catch (e: any) { console.error('[resume/parse] text:', e?.message || e); issue = isServiceError(e) ? 'service' : 'empty'; }
        }
      } else {
        // pdf: extraction runs in a child process (see extractPdfViaSubprocess). It returns text when the PDF has a text layer,
        // otherwise rendered page images (scanned / image-only PDFs, or photos saved as PDF).
        let result: { text: string; images: Buffer[] } | null = null;
        let extractError = '';
        try { result = await extractPdfViaSubprocess(buffer); } catch (e: any) { extractError = String(e?.message || e); console.error('[resume/parse] PDF extraction failed:', extractError); }
        if (/password|encrypt/i.test(extractError)) issue = 'password';
        else if (/invalid pdf|xref|corrupt|not a pdf|format error|missing pdf header|no pdf header/i.test(extractError)) issue = 'damaged';
        if (!issue) {
          plainText = result?.text || '';
          if (plainText.trim()) {
            try { parsed = await parseResumeFromText(plainText, mobile, resumePath, file.name); }
            catch (e: any) { console.error('[resume/parse] text:', e?.message || e); issue = isServiceError(e) ? 'service' : 'empty'; }
          } else {
            // a picture-only PDF: from the page pictures, or when that step does not work, from the file itself
            isPicture = true;
            if (result && result.images.length > 0) {
              try { parsed = await parseResumeFromImages(result.images.map(p => ({ buffer: p, mime: 'image/png' })), mobile, resumePath, file.name); }
              catch (e: any) { console.error('[resume/parse] page pictures:', e?.message || e); }
            }
            if (!parsed) {
              try { parsed = await parseResumeFromPdfFile(buffer, mobile, resumePath, file.name); }
              catch (e: any) { console.error('[resume/parse] the file itself:', e?.message || e); issue = isServiceError(e) ? 'service' : 'image'; }
            }
          }
        }
      }
    } catch (e: any) {
      console.error('[resume/parse] reading the resume failed:', e?.message || e);
      issue = issue || 'image';
    }

    // it was opened but nothing useful came out of it
    if (parsed && !hasDetails(parsed)) { issue = isPicture ? 'image_empty' : 'empty'; parsed = null; }

    if (!parsed) {
      // whatever can be found without the reading service: the email address, and a name when the first line looks like one
      const email = (plainText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [''])[0];
      const first = (plainText.split(/\r?\n/).map(x => x.trim()).find(x => x) || '');
      const name = /^[A-Za-z][A-Za-z .'-]{2,40}$/.test(first) && first.split(/\s+/).length <= 4 ? first : '';
      parsed = buildResumeRecord({ candidate_name: name, email_id: email }, mobile, resumePath, file.name);
      issue = issue || 'empty';
    }

    try {
      parsed.resume_pdf_path = await saveToDriveFolder((await getConfig()).drive_folder_resumes, fileName, buffer, file.type || MIME_BY_EXT[ext] || 'application/octet-stream');
    } catch (e: any) {
      const friendly = driveErrorMessage(e);
      console.error('[resume/parse] Drive save failed:', e?.message || e);
      return jsonError(friendly || e?.message || 'The resume could not be saved on Google Drive', 503);
    }
    if (issue) return jsonSuccess({ success: true, data: parsed, parse_issue: issue, parse_title: ISSUES[issue].title, parse_warning: `${ISSUES[issue].text} The resume is uploaded. Please fill in the candidate's details below.` });
    return jsonSuccess({ success: true, data: parsed });
  } catch (e: any) {
    console.error('[resume/parse] Error:', e?.message || e);
    return jsonError(e, 500);
  }
}

export const POST = withApiLog(POST_handler);
