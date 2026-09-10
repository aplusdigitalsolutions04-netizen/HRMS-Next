import { execute } from './src/lib/db';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS user_email_accounts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        user_type VARCHAR(20) NOT NULL,
        smtp_host VARCHAR(255) DEFAULT 'smtp.gmail.com',
        smtp_port INT DEFAULT 587,
        sender_email VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255),
        app_password VARCHAR(500) NOT NULL,
        encryption VARCHAR(50) DEFAULT 'TLS',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        UNIQUE KEY uq_user (user_id, user_type)
      )
    `);
    console.log('Created user_email_accounts table');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
