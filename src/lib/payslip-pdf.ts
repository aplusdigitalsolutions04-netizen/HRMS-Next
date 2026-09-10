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
  paid_days: number; leave_availed: number; casual_leave: number; earned_leave: number;
  // employee fields
  full_name?: string; designation?: string; pay_mode?: string; date_of_joining?: string;
  account_number?: string; bank_name?: string; location?: string; pan?: string; uan?: string;
  // company fields
  company_name?: string; company_address?: string; company_logo?: string;
  prepared_by?: string; authorised_by?: string; authorised_signature?: string;
}

export async function generatePDF(p: PayslipData): Promise<Buffer> {
  const monthLabel = (monthNames[p.month - 1] || String(p.month)).toUpperCase();
  const net = Number(p.net_salary || 0);
  const netWords = net > 0 ? numberToWords(net) + ' Rupees Only' : '---';

  const row = (label: string, value: any) => `<div class="ip-cell"><span class="ip-label">${label} :</span><span class="ip-value">${value ?? '---'}</span></div>`;
  const amt = (v: any) => (v === undefined || v === null || v === '') ? '---' : fmt(v);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: Calibri, Arial, 'Helvetica Neue', sans-serif; color: #000; margin: 0; padding: 30px 36px; font-size: 12.5px; }
        .border-line { border-top: 3px solid #000; margin-bottom: 14px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; }
        .company-name { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
        .company-address { font-size: 12px; font-weight: 600; margin: 0; }
        .logo { max-height: 42px; }
        .info-grid { margin-top: 14px; border-top: 2px solid #000; }
        .ip-row { display: flex; border-bottom: 1px solid #000; }
        .ip-cell { flex: 1; display: flex; padding: 6px 4px; }
        .ip-cell:first-child { border-right: 1px solid #000; }
        .ip-label { font-weight: 700; min-width: 130px; }
        .ip-value { }
        .payslip-title { text-align: center; font-weight: 700; padding: 8px 0; border-bottom: 1px solid #000; text-transform: uppercase; }
        table.main { width: 100%; border-collapse: collapse; margin-top: 0; }
        table.main th { text-align: left; font-weight: 700; padding: 6px 4px; border-bottom: 1px solid #000; }
        table.main td { padding: 6px 4px; border-bottom: 1px solid #f1f1f1; }
        .col-amt { text-align: right; white-space: nowrap; }
        .section-head-row td { font-weight: 700; border-bottom: 1px solid #000; padding-top: 10px; }
        .total-row td { font-weight: 700; border-top: 1.5px solid #000; border-bottom: none; }
        .net-row { display: flex; border-top: 2px solid #000; padding: 8px 4px; font-weight: 700; }
        .words-row { display: flex; padding: 4px 4px 10px; }
        .sign-area { display: flex; justify-content: space-between; margin-top: 46px; padding-top: 4px; border-top: 2px solid #000; }
        .sign-box { text-align: center; width: 45%; }
        .sign-name { font-size: 16px; font-family: 'Brush Script MT', cursive; margin-bottom: 4px; min-height: 24px; }
        .sign-img { max-height: 46px; margin-bottom: 4px; }
        .sign-label { font-weight: 700; border-top: 1px solid #000; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="border-line"></div>
      <div class="header">
        <div>
          <div class="company-name">${p.company_name || 'A PLUS DIGITAL SOLUTIONS'}</div>
          <div class="company-address">${p.company_address || ''}</div>
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

      <div class="ip-row">${row('No of Paid Days', p.paid_days ?? 30)}${row('Leave Availed', p.leave_availed ?? 0)}</div>
      <div class="ip-row" style="border-bottom:2px solid #000;">${row('Casual Leave', p.casual_leave ?? 0)}${row('Earned Leave', p.earned_leave ?? 0)}</div>

      <table class="main">
        <thead>
          <tr>
            <th colspan="2" style="width:36%">Earnings</th>
            <th colspan="2" style="width:34%">Deductions</th>
            <th colspan="2" style="width:30%">Adjustments</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Pay</td><td class="col-amt">${amt(p.basic_pay)}</td>
            <td>Medical Insurance</td><td class="col-amt">${amt(p.medical_insurance)}</td>
            <td>Incentive</td><td class="col-amt">${amt(p.incentives)}</td>
          </tr>
          <tr>
            <td>House Rent Allowance</td><td class="col-amt">${amt(p.hra)}</td>
            <td>Others</td><td class="col-amt">${amt(p.other_deductions)}</td>
            <td>EL Encash</td><td class="col-amt">${amt(p.el_encashment)}</td>
          </tr>
          <tr>
            <td>Conveyance Allowance</td><td class="col-amt">${amt(p.conveyance_allowance)}</td>
            <td></td><td></td><td></td><td></td>
          </tr>
          <tr>
            <td>Food Vouchers</td><td class="col-amt">${amt(p.food_vouchers)}</td>
            <td></td><td></td><td></td><td></td>
          </tr>
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
          <div class="sign-name"></div>
          <div class="sign-label">${p.prepared_by || ''}<br/>Prepared By</div>
        </div>
        <div class="sign-box">
          ${p.authorised_signature ? `<img class="sign-img" src="${p.authorised_signature}" />` : '<div class="sign-name"></div>'}
          <div class="sign-label">${p.authorised_by || ''}<br/>Authorised By</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '5mm', right: '5mm' } });
  await browser.close();

  return Buffer.from(pdfBuffer);
}
