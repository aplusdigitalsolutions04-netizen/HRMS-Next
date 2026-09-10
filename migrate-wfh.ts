import { query, execute } from './src/lib/db';
import { uuidv4 } from './src/lib/utils';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  try {
    const wf = await query(`SELECT * FROM approval_workflows WHERE module_key='wfh'`);
    if (wf.length === 0) {
      const wId = uuidv4();
      await execute("INSERT INTO approval_workflows (id, module_key, name, is_active) VALUES (?, 'wfh', 'Work From Home Approval', 1)", [wId]);
      await execute("INSERT INTO approval_workflow_steps (id, workflow_id, step_order, approver_type, label) VALUES (?, ?, 1, 'MANAGER', 'Reporting Manager')", [uuidv4(), wId]);
      await execute("INSERT INTO approval_workflow_steps (id, workflow_id, step_order, approver_type, label) VALUES (?, ?, 2, 'HR', 'HR Approval')", [uuidv4(), wId]);
      console.log('Created workflow for WFH');
    } else {
      console.log('Workflow for WFH already exists');
    }

    await execute(`
      CREATE TABLE IF NOT EXISTS wfh_requests (
        id VARCHAR(36) PRIMARY KEY,
        employee_id VARCHAR(36) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        workflow_id VARCHAR(36),
        current_step INT,
        applied_on DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_by VARCHAR(255),
        reviewed_on DATETIME,
        rejection_reason TEXT
      )
    `);
    console.log('Created wfh_requests table');

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
