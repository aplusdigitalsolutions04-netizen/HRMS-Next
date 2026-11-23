// The salary breakup table of the offer, appointment and appraisal letters (Annexure I): the same sums for the PDF, the preview and the
// Letters > Salary Breakup page, so what HR sees is what is printed.
//
//   Grand total (monthly)  = the monthly salary typed for the letter
//   Variable pay           = an amount inside that total (may be 0)
//   Fixed part             = grand total - variable pay
//   each component         = its percent of the fixed part (the percents are set by HR and add up to 100)
//   yearly                 = monthly x 12

export type BreakupRow = { name: string; percent: number; extra?: string[]; variable?: boolean; amount?: number };

// Only the starting values of a new install; after that HR owns the list (Letters > Salary Breakup).
export const DEFAULT_BREAKUP: BreakupRow[] = [
  { name: 'Basic', percent: 50 },
  { name: 'HRA', percent: 30 },
  { name: 'Travel Allowance', percent: 15 },
  { name: 'Food Voucher', percent: 5 },
];

// 108000 -> "1,08,000" (lakh and crore grouping, as in the letters)
export const inr = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-IN');

export type CompRow = { name: string; monthly: number; yearly: number; extra: string[]; variable: boolean };
export type Compensation = { rows: CompRow[]; variable: number; total: number; fixed: number; listed?: boolean };

// A component is either a percent or a fixed monthly amount. The fixed amounts are taken first; the percent components share what is left
// (their percents add up to 100). The base is the fixed salary (total - typed variable pay), or the whole total when a component is marked Variable.
export function compensation(total: number, variable: number, breakup: BreakupRow[]): Compensation {
  const T = Math.max(0, Math.round(Number(total) || 0));
  const list = breakup.filter(b => b.name && (b.percent > 0 || (b.amount || 0) > 0));
  const listed = list.some(b => b.variable);
  const V = listed ? 0 : Math.min(T, Math.max(0, Math.round(Number(variable) || 0)));
  const base = T - V;
  const fixedSum = list.reduce((a, b) => a + ((b.amount || 0) > 0 ? Math.round(b.amount as number) : 0), 0);
  const rest = Math.max(0, base - fixedSum);
  const amts = list.map(b => ((b.amount || 0) > 0 ? Math.round(b.amount as number) : Math.round((rest * b.percent) / 100)));
  // rounding must never change the total: the difference goes to the first percent component (not a variable one if possible)
  const pct = list.map((b, i) => i).filter(i => !((list[i].amount || 0) > 0));
  const tgt = pct.find(i => !list[i].variable) ?? pct[0];
  if (tgt !== undefined && fixedSum <= base) amts[tgt] += base - amts.reduce((a, b) => a + b, 0);
  const rows = list.map((b, i) => ({ name: b.name, monthly: amts[i], yearly: amts[i] * 12, extra: b.extra || [], variable: !!b.variable }));
  if (listed) { const vv = rows.reduce((a, r) => a + (r.variable ? r.monthly : 0), 0); return { rows, variable: vv, total: T, fixed: T - vv, listed: true }; }
  return { rows, variable: V, total: T, fixed: base };
}

// The table as letter text (lines of | cell | cell |), so HR can still change a figure in the text box before the PDF is made.
export function compensationMarkup(total: number, variable: number, breakup: BreakupRow[], currency = 'Rs.', variableLabel = 'Variable Pay', columns: string[] = []): string {
  const c = compensation(total, variable, breakup);
  if (!c.total) return '';
  // extra columns: details HR types for each component on Letters > Salary Breakup (a dash where a component has none)
  const ex = (a?: string[]) => columns.map((_, i) => ` | ${String((a || [])[i] || '').trim() || '-'}`).join('');
  const lines = [`| Salary Component | Monthly (${currency}) | Yearly (${currency}) |${columns.map(h => ` ${h} |`).join('')}`];
  for (const r of c.rows) lines.push(`| ${r.name} | ${inr(r.monthly)} | ${inr(r.yearly)}${ex(r.extra)} |`);
  if (c.variable > 0 && !c.listed) lines.push(`| ${variableLabel} | ${inr(c.variable)} | ${inr(c.variable * 12)}${ex()} |`);
  lines.push(`| **Grand Total** | **${inr(c.total)}** | **${inr(c.total * 12)}**${ex()} |`);
  return lines.join('\n');
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
