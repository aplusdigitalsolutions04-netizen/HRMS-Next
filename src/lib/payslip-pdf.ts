// The PDF is made by a headless browser (best looking). Hosts that cannot run one (many shared hosts) get the same payslip
// drawn directly with pdfkit instead, so view and download always work.

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmt(v: any) { return Number(v || 0).toFixed(2); }
function fmtDate(v: any) {
  if (!v) return 'N/A';
  try { return new Date(v).toLocaleDateString('en-GB').replace(/\//g, '-'); } catch { return 'N/A'; }
}

// Indian-numbering (lakh/crore) amount-to-words, e.g. 45000 -> "Forty Five Thousand"
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function threeDigits(n: number): string {
  if (n < 100) return twoDigits(n);
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
}
function numberToWords(num: number): string {
  num = Math.round(num);
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const rest = num;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

export interface PayslipData {
  emp_code: string; month: number; year: number;
  basic_pay: number; hra: number; conveyance_allowance: number; food_vouchers: number;
  medical_insurance: number; other_deductions: number; incentives: number; el_encashment: number;
  gross_salary: number; total_deductions: number; total_adjustments: number; net_salary: number;
  paid_days: number; extra_work_days?: number; extra_work_pay?: number; variable_pay?: number; extra_components?: string | { label: string; amount: number; type?: string }[] | null; leave_availed: number; casual_leave: number; earned_leave: number;
  // employee fields
  full_name?: string; designation?: string; pay_mode?: string; date_of_joining?: string;
  account_number?: string; bank_name?: string; location?: string; pan?: string; uan?: string;
  // company fields
  company_name?: string; company_address?: string; company_logo?: string;
  prepared_by?: string; authorised_by?: string; prepared_signature?: string; authorised_signature?: string;
}

export async function generatePDF(p: PayslipData): Promise<Buffer> {
  const monthLabel = (monthNames[p.month - 1] || String(p.month)).toUpperCase();
  const net = Number(p.net_salary || 0);
  const netWords = net > 0 ? numberToWords(net) + ' Rupees Only' : '---';

  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Signatures are stored as image data URLs; only those are allowed into the HTML.
  const signImg = (v?: string) => v && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? `<img class="sign-img" src="${v}" />` : '<div class="sign-name"></div>';
  const bracket = (v?: string) => v && v.trim() ? `(${esc(v.trim())})` : '';
  const row = (label: string, value: any) => `<div class="ip-cell"><span class="ip-label">${label} :</span><span class="ip-value">${value === undefined || value === null || value === '' ? '---' : esc(value)}</span></div>`;
  const amt = (v: any) => (v === undefined || v === null || v === '') ? '---' : fmt(v);

  // Earnings: the four standard lines, then any custom split columns HR added.
  // Deductions: medical insurance, others. Adjustments: incentive, EL encash, then extra work /
  // variable pay when they are above zero. The table has as many rows as the longest column.
  let customCols: { label: string; amount: number; type: string }[] = [];
  try {
    const parsed = typeof p.extra_components === 'string' ? JSON.parse(p.extra_components) : p.extra_components;
    if (Array.isArray(parsed)) customCols = parsed.map((x: any) => ({ label: String(x?.label || '').trim(), amount: Number(x?.amount) || 0, type: x?.type === 'deduction' ? 'deduction' : 'earning' })).filter(x => x.label);
  } catch { customCols = []; }
  type Cell = [string, string];
  const earnings: Cell[] = [
    ['Basic Pay', amt(p.basic_pay)], ['House Rent Allowance', amt(p.hra)],
    ['Conveyance Allowance', amt(p.conveyance_allowance)], ['Food Vouchers', amt(p.food_vouchers)],
    ...customCols.filter(c => c.type === 'earning').map((c): Cell => [esc(c.label), fmt(c.amount)]),
  ];
  const deductions: Cell[] = [
    ['Medical Insurance', amt(p.medical_insurance)], ['Others', amt(p.other_deductions)],
    ...customCols.filter(c => c.type === 'deduction').map((c): Cell => [esc(c.label), fmt(c.amount)]),
  ];
  const adjustments: Cell[] = [['Incentive', amt(p.incentives)], ['EL Encash', amt(p.el_encashment)]];
  if (Number(p.extra_work_pay) > 0) adjustments.push([`Extra Work (${Number(p.extra_work_days) || 0} d)`, fmt(p.extra_work_pay)]);
  if (Number(p.variable_pay) > 0) adjustments.push(['Variable Pay', fmt(p.variable_pay)]);
  const rowCount = Math.max(earnings.length, deductions.length, adjustments.length, 4);
  const cell = (c?: Cell) => (c ? `<td>${c[0]}</td><td class="col-amt">${c[1]}</td>` : '<td></td><td></td>');
  let bodyRows = '';
  for (let i = 0; i < rowCount; i++) bodyRows += `<tr>${cell(earnings[i])}${cell(deductions[i])}${cell(adjustments[i])}</tr>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        :root { --accent: #15803d; --accent-soft: #f1f8f3; --tint: #ffffff; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { size: A4; }
        html, body { background: #fff; color-scheme: light; }
        body { font-family: 'Segoe UI', Calibri, Arial, 'Helvetica Neue', sans-serif; color: var(--ink); margin: 0; padding: 8px 22px; font-size: 12.5px; line-height: 1.45; }
        .slip { position: relative; background: var(--tint); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; page-break-inside: avoid; }

        .border-line { display: none; }
        .header { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 22px 26px 18px; border-bottom: 1px solid var(--line); border-top: 5px solid var(--accent); }
        .company-name { font-size: 22px; font-weight: 800; letter-spacing: .2px; margin: 0 0 5px; color: var(--ink); }
        .company-address { font-size: 11.5px; font-weight: 500; margin: 0; color: var(--muted); max-width: 440px; white-space: pre-line; line-height: 1.5; }
        .logo { max-height: 50px; max-width: 180px; object-fit: contain; }

        .payslip-title { text-align: center; font-weight: 700; font-size: 12.5px; letter-spacing: 2px; padding: 11px 0; background: var(--accent-soft); border-bottom: 1px solid var(--line); text-transform: uppercase; color: var(--accent); }

        .info-grid { margin: 0; border: 0; }
        .ip-row { display: flex; border-bottom: 1px solid #eef1f5; }
        .ip-row:last-child { border-bottom: 0; }
        .ip-cell { flex: 1; display: flex; align-items: baseline; gap: 10px; padding: 9px 26px; min-width: 0; }
        .ip-cell:first-child { border-right: 1px solid #eef1f5; }
        .ip-label { font-weight: 600; font-size: 10.5px; letter-spacing: .7px; text-transform: uppercase; color: var(--muted); min-width: 118px; flex-shrink: 0; }
        .ip-value { font-weight: 600; color: var(--ink); word-break: break-word; }

        .attendance { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: #f8fafc; }
        .attendance .ip-row { border-bottom-color: #e8ecf1; }

        table.main { width: 100%; border-collapse: collapse; margin: 0; }
        table.main th { text-align: left; font-weight: 700; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--accent); padding: 11px 14px; background: var(--accent-soft); border-bottom: 1px solid #cfe5d6; }
        table.main th:nth-child(2), table.main th:nth-child(3) { border-left: 1px solid #e5e7eb; }
        table.main td { padding: 9px 14px; border-bottom: 1px solid #f0f2f5; vertical-align: middle; }
        table.main td:nth-child(2), table.main td:nth-child(4) { border-right: 1px solid #eef1f5; }
        .col-amt { width: 88px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
        .section-head-row td { font-weight: 700; border-bottom: 1px solid #000; padding-top: 10px; }
        table.main tr.total-row td { font-weight: 700; background: #f8fafc; border-top: 1.5px solid #cbd5e1; border-bottom: 0; padding-top: 11px; padding-bottom: 11px; }

        .net-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 26px; margin: 0; background: var(--accent-soft); color: var(--ink); border-top: 2px solid var(--accent); font-size: 14px; font-weight: 700; letter-spacing: .4px; }
        .net-row span:last-child { font-size: 19px; font-weight: 800; color: var(--accent); font-variant-numeric: tabular-nums; }
        .words-row { display: flex; padding: 10px 26px 12px; font-style: italic; color: #475569; border-bottom: 1px solid var(--line); background: transparent; }

        .sign-area { display: flex; justify-content: space-between; gap: 48px; margin: 0; padding: 46px 40px 26px; border-top: 0; }
        .sign-box { text-align: center; width: 44%; display: flex; flex-direction: column; justify-content: flex-end; }
        .sign-name { font-size: 16px; font-family: 'Brush Script MT', cursive; margin-bottom: 4px; min-height: 46px; }
        .sign-img { max-height: 48px; max-width: 100%; object-fit: contain; margin: 0 auto 4px; }
        .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 5; overflow: hidden; }
        .watermark img { width: 66%; max-height: 40%; object-fit: contain; opacity: .07; transform: rotate(-30deg); }
        .watermark span { font-size: 64px; font-weight: 800; letter-spacing: 4px; color: #15803d; opacity: .06; transform: rotate(-28deg); text-align: center; text-transform: uppercase; white-space: nowrap; }
        .sign-label { font-weight: 700; color: #1e293b; border-top: 1.5px solid #94a3b8; padding-top: 7px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="slip">
      <div class="watermark">${p.company_logo && /^(data:image\/|https?:\/\/)/.test(p.company_logo) ? `<img src="${p.company_logo}" />` : `<span>${esc(p.company_name || 'A PLUS DIGITAL SOLUTIONS')}</span>`}</div>
      <div class="header">
        <div>
          <div class="company-name">${esc(p.company_name || 'A PLUS DIGITAL SOLUTIONS')}</div>
          <div class="company-address">${esc(p.company_address)}</div>
        </div>
        ${p.company_logo ? `<img class="logo" src="${p.company_logo}" />` : ''}
      </div>

      <div class="info-grid">
        <div class="ip-row">${row('Name', p.full_name)}${row('Designation', p.designation)}</div>
        <div class="ip-row">${row('Employee Id', p.emp_code)}${row('Pay Mode', p.pay_mode || 'Online')}</div>
        <div class="ip-row">${row('Date of Joining', fmtDate(p.date_of_joining))}${row('Account No', p.account_number)}</div>
        <div class="ip-row">${row('Location', p.location)}${row('Bank Name', p.bank_name)}</div>
        <div class="ip-row">${row('PAN', p.pan)}${row('UAN', p.uan || 'N/A')}</div>
      </div>

      <div class="payslip-title">PAYSLIP FOR THE MONTH OF ${monthLabel}</div>

      <div class="attendance">
        <div class="ip-row">${row('No of Paid Days', p.paid_days ?? 30)}${row('Leave Availed', p.leave_availed ?? 0)}</div>
        <div class="ip-row">${row('Casual Leave', p.casual_leave ?? 0)}${row('Earned Leave', p.earned_leave ?? 0)}</div>
      </div>

      <table class="main">
        <thead>
          <tr>
            <th colspan="2" style="width:36%">Earnings</th>
            <th colspan="2" style="width:34%">Deductions</th>
            <th colspan="2" style="width:30%">Adjustments</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr class="total-row">
            <td>Gross Total</td><td class="col-amt">${fmt(p.gross_salary)}</td>
            <td>Total</td><td class="col-amt">${fmt(p.total_deductions)}</td>
            <td>Total</td><td class="col-amt">${fmt(p.total_adjustments)}</td>
          </tr>
        </tbody>
      </table>

      <div class="net-row"><span>Net Salary&nbsp;:&nbsp;</span><span>${fmt(net)}</span></div>
      <div class="words-row">Rupees ${netWords}</div>

      <div class="sign-area">
        <div class="sign-box">
          ${signImg(p.prepared_signature)}
          <div class="sign-label">${bracket(p.prepared_by)}<br/>Prepared By</div>
        </div>
        <div class="sign-box">
          ${signImg(p.authorised_signature)}
          <div class="sign-label">${bracket(p.authorised_by)}<br/>Authorised By</div>
        </div>
      </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await withBrowser(html);
  } catch (e: any) {
    console.error('[payslip-pdf] the PDF browser is not available, using the built-in PDF writer:', String(e?.message || e).split(/\r?\n/)[0]);
    return drawPayslipWithPdfKit(p, { earnings, deductions, adjustments, rowCount, netWords, monthLabel });
  }
}

async function withBrowser(html: string): Promise<Buffer> {
  const puppeteer = (await import('puppeteer')).default;
  // a host that cannot start the browser should fail fast, not hang
  const browser: any = await Promise.race([
    puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('the PDF browser did not start in time')), 25000)),
  ]);
  try {
    const page = await browser.newPage();
    // Wait for the logo/signature images so they aren't missing from the PDF.
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '5mm', right: '5mm' } });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => {});
  }
}

// ---- built-in writer (no browser needed): same sections as the page above ----
// pdfkit reads PNG and JPEG itself; another kind of picture (such as WebP) is turned into PNG first when sharp is there
const dataImage = async (v?: string): Promise<Buffer | null> => {
  const m = v && /^data:image\/([a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(v);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (/^(png|jpe?g)$/i.test(m[1])) return buf;
  try { const sharp = (await import('sharp')).default; return await sharp(buf).png().toBuffer(); } catch { return null; }
};
// the standard PDF fonts hold Latin letters only; anything else would print as junk
const latin = (v: any) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/[^\x20-\x7e\xa0-\xff]/g, '');

async function drawPayslipWithPdfKit(p: PayslipData, t: { earnings: [string, string][]; deductions: [string, string][]; adjustments: [string, string][]; rowCount: number; netWords: string; monthLabel: string }): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default as any;
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Payslip ${p.emp_code} ${p.month}/${p.year}` } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res, rej) => { doc.on('end', () => res(Buffer.concat(chunks))); doc.on('error', rej); });

  const GREEN = '#15803d', SOFT = '#f1f8f3', INK = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0';
  const X = 28, W = 539;
  let y = 28;
  const txt = (str: any, x: number, yy: number, w: number, o: any = {}) => doc.text(latin(str), x, yy, { width: w, lineBreak: false, ellipsis: true, ...o });
  const hline = (yy: number, color = LINE) => doc.moveTo(X, yy).lineTo(X + W, yy).lineWidth(0.6).strokeColor(color).stroke();

  // watermark: the company logo, faint and tilted (the company name when there is no logo); drawn first so the text sits on top
  const mark = await dataImage(p.company_logo);
  doc.save();
  doc.rotate(-30, { origin: [X + W / 2, 420] });
  doc.fillOpacity(0.07);
  let marked = false;
  if (mark) { try { doc.opacity(0.07); doc.image(mark, X + W * 0.17, 330, { fit: [W * 0.66, 190], align: 'center', valign: 'center' }); marked = true; } catch { marked = false; } }
  if (!marked) {
    doc.fillColor(GREEN).fillOpacity(0.06).font('Helvetica-Bold').fontSize(54);
    doc.text(latin(p.company_name || 'A PLUS DIGITAL SOLUTIONS').toUpperCase(), X - 60, 400, { width: W + 120, align: 'center', lineBreak: false });
  }
  doc.restore();
  doc.fillOpacity(1).opacity(1);

  // header
  doc.rect(X, y, W, 5).fill(GREEN);
  y += 5;
  const logo = await dataImage(p.company_logo);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(19);
  txt(p.company_name || 'A PLUS DIGITAL SOLUTIONS', X + 20, y + 18, W - 230);
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.5);
  doc.text(latin(p.company_address || ''), X + 20, y + 44, { width: W - 230, height: 34 });
  if (logo) { try { doc.image(logo, X + W - 170, y + 14, { fit: [150, 52], align: 'right' }); } catch { /* a logo that cannot be read is left out */ } }
  y += 86;
  hline(y);

  // employee details
  const info: [string, any, string, any][] = [
    ['Name', p.full_name, 'Designation', p.designation],
    ['Employee Id', p.emp_code, 'Pay Mode', p.pay_mode || 'Online'],
    ['Date of Joining', fmtDate(p.date_of_joining), 'Account No', p.account_number],
    ['Location', p.location, 'Bank Name', p.bank_name],
    ['PAN', p.pan, 'UAN', p.uan || 'N/A'],
  ];
  const shown = (v: any) => (v === undefined || v === null || v === '' ? '---' : v);
  const infoRow = (l1: string, v1: any, l2: string, v2: any, yy: number, fill?: string) => {
    if (fill) doc.rect(X, yy, W, 22).fill(fill);
    const half = W / 2;
    [[l1, v1, X], [l2, v2, X + half]].forEach(([l, v, x]: any) => {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(latin(String(l).toUpperCase()) + ' :', x + 18, yy + 8, { width: 78, lineBreak: false });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5);
      txt(shown(v), x + 98, yy + 6.5, half - 112);
    });
    doc.moveTo(X + half, yy).lineTo(X + half, yy + 22).lineWidth(0.5).strokeColor('#eef1f5').stroke();
    doc.moveTo(X, yy + 22).lineTo(X + W, yy + 22).lineWidth(0.5).strokeColor('#eef1f5').stroke();
  };
  info.forEach(r => { infoRow(r[0], r[1], r[2], r[3], y); y += 22; });

  // title band
  doc.rect(X, y, W, 26).fill(SOFT);
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10.5).text(`PAYSLIP FOR THE MONTH OF ${t.monthLabel}`, X, y + 8, { width: W, align: 'center', characterSpacing: 1.6, lineBreak: false });
  y += 26;
  hline(y);

  // attendance
  infoRow('No of Paid Days', p.paid_days ?? 30, 'Leave Availed', p.leave_availed ?? 0, y, '#f8fafc'); y += 22;
  infoRow('Casual Leave', p.casual_leave ?? 0, 'Earned Leave', p.earned_leave ?? 0, y, '#f8fafc'); y += 22;

  // earnings / deductions / adjustments
  const gw = W / 3, aw = 56;
  doc.rect(X, y, W, 24).fill(SOFT);
  ['EARNINGS', 'DEDUCTIONS', 'ADJUSTMENTS'].forEach((h, i) => {
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8.5).text(h, X + i * gw + 12, y + 8, { width: gw - 20, characterSpacing: 1, lineBreak: false });
  });
  y += 24;
  const groups = [t.earnings, t.deductions, t.adjustments];
  for (let i = 0; i < t.rowCount; i++) {
    groups.forEach((g, gi) => {
      const c = g[i];
      if (!c) return;
      doc.fillColor(INK).font('Helvetica').fontSize(9.5);
      txt(c[0], X + gi * gw + 12, y + 6.5, gw - aw - 18);
      doc.font('Helvetica-Bold');
      txt(c[1], X + gi * gw + gw - aw - 8, y + 6.5, aw, { align: 'right' });
    });
    doc.moveTo(X, y + 22).lineTo(X + W, y + 22).lineWidth(0.5).strokeColor('#f0f2f5').stroke();
    y += 22;
  }
  doc.rect(X, y, W, 24).fill('#f8fafc');
  const totals: [string, string][] = [['Gross Total', fmt(p.gross_salary)], ['Total', fmt(p.total_deductions)], ['Total', fmt(p.total_adjustments)]];
  totals.forEach(([l, v], gi) => {
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5);
    txt(l, X + gi * gw + 12, y + 7.5, gw - aw - 18);
    txt(v, X + gi * gw + gw - aw - 8, y + 7.5, aw, { align: 'right' });
  });
  doc.moveTo(X, y).lineTo(X + W, y).lineWidth(1.2).strokeColor('#cbd5e1').stroke();
  // column dividers over the whole table
  const top = y - (t.rowCount * 22) - 24;
  [1, 2].forEach(i => doc.moveTo(X + i * gw, top).lineTo(X + i * gw, y + 24).lineWidth(0.5).strokeColor('#e5e7eb').stroke());
  y += 24;

  // net salary
  doc.rect(X, y, W, 34).fill(SOFT);
  doc.moveTo(X, y).lineTo(X + W, y).lineWidth(1.8).strokeColor(GREEN).stroke();
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Net Salary :', X + 20, y + 11, { lineBreak: false });
  doc.fillColor(GREEN).fontSize(16);
  txt(fmt(p.net_salary), X + W - 220, y + 8.5, 200, { align: 'right' });
  y += 34;
  doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(9.5);
  txt(`Rupees ${t.netWords}`, X + 20, y + 9, W - 40);
  y += 30;
  hline(y);

  // signatures
  const sign = async (label: string, name: string | undefined, img: string | undefined, x: number) => {
    const bw = 190;
    const buf = await dataImage(img);
    if (buf) { try { doc.image(buf, x + (bw - 120) / 2, y + 16, { fit: [120, 44], align: 'center' }); } catch { /* left out */ } }
    doc.moveTo(x, y + 68).lineTo(x + bw, y + 68).lineWidth(1).strokeColor('#94a3b8').stroke();
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(9.5);
    if (name && name.trim()) doc.text(`(${latin(name.trim())})`, x, y + 74, { width: bw, align: 'center', lineBreak: false });
    doc.text(label, x, y + 87, { width: bw, align: 'center', lineBreak: false });
  };
  await sign('Prepared By', p.prepared_by, p.prepared_signature, X + 40);
  await sign('Authorised By', p.authorised_by, p.authorised_signature, X + W - 40 - 190);
  y += 112;

  // frame around the whole slip
  doc.rect(X, 28, W, y - 28).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.end();
  return done;
}
