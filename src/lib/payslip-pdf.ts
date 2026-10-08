import puppeteer from 'puppeteer';

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

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    // Wait for the logo/signature images so they aren't missing from the PDF.
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '5mm', right: '5mm' } });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
