// Runs once when the Next.js server starts. It starts the background jobs: pulling check-in /
// check-out punches from TeamOffice every few minutes, and preparing monthly draft payslips.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { encryptStoredSecrets } = await import('./lib/secure-migrate');
  // runs a little after start, when the database tables are ready
  setTimeout(() => { encryptStoredSecrets(); }, 15000);
  const { startAttendanceAutoSync } = await import('./lib/attendance-auto-sync');
  startAttendanceAutoSync();
  const { startPayslipAutoDraft } = await import('./lib/payslip-auto-draft');
  startPayslipAutoDraft();
}
