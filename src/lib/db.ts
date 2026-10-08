// @ts-nocheck
import mysql, { Pool, RowDataPacket, ResultSetHeader, FieldPacket } from 'mysql2/promise';

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

// A database created from an older hr.sql can be missing columns/tables the app now
// uses (employees.pay_mode, salary_structures.ctc, employee_credentials, ...), which
// shows up as random "Unknown column" 500 errors. Once per server start, add whatever
// is missing. Everything here is additive (ADD COLUMN / CREATE TABLE IF NOT EXISTS), so
// it never changes or removes existing data, and a failure is logged but never blocks.
const REQUIRED_COLUMNS: Record<string, Record<string, string>> = {
  employees: {
    manager_id: 'VARCHAR(36) NULL',
    is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    deleted_at: 'DATETIME NULL',
    hr_remarks: 'TEXT NULL',
    bank_document: 'VARCHAR(255) NULL',
    additional_documents: 'TEXT NULL',
    official_email: 'VARCHAR(150) NULL',
    official_no: 'VARCHAR(50) NULL',
    pay_mode: "VARCHAR(20) NULL DEFAULT 'Online'",
  },
  salary_structures: {
    extra_components: 'TEXT NULL',
    ctc: 'FLOAT NULL',
    ctc_period: "VARCHAR(10) NULL DEFAULT 'monthly'",
  },
  payslips: {
    extra_work_days: 'FLOAT NOT NULL DEFAULT 0',
    extra_work_pay: 'FLOAT NOT NULL DEFAULT 0',
    variable_pay: 'FLOAT NOT NULL DEFAULT 0',
    extra_components: 'TEXT NULL',
  },
};
const REQUIRED_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS employee_credentials (
    id VARCHAR(36) PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, employee_name VARCHAR(150), emp_code VARCHAR(50),
    email VARCHAR(150), password VARCHAR(255), status VARCHAR(20) DEFAULT 'draft', draft_id VARCHAR(36),
    created_by VARCHAR(255), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, sent_at DATETIME NULL,
    KEY (employee_id), KEY (draft_id))`,
  `CREATE TABLE IF NOT EXISTS user_email_accounts (
    id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, user_type VARCHAR(20) NOT NULL,
    smtp_host VARCHAR(255) DEFAULT 'smtp.gmail.com', smtp_port INT DEFAULT 587, sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255), app_password VARCHAR(500) NOT NULL, encryption VARCHAR(50) DEFAULT 'TLS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME, UNIQUE KEY uq_user (user_id, user_type))`,
  `CREATE TABLE IF NOT EXISTS wfh_requests (
    id VARCHAR(36) PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
    reason TEXT, status VARCHAR(50) DEFAULT 'Pending', workflow_id VARCHAR(36), current_step INT,
    applied_on DATETIME DEFAULT CURRENT_TIMESTAMP, reviewed_by VARCHAR(255), reviewed_on DATETIME, rejection_reason TEXT)`,
];

async function syncSchema(p: Pool): Promise<void> {
  try {
    for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
      const [rows] = await p.query<RowDataPacket[]>(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]
      );
      if (rows.length === 0) continue; // table itself does not exist - not ours to create
      const have = new Set(rows.map(r => r.COLUMN_NAME));
      for (const [col, def] of Object.entries(cols)) {
        if (have.has(col)) continue;
        try {
          await p.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
          console.log(`[schema] added ${table}.${col}`);
        } catch (e: any) { console.error(`[schema] could not add ${table}.${col}:`, e?.message || e); }
      }
    }
    for (const ddl of REQUIRED_TABLES) {
      try { await p.query(ddl); }
      catch (e: any) { console.error('[schema] could not create table:', e?.message || e); }
    }
  } catch (e: any) {
    console.error('[schema] check skipped:', e?.message || e);
  }
}

export async function getPool(): Promise<Pool> {
  if (!pool) {
    if (!process.env.MYSQL_PASSWORD) {
      throw new Error('MYSQL_PASSWORD environment variable is not set');
    }
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB || 'HR',
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    schemaReady = syncSchema(pool);
  }
  if (schemaReady) await schemaReady;
  return pool;
}

export async function query<T extends RowDataPacket[] = any>(sql: string, params?: any[]): Promise<T> {
  const p = await getPool();
  const [rows] = await p.execute<T>(sql, params || []);
  return rows;
}

export async function execute(sql: string, params?: any[]): Promise<ResultSetHeader> {
  const p = await getPool();
  const [result] = await p.execute<ResultSetHeader>(sql, params || []);
  return result;
}

export async function getConnection() {
  const p = await getPool();
  return p.getConnection();
}
