import { execute } from './src/lib/db';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS employee_credentials (
        id VARCHAR(36) PRIMARY KEY,
        employee_id VARCHAR(36) NOT NULL,
        employee_name VARCHAR(150),
        emp_code VARCHAR(50),
        email VARCHAR(150),
        password VARCHAR(255),
        status VARCHAR(20) DEFAULT 'draft',
        draft_id VARCHAR(36),
        created_by VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME NULL,
        KEY (employee_id),
        KEY (draft_id)
      )
    `);
    console.log('Created employee_credentials table');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
