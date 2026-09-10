import { execute } from './db';
import { now } from './utils';

export interface AuditLogData {
  action: string;
  entity_type: string;
  entity_id?: string;
  performed_by?: string; // id
  performed_by_email?: string;
  details?: any;
}

export async function logAudit(data: AuditLogData) {
  try {
    const detailsStr = data.details ? JSON.stringify(data.details) : null;
    await execute(
      'INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, performed_by_email, details, created_on) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        data.action,
        data.entity_type,
        data.entity_id || null,
        data.performed_by || null,
        data.performed_by_email || null,
        detailsStr,
        now()
      ]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
