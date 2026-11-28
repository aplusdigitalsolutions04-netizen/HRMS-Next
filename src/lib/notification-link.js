// Where a notification leads when it is clicked: the page where the thing it tells about is handled.
// n: { category, reference_id, title }. Staff pages are paths; the employee portal is one page with menus, so for an employee the answer is a menu key.

// staff (HR / admin) pages
const STAFF = {
  leave_apply: '/leave/manage',
  leave_approved: '/leave/manage', leave_rejected: '/leave/manage', leave_cancelled: '/leave/manage',
  wfh_apply: '/wfh/manage', wfh_approved: '/wfh/manage', wfh_rejected: '/wfh/manage',
  regularization: '/attendance/corrections', regularization_request: '/attendance/corrections',
  attendance_request_manager_approved: '/attendance/corrections',
  asset: '/assets',
  payroll_draft: '/payroll/history',
  helpdesk: '/helpdesk/manage', helpdesk_status_changed: '/helpdesk/manage',
  document_expiry: '/documents/expiry',
  document_request: '/document-approvals', document_permission: '/document-approvals', document_reupload_allowed: '/document-approvals',
  profile_edit: '/employees/pending', profile_edit_revoked: '/employees/pending',
  letter: '/letters/made', letter_issued: '/letters/made',
  employee: '/employees/manage',
  // the older kinds written in capitals
  INTERVIEW: '/candidates/data', CANDIDATE: '/candidates/data', EMAIL: '/email-log', EMPLOYEE: '/employees/manage',
  ATTENDANCE: '/attendance/daily', TEMPLATE: '/settings/templates', SETTINGS: '/settings/company', REMINDER: '/candidates/data',
};

// employee portal menus (the keys of the menu of the portal)
const EMPLOYEE = {
  leave_apply: 'leave', leave_approved: 'leave', leave_rejected: 'leave', leave_cancelled: 'leave',
  wfh_apply: 'wfh', wfh_approved: 'wfh', wfh_rejected: 'wfh',
  regularization: 'attendance', regularization_request: 'attendance', attendance_request_manager_approved: 'attendance', ATTENDANCE: 'attendance',
  helpdesk: 'helpdesk', helpdesk_status_changed: 'helpdesk',
  letter: 'letters', letter_issued: 'letters',
  document_expiry: 'documents', document_request: 'documents', document_permission: 'documents', document_reupload_allowed: 'documents',
  profile_edit: 'profile', profile_edit_revoked: 'profile',
  payroll_draft: 'payslips', payslip: 'payslips',
  asset: 'profile',
};

export function staffNotificationPath(n) {
  const c = n && n.category;
  if (c === 'employee' && n.reference_id) return `/employees/detail/${n.reference_id}`;
  return STAFF[c] || '';
}
export function employeeNotificationMenu(n) { return EMPLOYEE[n && n.category] || ''; }
