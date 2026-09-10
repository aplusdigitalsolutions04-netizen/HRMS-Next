export const ALL_PERMISSIONS: Record<string, { label: string; group: string; default: boolean }> = {
  view_dashboard:         { label: "View Dashboard",                group: "Dashboard",             default: true },
  view_employees:         { label: "View Employee List",           group: "Employee Management",  default: true },
  view_employee_details:  { label: "View Employee Details",        group: "Employee Management",  default: true },
  add_employee:           { label: "Add Employees",                group: "Employee Management",  default: false },
  edit_employee:          { label: "Edit Employees",               group: "Employee Management",  default: false },
  delete_employee:        { label: "Delete Employees",             group: "Employee Management",  default: false },
  approve_employee:       { label: "Approve Pending Employees",    group: "Employee Management",  default: false },
  approve_documents:      { label: "Approve Employee Documents",   group: "Employee Management",  default: false },
  view_leave:             { label: "View Leave Requests",          group: "Leave Management",     default: true },
  approve_leave:          { label: "Approve/Reject Leave",         group: "Leave Management",     default: false },
  view_wfh:               { label: "View WFH Requests",            group: "Leave Management",     default: true },
  approve_wfh:            { label: "Approve/Reject WFH",           group: "Leave Management",     default: false },
  view_attendance:        { label: "View Attendance Reports",      group: "Attendance",           default: true },
  upload_attendance:      { label: "Upload Attendance",            group: "Attendance",           default: false },
  verify_attendance:      { label: "Verify Attendance",            group: "Attendance",           default: false },
  view_candidates:        { label: "View Candidate Pool",          group: "Recruitment",          default: false },
  add_candidate:          { label: "Add/Edit Candidates",          group: "Recruitment",          default: false },
  delete_candidate:       { label: "Delete Candidates",            group: "Recruitment",          default: false },
  send_candidate_emails:  { label: "Send Emails to Candidates",    group: "Recruitment",          default: false },
  view_notifications:     { label: "View Notifications",           group: "Communications",       default: true },
  view_email_logs:        { label: "View Email Logs",              group: "Communications",       default: false },
  view_drafts:            { label: "View Email Drafts",            group: "Communications",       default: false },
  manage_drafts:          { label: "Manage Email Drafts",          group: "Communications",       default: false },
  manage_reminders:       { label: "Manage Reminders",             group: "Communications",       default: false },
  view_departments:       { label: "View Departments/Roles",       group: "System Masters",       default: false },
  manage_departments:     { label: "Manage Departments/Roles",     group: "System Masters",       default: false },
  settings_company:       { label: "Company Settings",             group: "Settings",             default: false },
  settings_smtp:          { label: "SMTP Settings",                group: "Settings",             default: false },
  settings_interviews:    { label: "Interview Settings",           group: "Settings",             default: false },
  settings_templates:     { label: "Email Templates",              group: "Settings",             default: false },
  settings_attendance:    { label: "Attendance Settings",          group: "Settings",             default: false },
  settings_notifications: { label: "Notification Settings",        group: "Settings",             default: false },
  settings_communication: { label: "Communication Settings",       group: "Settings",             default: false },
  view_payroll:           { label: "View Payroll Section",        group: "Payroll",              default: false },
  manage_salary_structures:{ label: "Manage Salary Structures",   group: "Payroll",              default: false },
  generate_payslips:       { label: "Generate Payslips",          group: "Payroll",              default: false },
  delete_payslips:         { label: "Delete Payslips",            group: "Payroll",              default: false },
};

export const PERMISSION_GROUPS = [
  "Dashboard", "Employee Management", "Leave Management", "Attendance",
  "Recruitment", "Communications", "Payroll", "System Masters", "Settings", "System",
];

export function getDefaultPermissions(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(ALL_PERMISSIONS)) {
    result[k] = v.default;
  }
  return result;
}

export function hasPermission(userPermissions: Record<string, boolean> | undefined, perm: string): boolean {
  if (!userPermissions) return false;
  return userPermissions[perm] === true;
}
