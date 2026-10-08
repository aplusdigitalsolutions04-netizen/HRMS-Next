// Runs once when the Next.js server starts. It starts the background job that pulls
// check-in / check-out punches from TeamOffice every few minutes.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startAttendanceAutoSync } = await import('./lib/attendance-auto-sync');
  startAttendanceAutoSync();
}
