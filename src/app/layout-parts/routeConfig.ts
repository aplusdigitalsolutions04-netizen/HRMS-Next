export const ADMIN_HR = ['ADMIN', 'HR'];
export const ADMIN_HR_STAFF = ['ADMIN', 'HR', 'HR_STAFF'];

export const ROUTE_ROLES: Record<string, string[]> = {
  '/': ADMIN_HR,
  '/departments': ADMIN_HR,
  '/employees': ADMIN_HR,
  '/attendance/upload': ADMIN_HR,
  '/attendance/result': ADMIN_HR_STAFF,
  '/attendance/update': ADMIN_HR,
  '/attendance/templates': ADMIN_HR,
  '/employees/add': ADMIN_HR,
  '/employees/pending': ADMIN_HR_STAFF,
  '/document-approvals': ADMIN_HR_STAFF,
  '/employees/manage': ADMIN_HR_STAFF,
  '/leave/manage': ADMIN_HR_STAFF,
  '/wfh/manage': ADMIN_HR_STAFF,
  '/masters/departments': ADMIN_HR,
  '/masters/departments/add': ADMIN_HR,
  '/masters/designations/add': ADMIN_HR,
  '/candidates/data': ADMIN_HR_STAFF,
  '/candidates/add': ADMIN_HR_STAFF,
  '/settings/templates': ADMIN_HR_STAFF,
  '/email-log': ADMIN_HR_STAFF,
  '/drafts': ADMIN_HR,
  '/org-chart': ADMIN_HR_STAFF,
  '/reporting-structure': ADMIN_HR_STAFF,
  '/payroll/salary-structures': ADMIN_HR_STAFF,
  '/payroll/generate': ADMIN_HR_STAFF,
  '/payroll/history': ADMIN_HR_STAFF,
};

export function getRouteRole(pathname: string): string[] {
  if (ROUTE_ROLES[pathname]) return ROUTE_ROLES[pathname];
  if (pathname.startsWith('/employees/detail/')) return ADMIN_HR_STAFF;
  if (pathname.startsWith('/employees/edit/')) return ADMIN_HR;
  if (pathname.startsWith('/masters/departments/edit/')) return ADMIN_HR;
  if (pathname.startsWith('/masters/designations/edit/')) return ADMIN_HR;
  if (pathname.startsWith('/candidates/view/')) return ADMIN_HR_STAFF;
  if (pathname.startsWith('/settings/')) return ADMIN_HR_STAFF;
  if (pathname.startsWith('/users/')) return ADMIN_HR;
  return ADMIN_HR;
}
