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
  hr_admins: {
    must_change_password: 'TINYINT(1) NOT NULL DEFAULT 0',
  },
  employees: {
    reminder_count: 'INT NOT NULL DEFAULT 0',
    last_reminder_on: 'DATETIME NULL',
    manager_id: 'VARCHAR(36) NULL',
    is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    deleted_at: 'DATETIME NULL',
    hr_remarks: 'TEXT NULL',
    bank_document: 'VARCHAR(255) NULL',
    additional_documents: 'TEXT NULL',
    official_email: 'VARCHAR(150) NULL',
    official_no: 'VARCHAR(50) NULL',
    pay_mode: "VARCHAR(20) NULL DEFAULT 'Online'",
    required_documents: 'TEXT NULL',
    exit_date: 'DATE NULL', // set when an employee is dropped or deleted - the Attrition report reads it
  },
  // The approval engine (manager -> HR) is used by leave, WFH and regularization requests.
  leave_requests: {
    workflow_id: 'VARCHAR(36) NULL',
    current_step: 'INT NULL',
  },
  wfh_requests: {
    workflow_id: 'VARCHAR(36) NULL',
    current_step: 'INT NULL',
  },
  // Missed punch / late coming go to the reporting manager first, then HR (same approval engine as leave).
  attendance_regularizations: {
    workflow_id: 'VARCHAR(36) NULL',
    current_step: 'INT NULL',
  },
  // Candidates who do not answer are moved to the No Response list (and back when they answer).
  interview_candidates: {
    no_response: 'TINYINT(1) NOT NULL DEFAULT 0',
    no_response_on: 'DATETIME NULL',
    no_response_note: 'VARCHAR(300) NULL',
    follow_up_count: 'INT NOT NULL DEFAULT 0',
    last_follow_up_on: 'DATETIME NULL',
  },
  // Own mailbox: the incoming (IMAP) server next to the outgoing (SMTP) one that was already stored.
  user_email_accounts: {
    imap_host: 'VARCHAR(255) NULL',
    imap_port: 'INT NULL',
    is_default: 'TINYINT(1) NOT NULL DEFAULT 0',
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
    // Draft -> Approved flow: employees only see APPROVED payslips; payslips that existed before stay APPROVED.
    status: "VARCHAR(20) NOT NULL DEFAULT 'APPROVED'",
    approved_by: 'VARCHAR(150) NULL',
    approved_on: 'DATETIME NULL',
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
  `CREATE TABLE IF NOT EXISTS approval_workflows (
    id VARCHAR(36) NOT NULL PRIMARY KEY, module_key VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
    is_active TINYINT(1) DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS approval_workflow_steps (
    id VARCHAR(36) NOT NULL PRIMARY KEY, workflow_id VARCHAR(36) NOT NULL, step_order INT NOT NULL,
    approver_type VARCHAR(20) NOT NULL, specific_user_id VARCHAR(36) NULL, label VARCHAR(100) NULL, KEY (workflow_id))`,
  `CREATE TABLE IF NOT EXISTS approval_actions (
    id VARCHAR(36) NOT NULL PRIMARY KEY, request_type VARCHAR(50) NOT NULL, request_id VARCHAR(36) NOT NULL, step_order INT NOT NULL,
    actor_type VARCHAR(20) NOT NULL, actor_id VARCHAR(36) NOT NULL, actor_name VARCHAR(150) NULL, action VARCHAR(20) NOT NULL,
    remarks TEXT NULL, acted_at DATETIME DEFAULT CURRENT_TIMESTAMP, KEY idx_request (request_type, request_id))`,
  `CREATE TABLE IF NOT EXISTS wfh_requests (
    id VARCHAR(36) PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
    reason TEXT, status VARCHAR(50) DEFAULT 'Pending', workflow_id VARCHAR(36), current_step INT,
    applied_on DATETIME DEFAULT CURRENT_TIMESTAMP, reviewed_by VARCHAR(255), reviewed_on DATETIME, rejection_reason TEXT)`,
  // "I forgot to punch" requests: the employee asks, HR approves, attendance is corrected.
  `CREATE TABLE IF NOT EXISTS attendance_regularizations (
    id VARCHAR(36) PRIMARY KEY, emp_code VARCHAR(50) NOT NULL, attendance_date DATE NOT NULL,
    in_time VARCHAR(20) NULL, out_time VARCHAR(20) NULL, request_type VARCHAR(30) DEFAULT 'Missed punch',
    reason TEXT, status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    applied_on DATETIME DEFAULT CURRENT_TIMESTAMP, reviewed_by VARCHAR(255) NULL, reviewed_on DATETIME NULL, review_note TEXT NULL,
    KEY (emp_code), KEY (status), KEY (attendance_date))`,
  // Company assets (laptop, ID card, ...) and who has them.
  `CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(36) PRIMARY KEY, asset_tag VARCHAR(60) NOT NULL, asset_type VARCHAR(60) NOT NULL DEFAULT 'Other',
    name VARCHAR(150) NOT NULL, serial_no VARCHAR(120) NULL, notes TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Available', created_by VARCHAR(255) NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_asset_tag (asset_tag), KEY (status))`,
  `CREATE TABLE IF NOT EXISTS asset_assignments (
    id VARCHAR(36) PRIMARY KEY, asset_id VARCHAR(36) NOT NULL, employee_id VARCHAR(36) NOT NULL,
    assigned_on DATE NOT NULL, returned_on DATE NULL, condition_out VARCHAR(150) NULL, condition_in VARCHAR(150) NULL,
    notes TEXT NULL, assigned_by VARCHAR(255) NULL, returned_by VARCHAR(255) NULL,
    KEY (asset_id), KEY (employee_id))`,
  // Master list of asset types (Laptop, ID Card, ...). HR manages it; nothing is built in.
  `CREATE TABLE IF NOT EXISTS asset_types (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60) NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_asset_type (name))`,
  // HR's permission for an employee to upload a document that is already in (one more upload, then it is used up).
  `CREATE TABLE IF NOT EXISTS document_reupload_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, document_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'requested', note VARCHAR(300) NULL, requested_on DATETIME NULL,
    granted_by VARCHAR(255) NULL, granted_on DATETIME NULL, UNIQUE KEY uq_doc_perm (employee_id, document_type))`,
  // Master list of leave types (Annual, Sick, ...). HR manages it; the employee forms and filters read from it.
  `CREATE TABLE IF NOT EXISTS leave_types (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60) NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_leave_type (name))`,
  // Master list of email template categories. request_kind links a category to a request mail
  // (leave / wfh / missed_punch / late_coming) so Settings > Request Mails only offers templates made for it.
  `CREATE TABLE IF NOT EXISTS template_categories (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, request_kind VARCHAR(30) NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_template_category (name))`,
  // Master list of request types (Leave, Work From Home, Missed punch, Late coming, ...): what a request mail can be for.
  `CREATE TABLE IF NOT EXISTS request_types (
    id INT AUTO_INCREMENT PRIMARY KEY, type_key VARCHAR(30) NOT NULL, name VARCHAR(60) NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_request_type_key (type_key), UNIQUE KEY uq_request_type_name (name))`,
  // Wrong-password counts per email and per address, for the login lock.
  `CREATE TABLE IF NOT EXISTS login_attempts (
    attempt_key VARCHAR(190) PRIMARY KEY, fails INT NOT NULL DEFAULT 0, last_attempt DATETIME NULL, locked_until DATETIME NULL)`,
  // Per-user settings: notification choices, language, dashboard widgets.
  `CREATE TABLE IF NOT EXISTS user_preferences (
    user_key VARCHAR(120) PRIMARY KEY, prefs TEXT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
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
    // Tables made here get the database's default text rules, which can differ from the older tables (employees ...). Joining
    // two tables with different rules fails with "Illegal mix of collations" and the page shows nothing. Bring the tables made
    // here to the same rules as employees; the data stays as it is.
    try {
      const [emp] = await p.query<RowDataPacket[]>("SELECT TABLE_COLLATION AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees'");
      const target = String(emp[0]?.c || '');
      if (/^[a-z0-9_]+$/i.test(target)) {
        const charset = target.split('_')[0];
        const ours = REQUIRED_TABLES.map(d => (d.match(/CREATE TABLE IF NOT EXISTS (\w+)/) || [])[1]).filter(Boolean);
        const [have] = await p.query<RowDataPacket[]>('SELECT TABLE_NAME AS t, TABLE_COLLATION AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
        for (const row of have) {
          if (!ours.includes(row.t) || !row.c || row.c === target) continue;
          try {
            await p.query(`ALTER TABLE \`${row.t}\` CONVERT TO CHARACTER SET ${charset} COLLATE ${target}`);
            console.log(`[schema] ${row.t} now uses ${target}`);
          } catch (e: any) { console.error(`[schema] could not change the text rules of ${row.t}:`, e?.message || e); }
        }
      }
    } catch (e: any) { console.error('[schema] text rules check skipped:', e?.message || e); }
    // More than one email per person: the old rule allowed a single row per person, now it is one row per address.
    try {
      const [ix] = await p.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_email_accounts' AND INDEX_NAME = 'uq_user'");
      if (Number(ix[0]?.n) > 0) {
        await p.query('ALTER TABLE user_email_accounts DROP INDEX uq_user');
        await p.query('ALTER TABLE user_email_accounts ADD UNIQUE KEY uq_user_email (user_id, user_type, sender_email)');
        console.log('[schema] user_email_accounts now allows several emails per person');
      }
      await p.query("UPDATE user_email_accounts a SET is_default = 1 WHERE is_default = 0 AND NOT EXISTS (SELECT 1 FROM (SELECT user_id, user_type FROM user_email_accounts WHERE is_default = 1) d WHERE d.user_id = a.user_id AND d.user_type = a.user_type)");
    } catch (e: any) { console.error('[schema] could not update user_email_accounts:', e?.message || e); }
    // notifications.user_id was a number, but people (employees, managers, HR) are identified by a text id, so every
    // notification meant for one person failed to save. Make it text; existing numbers are kept.
    try {
      const [t] = await p.query<RowDataPacket[]>("SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'user_id'");
      if (t[0] && /int/i.test(String(t[0].DATA_TYPE))) {
        await p.query('ALTER TABLE notifications MODIFY COLUMN user_id VARCHAR(36) NULL');
        console.log('[schema] notifications.user_id is now text');
      }
    } catch (e: any) { console.error('[schema] could not change notifications.user_id:', e?.message || e); }
  } catch (e: any) {
    console.error('[schema] check skipped:', e?.message || e);
  }
}

export async function getPool(): Promise<Pool> {
  if (!pool) {
    if (!process.env.MYSQL_PASSWORD) {
      throw new Error('MYSQL_PASSWORD environment variable is not set');
    }
    // During development every hot reload re-runs this module. Reusing one pool (kept on globalThis) stops each reload
    // from opening another set of connections until MySQL says "Too many connections".
    pool = (globalThis as any).__hrmPool || null;
    if (!pool) pool = mysql.createPool({
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
    (globalThis as any).__hrmPool = pool;
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
