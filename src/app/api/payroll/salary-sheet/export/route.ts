// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { computeSalarySheet } from '@/lib/salary-sheet';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_payroll')) return jsonError('Insufficient permissions', 403);

    const sp = new URL(req.url).searchParams;
    const now = new Date();
    const month = parseInt(sp.get('month') || '') || now.getMonth() + 1;
    const year = parseInt(sp.get('year') || '') || now.getFullYear();
    const rows = await computeSalarySheet(month, year);

    const header = [
      'Emp Code', 'Employee', 'Month Days', 'Paid Days', 'UnPaid Days', 'PerDay Salary', 'Net Payable',
      'Insurance', 'Other Deductions', 'Variable Pay', 'Incentive / Payback', 'EL Days', 'EL Pay', 'Extra Work Days', 'Extra Work Pay', `Salary of ${MONTHS[month - 1]}`, 'Final Salary Transfer', 'EL Earned', 'EL Given', 'EL Balance', 'CL Used', 'CL Left', 'Statutory Deductions', 'Employer Contribution',
    ];
    const data = rows.map(r => [
      r.emp_code, r.full_name, r.month_days, r.paid_days, r.unpaid_days, r.per_day_salary, r.net_payable,
      r.insurance, r.other_deductions + r.custom_deductions, r.variable_pay, r.incentive, r.el_days ?? '', r.el_pay, r.extra_work_days, r.extra_work_pay, r.net_payable, r.final_salary, r.el_earned, r.el_credited, r.el_balance, r.cl_used, r.cl_left, r.statutory_total, r.employer_contrib,
    ]);
    const sum = (i: number) => Math.round(data.reduce((t, row) => t + (Number(row[i]) || 0), 0) * 100) / 100;
    const totals = ['', 'TOTAL', '', '', '', '', sum(6), sum(7), sum(8), sum(9), sum(10), '', sum(12), '', sum(14), sum(15), sum(16), sum(17), sum(18), '', '', '', sum(21), sum(22)];

    const ws = XLSX.utils.aoa_to_sheet([[`Salary Sheet - ${MONTHS[month - 1]} ${year}`], [], header, ...data, totals]);
    ws['!cols'] = [{ wch: 10 }, { wch: 26 }, ...Array(22).fill({ wch: 15 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary Sheet');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Salary_Sheet_${MONTHS[month - 1]}_${year}.xlsx"`,
      },
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
