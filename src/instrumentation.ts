// Runs once when the Next.js server starts. It starts the background jobs: pulling check-in /
// check-out punches from TeamOffice every few minutes, and preparing monthly draft payslips.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startAttendanceAutoSync } = await import('./lib/attendance-auto-sync');
  startAttendanceAutoSync();
  const { startPayslipAutoDraft } = await import('./lib/payslip-auto-draft');
  startPayslipAutoDraft();
}
