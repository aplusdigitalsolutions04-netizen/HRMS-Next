// The salary table of the offer, appointment and appraisal letters (Annexure I). Every employee has a different salary, so the components and
// their amounts are given for each letter (Make a letter); they start from the employee's salary structure when there is one.
//   monthly amount of each component, yearly = monthly x 12, Grand Total = the sum of the components.

export type CompLine = { name: string; amount: number };

// 108000 -> "1,08,000" (lakh and crore grouping, as in the letters)
export const inr = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-IN');

// the components typed for a letter, cleaned: a name and a monthly amount above 0 (at most 15)
export function cleanComponents(raw: any): CompLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CompLine[] = [];
  for (const r of raw) {
    const name = String(r?.name ?? '').trim().replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 40);
    const amount = Math.round(Number(r?.amount) * 100) / 100;
    if (name && amount > 0) out.push({ name, amount });
    if (out.length >= 15) break;
  }
  return out;
}
export const componentsTotal = (lines: CompLine[]) => Math.round(lines.reduce((a, b) => a + b.amount, 0) * 100) / 100;

// A sample, only for showing the table in the editor and in the preview of a letter text.
export const SAMPLE_COMPONENTS: CompLine[] = [
  { name: 'Basic', amount: 30000 }, { name: 'HRA', amount: 18000 }, { name: 'Travel Allowance', amount: 9000 }, { name: 'Food Voucher', amount: 3000 },
];

// The table as letter text (lines of | cell | cell |).
export function compensationMarkup(lines: CompLine[], currency = 'Rs.'): string {
  const total = componentsTotal(lines);
  if (!lines.length || !total) return '';
  const out = [`| Salary Component | Monthly (${currency}) | Yearly (${currency}) |`];
  for (const r of lines) out.push(`| ${r.name} | ${inr(r.amount)} | ${inr(r.amount * 12)} |`);
  out.push(`| **Grand Total** | **${inr(total)}** | **${inr(total * 12)}** |`);
  return out.join('\n');
}

// 33000 -> "Thirty-Three Thousand" (Indian way: thousand, lakh, crore)
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function below100(n: number): string { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''); }
function below1000(n: number): string { const h = Math.floor(n / 100), r = n % 100; return [h ? ONES[h] + ' Hundred' : '', r ? below100(r) : ''].filter(Boolean).join(' '); }
export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(below1000(crore) + ' Crore');
  if (lakh) parts.push(below100(lakh) + ' Lakh');
  if (thousand) parts.push(below100(thousand) + ' Thousand');
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}
