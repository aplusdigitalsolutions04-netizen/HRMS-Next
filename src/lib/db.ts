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
  email_templates: {
    cc_emails: 'TEXT NULL',
    bcc_emails: 'TEXT NULL',
  },
  letterhead_settings: {
    placement: "VARCHAR(10) NOT NULL DEFAULT 'auto'",
  },
  letters_issued: {
    emailed_at: 'DATETIME NULL',
    emailed_to: 'VARCHAR(150) NULL',
    emailed_by: 'VARCHAR(150) NULL',
    no_date: 'TINYINT(1) NOT NULL DEFAULT 0', // 1 = the letter is made without a date printed on it
  },
  hr_admins: {
    must_change_password: 'TINYINT(1) NOT NULL DEFAULT 0',
  },
  employees: {
    profile_edit_allowed: 'TINYINT(1) NOT NULL DEFAULT 0',
    drive_folder_id: 'VARCHAR(120) NULL',
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
    el_frequency_id: 'INT NULL',   // EL Frequencies master; empty = the company-wide setting
    statutory_off: 'VARCHAR(200) NULL',   // codes of statutory deductions this employee is left out of (comma separated)
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
  // Statutory deductions (PF, ESI, TDS ...): the rules and their rates are entered by HR (Payroll > Statutory Deductions); nothing is built in.
  `CREATE TABLE IF NOT EXISTS statutory_rules (
    id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(20) NOT NULL, name VARCHAR(80) NOT NULL, kind VARCHAR(10) NOT NULL DEFAULT 'percent', enabled TINYINT(1) NOT NULL DEFAULT 0,
    wage_base VARCHAR(10) NOT NULL DEFAULT 'basic', employee_rate FLOAT NOT NULL DEFAULT 0, employer_rate FLOAT NOT NULL DEFAULT 0, wage_ceiling FLOAT NULL, eligible_below FLOAT NULL,
    fixed_amount FLOAT NOT NULL DEFAULT 0, min_amount FLOAT NULL, rounding VARCHAR(10) NOT NULL DEFAULT 'rupee', exemption FLOAT NOT NULL DEFAULT 0, cess FLOAT NOT NULL DEFAULT 0,
    slabs TEXT NULL, sort_order INT NOT NULL DEFAULT 100, UNIQUE KEY uq_stat_code (code))`,
  // Letters: the text templates (offer, appointment, ...) and every letter that was made for an employee.
  `CREATE TABLE IF NOT EXISTS letter_templates (
    letter_type VARCHAR(30) PRIMARY KEY, name VARCHAR(80) NOT NULL, body MEDIUMTEXT NOT NULL, updated_by VARCHAR(150) NULL, updated_at DATETIME NULL)`,
  // Words HR adds for the letters: a fixed text ({{hr_phone}}) or one that is asked for each time a letter is made.
  `CREATE TABLE IF NOT EXISTS letter_variables (
    var_key VARCHAR(40) PRIMARY KEY, label VARCHAR(80) NOT NULL, kind VARCHAR(10) NOT NULL DEFAULT 'text', value TEXT NULL,
    updated_by VARCHAR(150) NULL, updated_at DATETIME NULL)`,
  `CREATE TABLE IF NOT EXISTS letters_issued (
    id INT AUTO_INCREMENT PRIMARY KEY, ref_no VARCHAR(30) NULL, employee_id VARCHAR(36) NOT NULL, emp_code VARCHAR(50) NULL, letter_type VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL, body MEDIUMTEXT NOT NULL, issued_by VARCHAR(150) NULL, issued_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_letters_emp (employee_id))`,
  // Exit: one row for an employee who is leaving - dates, checklist and the full and final settlement.
  `CREATE TABLE IF NOT EXISTS employee_exits (
    id INT AUTO_INCREMENT PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, emp_code VARCHAR(50) NULL, resignation_date DATE NOT NULL, last_working_day DATE NOT NULL,
    notice_days INT NOT NULL DEFAULT 30, reason VARCHAR(80) NULL, status VARCHAR(20) NOT NULL DEFAULT 'In Progress', checklist TEXT NULL, fnf_json TEXT NULL,
    fnf_total FLOAT NOT NULL DEFAULT 0, remarks VARCHAR(500) NULL, created_by VARCHAR(150) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_on DATETIME NULL, completed_on DATETIME NULL, UNIQUE KEY uq_exit_emp (employee_id))`,
  // Salary revision history: each change of a salary structure with the date it applies from, the reason, and the structure before and after.
  `CREATE TABLE IF NOT EXISTS salary_revisions (
    id INT AUTO_INCREMENT PRIMARY KEY, emp_code VARCHAR(50) NOT NULL, effective_from DATE NOT NULL, reason VARCHAR(40) NOT NULL DEFAULT 'Other', note VARCHAR(300) NULL,
    old_json TEXT NULL, new_json TEXT NOT NULL, old_total FLOAT NULL, new_total FLOAT NOT NULL DEFAULT 0, revised_by VARCHAR(150) NULL, created_at DATETIME NULL,
    INDEX idx_rev_emp (emp_code, effective_from))`,
  // Help Desk: an employee's question to HR (a ticket) and the messages of the conversation.
  `CREATE TABLE IF NOT EXISTS help_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY, ticket_no VARCHAR(20) NULL, employee_id VARCHAR(36) NOT NULL, category VARCHAR(40) NOT NULL DEFAULT 'Other',
    subject VARCHAR(150) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Open', assigned_to VARCHAR(150) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL, INDEX idx_ht_employee (employee_id), INDEX idx_ht_status (status))`,
  `CREATE TABLE IF NOT EXISTS help_ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY, ticket_id INT NOT NULL, author_type VARCHAR(10) NOT NULL, author_name VARCHAR(150) NULL, author_email VARCHAR(150) NULL,
    message TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_htm_ticket (ticket_id))`,
  // Notices HR posts for every employee to see on the home page.
  `CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(150) NOT NULL, body TEXT NULL, is_pinned TINYINT(1) NOT NULL DEFAULT 0,
    starts_on DATE NULL, expires_on DATE NULL, created_by VARCHAR(150) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
  // Document expiry: the date an employee's document (passport, licence, certificate ...) stops being valid, and the last reminder sent.
  `CREATE TABLE IF NOT EXISTS document_expiry (
    id INT AUTO_INCREMENT PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, document_type VARCHAR(60) NOT NULL, expiry_date DATE NOT NULL,
    last_notice VARCHAR(10) NULL, updated_by VARCHAR(150) NULL, updated_at DATETIME NULL, UNIQUE KEY uq_doc_expiry (employee_id, document_type))`,
  // API log: one row per call to /api (and per call refused before reaching a route, or failed in the browser). See lib/api-log.ts.
  `CREATE TABLE IF NOT EXISTS api_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, ref VARCHAR(12) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    source VARCHAR(10) NOT NULL DEFAULT 'server', method VARCHAR(8) NULL, path VARCHAR(300) NULL, query_string VARCHAR(500) NULL,
    status INT NULL, duration_ms INT NULL, user_type VARCHAR(20) NULL, user_email VARCHAR(150) NULL, user_id VARCHAR(40) NULL,
    ip VARCHAR(64) NULL, user_agent VARCHAR(250) NULL, request_body TEXT NULL, error_message TEXT NULL, error_detail TEXT NULL,
    INDEX idx_api_logs_time (created_at), INDEX idx_api_logs_status (status), INDEX idx_api_logs_path (path(100)))`,
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
  // EL (earned leave) days: every Extra Work day earns one. One row per employee and month: what was earned that month, what was
  // credited to the balance (all at once at the end of the EL period, see el_frequencies) and the balance after it. Shown on the Salary Sheet.
  `CREATE TABLE IF NOT EXISTS el_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY, emp_code VARCHAR(50) NOT NULL, month INT NOT NULL, year INT NOT NULL,
    earned_days FLOAT NOT NULL DEFAULT 0, credited_days FLOAT NOT NULL DEFAULT 0, balance_days FLOAT NOT NULL DEFAULT 0,
    period_months INT NOT NULL DEFAULT 1, updated_at DATETIME NULL, UNIQUE KEY uq_el_ledger (emp_code, month, year))`,
  // Master list of how often EL encashment is paid with the salary (Monthly, Quarterly, Half Yearly, Yearly). months = every how many months.
  `CREATE TABLE IF NOT EXISTS el_frequencies (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60) NOT NULL, months INT NOT NULL DEFAULT 1, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_el_frequency (name))`,
  // The letterhead of the letters (one row): which header the PDF gets, the letterhead image, and the space left at the top and bottom.
  `CREATE TABLE IF NOT EXISTS letterhead_settings (
    id TINYINT PRIMARY KEY, mode VARCHAR(10) NOT NULL DEFAULT 'company', image MEDIUMTEXT NULL, placement VARCHAR(10) NOT NULL DEFAULT 'auto',
    top_mm INT NOT NULL DEFAULT 40, bottom_mm INT NOT NULL DEFAULT 25, updated_by VARCHAR(150) NULL, updated_at DATETIME NULL)`,
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
  // Every sign-in, right or wrong. A right one is also an open session (sid is in the token) until it expires, is signed out or is revoked.
  `CREATE TABLE IF NOT EXISTS login_history (
    id INT AUTO_INCREMENT PRIMARY KEY, sid VARCHAR(40) NULL, user_type VARCHAR(12) NULL, user_id VARCHAR(40) NULL, email VARCHAR(150) NULL,
    ip VARCHAR(60) NULL, user_agent VARCHAR(300) NULL, ok TINYINT(1) NOT NULL DEFAULT 1, reason VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_seen DATETIME NULL, expires_at DATETIME NULL, revoked_at DATETIME NULL,
    UNIQUE KEY uq_login_sid (sid), KEY ix_login_user (user_type, user_id), KEY ix_login_created (created_at))`,
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

// Runs fn while holding a MySQL named lock, so two requests doing the same thing (for example making the payslip of one month) cannot overlap.
// The lock belongs to one connection that is kept until fn ends. Returns { locked: false } when the lock could not be had within waitSeconds.
export async function withNamedLock<T>(name: string, waitSeconds: number, fn: () => Promise<T>): Promise<{ locked: boolean; value?: T }> {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT GET_LOCK(?, ?) AS got', [name.slice(0, 60), waitSeconds]);
    if (Number(rows[0]?.got) !== 1) return { locked: false };
    try { return { locked: true, value: await fn() }; }
    finally { await conn.query('SELECT RELEASE_LOCK(?)', [name.slice(0, 60)]).catch(() => { }); }
  } finally { conn.release(); }
}

export async function getConnection() {
  const p = await getPool();
  return p.getConnection();
}
