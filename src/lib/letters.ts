// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { getPayslipSignatories } from './payroll-calc';
import { snapshotOf, monthlyTotal } from './salary-history';
import { getConfig } from './app-config';
import { parseLetter } from './letter-markup';

// Letters (offer, appointment, confirmation, experience, relieving) made from a template with the employee's details filled in, as a PDF.
// A template is plain text: a blank line starts a new paragraph, a line starting with "- " is a bullet, a line starting with "# " is a
// centred heading; **bold**, *italic*, __underline__ and <center> / <right> work too (see letter-markup.ts). {{name}}-style placeholders are replaced.

// The starting letters of a new install. After that the list lives in the database (letter_templates) and HR adds and removes types
// on the Letters page.
const STARTER_TYPES: { key: string; label: string }[] = [
  { key: 'offer', label: 'Offer letter' },
  { key: 'appointment', label: 'Appointment letter' },
  { key: 'confirmation', label: 'Confirmation letter' },
  { key: 'experience', label: 'Experience letter' },
  { key: 'relieving', label: 'Relieving letter' },
];
export async function letterTypes(): Promise<{ key: string; label: string }[]> {
  await ensureLetterTemplates();
  const rows = await query<RowDataPacket[]>('SELECT letter_type, name FROM letter_templates ORDER BY name');
  return rows.map(r => ({ key: r.letter_type, label: r.name }));
}

// ---- the words of a letter ----
// Nothing about the words is fixed in the code. Every word ({{name}}) is a row in letter_variables that HR can edit or remove on the
// Letters page > Letter words. A word is filled in one of three ways: from a piece of data (SOURCES: the employee's profile, the company
// settings, the salary structure, the dates typed in the form), from a fixed text, or typed in each time a letter is made.
// SOURCES only lists which pieces of data exist; the standard set of words below is put in once on a new install.
export const SOURCES: [string, string][] = [
  ['employee_name', 'Employee name'], ['emp_code', 'Employee ID'], ['designation', 'Designation'], ['location', 'Work location'],
  ['reporting_manager', 'Reporting manager'], ['joining_date', 'Date of joining'], ['date_of_birth', 'Date of birth'], ['father_spouse_name', 'Father / spouse name'],
  ['email', 'Personal email'], ['official_email', 'Official email'], ['mobile', 'Mobile number'],
  ['present_address', 'Present address'], ['permanent_address', 'Permanent address'], ['pan', 'PAN'], ['uan', 'UAN'], ['bank_name', 'Bank name'],
  ['salary_monthly', 'Gross monthly salary'], ['ctc_annual', 'Salary per year'],
  ['resignation_date', 'Resignation date (typed in the form)'], ['last_working_day', 'Last working day (typed in the form)'], ['effective_date', 'Effective date (typed in the form)'],
  ['tenure', 'Time worked (joining to last working day, or to today)'],
  ['today', 'Date of the letter'], ['month_year', 'Current month and year'], ['year', 'Current year'],
  ['company_name', 'Company name'], ['company_address', 'Company address'], ['signatory_name', 'Authorised signatory'],
];
const SOURCE_IDS = new Set(SOURCES.map(x => x[0]));
export const isSource = (id: string) => SOURCE_IDS.has(id);

// word, name shown to HR, data it is filled from
const STANDARD_WORDS: [string, string, string][] = [
  ['name', 'Employee name', 'employee_name'], ['emp_code', 'Employee ID', 'emp_code'], ['designation', 'Designation', 'designation'], ['location', 'Work location', 'location'],
  ['reporting_manager', 'Reporting manager', 'reporting_manager'], ['joining_date', 'Date of joining', 'joining_date'], ['resignation_date', 'Resignation date', 'resignation_date'],
  ['last_working_day', 'Last working day', 'last_working_day'], ['effective_date', 'Effective date', 'effective_date'], ['salary_monthly', 'Gross monthly salary', 'salary_monthly'],
  ['ctc_annual', 'Salary per year', 'ctc_annual'], ['today', 'Date of the letter', 'today'], ['company_name', 'Company name', 'company_name'],
  ['company_address', 'Company address', 'company_address'], ['signatory_name', 'Authorised signatory', 'signatory_name'],
  ['email', 'Personal email', 'email'], ['official_email', 'Official email', 'official_email'], ['mobile', 'Mobile number', 'mobile'], ['date_of_birth', 'Date of birth', 'date_of_birth'],
  ['father_spouse_name', 'Father / spouse name', 'father_spouse_name'], ['present_address', 'Present address', 'present_address'], ['permanent_address', 'Permanent address', 'permanent_address'],
  ['pan', 'PAN', 'pan'], ['uan', 'UAN', 'uan'], ['bank_name', 'Bank name', 'bank_name'], ['tenure', 'Time worked', 'tenure'], ['month_year', 'Current month and year', 'month_year'], ['year', 'Current year', 'year'],
];

export type LetterWord = { key: string; label: string; kind: 'field' | 'text' | 'ask'; value: string };

// puts the standard words in once; words HR removed later stay removed (restoreStandardWords brings them back on request)
export async function ensureLetterWords() {
  const done = (await query<RowDataPacket[]>("SELECT 1 FROM system_settings WHERE setting_key = 'letter_words_seeded'"))[0];
  if (done) return;
  for (const [k, l, src] of STANDARD_WORDS) await execute("INSERT IGNORE INTO letter_variables (var_key, label, kind, value, updated_at) VALUES (?,?, 'field', ?, NOW())", [k, l, src]);
  await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_words_seeded', '1')");
}
export async function restoreStandardWords(): Promise<number> {
  let n = 0;
  for (const [k, l, src] of STANDARD_WORDS) { const r: any = await execute("INSERT IGNORE INTO letter_variables (var_key, label, kind, value, updated_at) VALUES (?,?, 'field', ?, NOW())", [k, l, src]); n += Number(r.affectedRows || 0); }
  await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_words_seeded', '1')");
  return n;
}
export async function letterWords(): Promise<LetterWord[]> {
  await ensureLetterWords();
  const rows = await query<RowDataPacket[]>('SELECT var_key, label, kind, value FROM letter_variables ORDER BY label');
  return rows.map(r => ({ key: r.var_key, label: r.label, kind: r.kind === 'ask' ? 'ask' : r.kind === 'field' ? 'field' : 'text', value: r.value || '' }));
}
// [word, name] pairs for the clickable list on the letter texts
export async function allPlaceholders(): Promise<[string, string][]> {
  return (await letterWords()).map(v => [v.key, v.label + (v.kind === 'ask' ? ' (asked each time)' : '')] as [string, string]);
}

const COMMON_END = `
For {{company_name}}

{{signatory_name}}
Authorised Signatory`;

export const DEFAULT_TEMPLATES: Record<string, string> = {
  offer: `Dear {{name}},

We are pleased to offer you the position of {{designation}} at {{company_name}}, based at {{location}}.

- Date of joining: {{joining_date}}
- Gross monthly salary: {{salary_monthly}} ({{ctc_annual}} per year)
- Reporting to: {{reporting_manager}}

This offer depends on the verification of your documents and references. Please sign and return a copy of this letter to confirm that you accept it.

We look forward to welcoming you to the team.
${COMMON_END}`,
  appointment: `# APPOINTMENT LETTER

Dear {{name}},

With reference to your application and the discussions we had, we are pleased to appoint you as {{designation}} at {{company_name}} with effect from {{joining_date}}.

- Employee ID: {{emp_code}}
- Place of work: {{location}}
- Gross monthly salary: {{salary_monthly}} ({{ctc_annual}} per year)
- Reporting to: {{reporting_manager}}

You will be bound by the rules, policies and code of conduct of the company that are in force from time to time. Your appointment can be ended by either side by giving notice as per the company policy.

Please sign the duplicate copy of this letter as a token of your acceptance.
${COMMON_END}`,
  confirmation: `# CONFIRMATION LETTER

Dear {{name}},

We are happy to inform you that, after a review of your performance, your services as {{designation}} are confirmed with effect from {{effective_date}}.

All other terms and conditions of your appointment remain the same.

We thank you for your contribution and wish you continued success with {{company_name}}.
${COMMON_END}`,
  experience: `# EXPERIENCE CERTIFICATE

To whom it may concern,

This is to certify that {{name}} (Employee ID {{emp_code}}) worked with {{company_name}} as {{designation}} from {{joining_date}} to {{last_working_day}}.

During this period we found the conduct and work of {{name}} to be satisfactory. We wish {{name}} all the best for the future.
${COMMON_END}`,
  relieving: `# RELIEVING LETTER

Dear {{name}},

This is to confirm that your resignation dated {{resignation_date}} has been accepted and that you are relieved from your duties as {{designation}} at {{company_name}} at the close of working hours on {{last_working_day}}.

We confirm that you have handed over your responsibilities and company property, and we have no dues pending from your side as on the date of this letter, subject to the final settlement of your accounts.

We thank you for your services and wish you every success.
${COMMON_END}`,
};

export async function ensureLetterTemplates() {
  // the starting letters are put in once; later removals stay removed
  const done = (await query<RowDataPacket[]>("SELECT 1 FROM system_settings WHERE setting_key = 'letters_seeded'"))[0];
  if (done) return;
  for (const t of STARTER_TYPES) {
    await execute('INSERT IGNORE INTO letter_templates (letter_type, name, body, updated_at) VALUES (?,?,?,NOW())', [t.key, t.label, DEFAULT_TEMPLATES[t.key] || '']);
  }
  await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letters_seeded', '1')");
}

// ---- values for the placeholders ----
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// The reference number HR may type for a letter (it can be left empty): returns the cleaned number, or { error, status } when it cannot be used.
// excludeId is the letter being edited (it may keep its own number).
export async function checkLetterRef(raw: any, excludeId?: any): Promise<{ ref?: string; error?: string; status?: number }> {
  const ref = String(raw || '').trim();
  if (!ref) return { ref: '' }; // a letter does not have to carry a reference number
  if (ref.length > 30) return { error: 'The reference number can be at most 30 characters', status: 422 };
  if (!/^[A-Za-z0-9][A-Za-z0-9 \/\-_.#]*$/.test(ref)) return { error: 'The reference number can have letters, numbers, spaces and / - _ . # only', status: 422 };
  const dup = await query<RowDataPacket[]>('SELECT 1 FROM letters_issued WHERE LOWER(ref_no) = LOWER(?) AND id <> ? LIMIT 1', [ref, excludeId ? Number(excludeId) : 0]);
  if (dup.length) return { error: `A letter with the reference number ${ref} already exists`, status: 409 };
  return { ref };
}

export function longDate(v: any): string {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return String(v);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
export const rupees = (v: any, c: any) => c.currency_label + ' ' + Math.round(Number(v) || 0).toLocaleString(c.locale);

export async function letterVars(employeeId: string, fields: Record<string, any> = {}): Promise<{ vars: Record<string, string>; employee: any } | null> {
  const e = (await query<RowDataPacket[]>(
    `SELECT e.*, m.full_name AS manager_name, DATE_FORMAT(e.date_of_joining, '%Y-%m-%d') AS joined FROM employees e LEFT JOIN employees m ON m.id = e.manager_id WHERE e.id = ? AND e.is_deleted = 0`, [employeeId]))[0];
  if (!e) return null;
  const cfg = await getConfig();
  const co = (await query<RowDataPacket[]>('SELECT company_name, company_address FROM company_settings LIMIT 1'))[0] || {};
  const ss = (await query<RowDataPacket[]>('SELECT * FROM salary_structures WHERE emp_code = ?', [e.emp_code]))[0];
  const monthly = ss ? monthlyTotal(snapshotOf(ss)) : 0;
  const sig = await getPayslipSignatories();
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const lwd = String(fields.last_working_day || '').slice(0, 10);
  // every piece of data a word can be filled from
  const data: Record<string, string> = {
    employee_name: e.full_name || '', emp_code: e.emp_code || '', designation: e.designation || '', location: e.location || '',
    reporting_manager: e.manager_name || 'the management',
    joining_date: longDate(fields.joining_date || e.joined), resignation_date: longDate(fields.resignation_date), last_working_day: longDate(fields.last_working_day),
    effective_date: longDate(fields.effective_date), salary_monthly: monthly ? rupees(monthly, cfg) : '', ctc_annual: monthly ? rupees(monthly * 12, cfg) : '',
    today: longDate(ymd),
    company_name: co.company_name || '', company_address: co.company_address || '', signatory_name: sig.authorised_by || 'Authorised Signatory',
    email: e.email_id || '', official_email: e.official_email || '', mobile: e.mobile_no || '', date_of_birth: longDate(e.dob), father_spouse_name: e.father_spouse_name || '',
    present_address: e.present_address || '', permanent_address: e.permanent_address || '', pan: e.pan || '', uan: e.uan || '', bank_name: e.bank_name || '',
    month_year: `${MONTHS[today.getMonth()]} ${today.getFullYear()}`, year: String(today.getFullYear()),
    tenure: tenureText(fields.joining_date || e.joined, /^\d{4}-\d{2}-\d{2}$/.test(lwd) ? new Date(lwd + 'T00:00:00') : today),
  };
  // the words HR has set up: from data, a fixed text, or what was typed for this letter
  const asked = (fields && typeof fields.custom === 'object' && fields.custom) || {};
  const vars: Record<string, string> = {};
  for (const v of await letterWords()) {
    vars[v.key] = v.kind === 'field' ? (data[v.value] ?? '') : v.kind === 'ask' ? String(asked[v.key] ?? '').slice(0, 500) : v.value;
  }
  return { vars, employee: e };
}

// "2 years 3 months" between two dates
function tenureText(from: string, to: Date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(from || '').slice(0, 10));
  if (!m) return '';
  const a = new Date(+m[1], +m[2] - 1, +m[3]);
  let months = (to.getFullYear() - a.getFullYear()) * 12 + (to.getMonth() - a.getMonth()) - (to.getDate() < a.getDate() ? 1 : 0);
  if (months < 0) return '';
  const y = Math.floor(months / 12), mo = months % 12;
  const parts = [y ? `${y} year${y > 1 ? 's' : ''}` : '', mo ? `${mo} month${mo > 1 ? 's' : ''}` : ''].filter(Boolean);
  return parts.join(' ') || 'less than a month';
}
const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function fillLetter(body: string, vars: Record<string, string>): string {
  return String(body || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => (vars[String(k).toLowerCase()] ?? ''));
}

// ---- the PDF (drawn directly, so it works on a server without a browser) ----
const latin = (v: any) => String(v ?? '').replace(/₹/g, 'Rs. ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, '');
const dataImage = (v?: string): Buffer | null => {
  const m = v && /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  return m ? Buffer.from(m[2], 'base64') : null;
};

// ---- the letterhead: the company header drawn by the app, HR's own letterhead image, or nothing (pre-printed paper) ----
// placement: where the picture goes. "auto" looks at its shape: a picture about the shape of an A4 page covers the page, a wide strip
// (a header band) goes at the top. A picture is never stretched: it keeps its own proportions.
export type Letterhead = { mode: 'company' | 'image' | 'none'; image: string; top_mm: number; bottom_mm: number; placement: 'auto' | 'top' | 'bottom' | 'full' };
export const LETTERHEAD_DEFAULT: Letterhead = { mode: 'company', image: '', top_mm: 40, bottom_mm: 25, placement: 'auto' };
export async function getLetterhead(): Promise<Letterhead> {
  try {
    const r = (await query<RowDataPacket[]>('SELECT mode, image, top_mm, bottom_mm, placement FROM letterhead_settings WHERE id = 1'))[0];
    if (!r) return { ...LETTERHEAD_DEFAULT };
    return { mode: ['image', 'none'].includes(r.mode) ? r.mode : 'company', image: r.image || '', top_mm: Number(r.top_mm), bottom_mm: Number(r.bottom_mm), placement: ['top', 'bottom', 'full'].includes(r.placement) ? r.placement : 'auto' };
  } catch { return { ...LETTERHEAD_DEFAULT }; } // the table is made at the next start; until then the usual header
}
const mmToPt = (mm: number) => Math.round((Number(mm) || 0) * 2.8346);

// the size in pixels of a PNG or JPG
function imageSize(buf: Buffer): { w: number; h: number } | null {
  try {
    if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* unreadable: the caller falls back */ }
  return null;
}

// Where the letterhead picture is drawn on an A4 page (in points) and how much of the page it takes at the top or the bottom.
const A4_W = 595.28, A4_H = 841.89;
type Plan = { x: number; y: number; w: number; h: number; where: 'top' | 'bottom' | 'full' };
export function planLetterhead(buf: Buffer, placement: string): Plan {
  const sz = imageSize(buf);
  const ratio = sz && sz.h > 0 ? sz.w / sz.h : A4_W / A4_H;
  const where = placement === 'top' || placement === 'bottom' || placement === 'full' ? placement : (ratio >= 0.55 && ratio <= 0.9 ? 'full' : 'top');
  if (where === 'full') {
    // the whole page; a picture that is not A4-shaped is fitted inside the page, centred, never stretched
    const w = ratio >= A4_W / A4_H ? A4_W : A4_H * ratio, h = ratio >= A4_W / A4_H ? A4_W / ratio : A4_H;
    return { x: (A4_W - w) / 2, y: (A4_H - h) / 2, w, h, where };
  }
  const h = A4_W / ratio; // across the full width of the page
  return { x: 0, y: where === 'top' ? 0 : A4_H - h, w: A4_W, h, where };
}

async function startDoc(title: string, spacing?: { top: number; bottom: number }, background?: { buf: Buffer; plan: Plan } | null) {
  const PDFDocument = (await import('pdfkit')).default as any;
  const doc = new PDFDocument({ size: 'A4', margins: { top: spacing ? spacing.top : 50, bottom: spacing ? spacing.bottom : 60, left: 56, right: 56 }, info: { Title: title } });
  if (background) {
    // the letterhead picture is drawn on every page; the text cursor is put back where it was after drawing it
    const { buf, plan } = background;
    const paint = () => { const x = doc.x, y = doc.y; try { doc.image(buf, plan.x, plan.y, { width: plan.w, height: plan.h }); } catch { /* a picture that cannot be read is left out */ } doc.x = x; doc.y = y; };
    paint();
    doc.on('pageAdded', paint);
  }
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res, rej) => { doc.on('end', () => res(Buffer.concat(chunks))); doc.on('error', rej); });
  return { doc, done };
}

async function drawHeader(doc: any) {
  const co = (await query<RowDataPacket[]>('SELECT company_name, company_address, company_logo FROM company_settings LIMIT 1'))[0] || {};
  const logo = dataImage(co.company_logo);
  const left = doc.page.margins.left, width = doc.page.width - left - doc.page.margins.right;
  let y = 40;
  if (logo) { try { doc.image(logo, left, y, { fit: [120, 44] }); } catch { /* a logo that cannot be read is left out */ } }
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(latin(co.company_name || ''), left, y + 2, { width, align: 'right' });
  doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text(latin(co.company_address || ''), left + 160, y + 20, { width: width - 160, align: 'right' });
  y += 56;
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1.2).strokeColor('#2563eb').stroke();
  doc.y = y + 16; doc.x = left;
  return { left, width };
}

// A new PDF page set up with the letterhead chosen on the Letters > Letterhead page (the company header, HR's own picture, or empty paper).
// The letters and the full and final statement both start here, so they carry the same header.
async function startLetterheadDoc(title: string, letterhead?: Letterhead) {
  const lh = letterhead || await getLetterhead();
  const bg = lh.mode === 'image' ? dataImage(lh.image) : null;
  const mode = lh.mode === 'image' && !bg ? 'company' : lh.mode; // an image that is missing or unreadable falls back to the company header
  // a strip at the top (or bottom) also pushes the text down (or up) past itself, so the text never lands on the design
  const plan = bg ? planLetterhead(bg, lh.placement) : null;
  let top = mmToPt(lh.top_mm), bottom = mmToPt(lh.bottom_mm);
  if (plan && plan.where === 'top') top = Math.max(top, Math.round(plan.y + plan.h + 14));
  if (plan && plan.where === 'bottom') bottom = Math.max(bottom, Math.round(A4_H - plan.y + 10));
  const { doc, done } = await startDoc(title, mode === 'company' ? undefined : { top, bottom }, bg && plan ? { buf: bg, plan } : null);
  const { left, width } = mode === 'company' ? await drawHeader(doc) : { left: doc.page.margins.left, width: doc.page.width - doc.page.margins.left - doc.page.margins.right };
  return { doc, done, left, width };
}

export async function renderLetterPdf(o: { title: string; ref: string; date: string; text: string }, letterhead?: Letterhead): Promise<Buffer> {
  const { doc, done, left, width } = await startLetterheadDoc(o.title, letterhead);
  // the reference number and the date are printed only when the letter has them
  if (o.ref || o.date) {
    const refY = doc.y;
    doc.fillColor('#475569').font('Helvetica').fontSize(9.5);
    if (o.ref) doc.text(`Ref: ${latin(o.ref)}`, left, refY, { width, align: 'left' });
    if (o.date) doc.text(`Date: ${latin(o.date)}`, left, refY, { width, align: 'right' });
    doc.y = refY + 20;
  }

  // the text, read the same way as the preview on the Letters page (see letter-markup.ts)
  const fontOf = (r: { bold?: boolean; italic?: boolean }) => (r.bold && r.italic ? 'Helvetica-BoldOblique' : r.bold ? 'Helvetica-Bold' : r.italic ? 'Helvetica-Oblique' : 'Helvetica');
  for (const block of parseLetter(o.text)) {
    for (const ln of block) {
      const isHead = ln.kind === 'heading';
      const size = isHead ? 13 : 10.5;
      const indent = ln.kind === 'bullet' || ln.kind === 'number' ? 12 : 0;
      const x = left + indent, w = width - indent;
      if (isHead) doc.moveDown(0.4);
      // a bullet or a number is written in front of the first words
      const runs: any[] = ln.label ? [{ text: ln.label + '  ', raw: true }, ...ln.runs] : ln.runs;
      const shown = (r: any) => (r.raw ? r.text : latin(r.text));
      const drawn = runs.filter(r => shown(r).length);
      if (!drawn.length) continue;
      drawn.forEach((r, i) => {
        doc.fillColor(isHead ? '#0f172a' : '#1e293b').font(fontOf(r)).fontSize(size);
        const opts: any = { width: w, align: ln.align, lineGap: 2, underline: !!r.underline, continued: i < drawn.length - 1 };
        if (i === 0) doc.text(shown(r), x, doc.y, opts); else doc.text(shown(r), opts);
      });
      if (isHead) doc.moveDown(0.8);
    }
    doc.moveDown(0.8);
  }

  // signature of the authorised person (Payslip Settings)
  const sig = await getPayslipSignatories();
  const img = dataImage(sig.authorised_signature);
  if (img) { try { if (doc.y > doc.page.height - 130) doc.addPage(); doc.image(img, left, doc.y, { fit: [120, 44] }); doc.moveDown(3.2); } catch { /* left out */ } }
  doc.end();
  return done;
}

// F&F statement: who, the lines (earnings and deductions) and the net amount
export async function renderStatementPdf(o: { title: string; ref: string; date: string; rows: [string, string][]; lines: { label: string; amount: number; type: string }[]; net: number }): Promise<Buffer> {
  const cfg = await getConfig();
  const { doc, done, left, width } = await startLetterheadDoc(o.title);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text(latin(o.title), left, doc.y, { width, align: 'center' });
  const refLine = [o.ref ? `Ref: ${latin(o.ref)}` : '', o.date ? `Date: ${latin(o.date)}` : ''].filter(Boolean).join('    ');
  if (refLine) doc.moveDown(0.3).fillColor('#64748b').font('Helvetica').fontSize(9).text(refLine, left, doc.y, { width, align: 'center' });
  doc.moveDown(1);
  for (const [k, v] of o.rows) {
    const y = doc.y;
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9.5).text(latin(k), left, y, { width: 150 });
    doc.fillColor('#0f172a').font('Helvetica').fontSize(10).text(latin(v), left + 155, y, { width: width - 155 });
  }
  doc.moveDown(0.8);
  const col = (label: string, type: string) => {
    const rows = o.lines.filter(l => l.type === type);
    doc.fillColor(type === 'earning' ? '#15803d' : '#b91c1c').font('Helvetica-Bold').fontSize(10.5).text(label, left, doc.y, { width });
    doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).lineWidth(0.6).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.5);
    if (!rows.length) { doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(9.5).text('None', left, doc.y); doc.moveDown(0.5); }
    let total = 0;
    for (const r of rows) {
      const y = doc.y; total += Number(r.amount) || 0;
      doc.fillColor('#1e293b').font('Helvetica').fontSize(10).text(latin(r.label), left, y, { width: width - 110 });
      doc.text(rupees(r.amount, cfg), left + width - 100, y, { width: 100, align: 'right' });
    }
    const y = doc.y + 2;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('Total', left, y, { width: width - 110 }).text(rupees(total, cfg), left + width - 100, y, { width: 100, align: 'right' });
    doc.moveDown(1);
  };
  col('Amounts payable to the employee', 'earning');
  col('Amounts recovered from the employee', 'deduction');
  doc.moveDown(0.2);
  const y = doc.y;
  doc.rect(left, y - 4, width, 28).fillColor('#eff6ff').fill();
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(o.net >= 0 ? 'Net amount payable' : 'Net amount recoverable', left + 10, y + 3, { width: width - 130 });
  doc.text(rupees(Math.abs(o.net), cfg), left + width - 120, y + 3, { width: 110, align: 'right' });
  doc.moveDown(3);
  doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text('This is a computer generated statement.', left, doc.y, { width, align: 'center' });
  doc.end();
  return done;
}
