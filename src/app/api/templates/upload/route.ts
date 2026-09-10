// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import OpenAI from 'openai';
import mammoth from 'mammoth';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buffer);
  return data.text || '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function extractTemplateWithAI(text: string): Promise<{ subject: string; body: string; variables: string[] }> {
  const prompt = `You are given the raw text of an email template document. Identify the email subject line and the email body, and list any placeholder variables used (e.g. CANDIDATE_NAME, POSITION, COMPANY_NAME). Return pure JSON only, no markdown, no code fences, in this exact shape:
{
  "subject": "the subject line",
  "body": "the email body (preserve line breaks as \\n)",
  "variables": ["VAR_ONE", "VAR_TWO"]
}

Document text:
"""${text.slice(0, 8000)}"""`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You extract structured email template data from documents. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });

  const content = response.choices?.[0]?.message?.content || '{}';
  const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    subject: parsed.subject || '',
    body: parsed.body || '',
    variables: Array.isArray(parsed.variables) ? parsed.variables : [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const fd = await req.formData();
    const file = fd.get('file');
    if (!file || !(file instanceof File)) return jsonError('No file uploaded', 422);

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let rawText = '';

    if (ext === 'pdf') {
      rawText = await extractTextFromPDF(buffer);
    } else if (ext === 'html') {
      rawText = stripHtml(buffer.toString('utf-8'));
    } else if (ext === 'docx' || ext === 'doc') {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else {
      return jsonError('Unsupported file type. Please upload PDF, HTML, or DOCX.', 422);
    }

    if (!rawText.trim()) {
      return jsonError('Could not extract any text from the uploaded file.', 422);
    }

    const extracted = await extractTemplateWithAI(rawText);

    return jsonSuccess({
      data: {
        name: file.name.replace(/\.[^/.]+$/, ''),
        subject: extracted.subject,
        body: extracted.body,
        variables: extracted.variables.length > 0 ? extracted.variables : ['CANDIDATE_NAME', 'POSITION', 'COMPANY_NAME'],
      }
    });
  } catch (e: any) {
    console.error('[templates/upload] Error:', e?.message || e);
    return jsonError(e, 500);
  }
}
