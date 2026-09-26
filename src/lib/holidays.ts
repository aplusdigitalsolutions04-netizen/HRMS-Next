import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

let schemaReady = false;

// Holiday calendar (government / company holidays). Created on first use so no
// separate migration step is needed.
export async function ensureHolidaySchema() {
  if (schemaReady) return;
  await execute(`CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    holiday_date DATE NOT NULL,
    name VARCHAR(150) NOT NULL,
    holiday_type VARCHAR(30) NOT NULL DEFAULT 'Government',
    created_by VARCHAR(100) NULL,
    UNIQUE KEY uq_holiday_date (holiday_date)
  )`);
  schemaReady = true;
}

// Set of 'YYYY-MM-DD' holiday dates between two dates (inclusive).
export async function getHolidayDates(from: string, to: string): Promise<Set<string>> {
  await ensureHolidaySchema();
  const rows = await query<RowDataPacket[]>(
    "SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS d FROM holidays WHERE holiday_date BETWEEN ? AND ?",
    [from, to]
  );
  return new Set(rows.map(r => r.d));
}

export async function isHoliday(date: string): Promise<boolean> {
  return (await getHolidayDates(date, date)).has(date);
}
