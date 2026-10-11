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

// Short form for route handlers: who (the signed-in user) did what to which record.
export async function auditFrom(user: any, action: string, entity_type: string, entity_id?: string | null, details?: any) {
  await logAudit({
    action, entity_type, entity_id: entity_id || undefined,
    performed_by: user?.id ? String(user.id) : undefined,
    performed_by_email: user?.email || undefined,
    details,
  });
}
