// @ts-nocheck
'use client';

import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Page components using Next.js dynamic imports
import dynamic from 'next/dynamic';

import { ADMIN_HR, ADMIN_HR_STAFF, ADMIN_ONLY } from './layout-parts/routeConfig';
import PrivateRoute from './layout-parts/PrivateRoute';
import NotificationDropdown from './layout-parts/NotificationDropdown';
import ProfileDropdown from './layout-parts/ProfileDropdown';
import Navigation from './layout-parts/Navigation';
import GlobalSearch from './layout-parts/GlobalSearch';
import { MotionProvider, PageTransition } from '@/lib/ui-motion';
import { LanguageProvider } from '@/lib/i18n';
import InstallApp from './layout-parts/InstallApp';

const Dashboard = dynamic(() => import('@/app-pages/dashboard/Dashboard'), { ssr: false });
const Departments = dynamic(() => import('@/app-pages/department/Departments'), { ssr: false });
const Employees = dynamic(() => import('@/app-pages/employee/Employees'), { ssr: false });
const HRLogin = dynamic(() => import('@/app-pages/auth/HRLogin'), { ssr: false });
const EmployeeRegister = dynamic(() => import('@/app-pages/auth/EmployeeRegister'), { ssr: false });
const InviteEmployee = dynamic(() => import('@/app-pages/employee/InviteEmployee'), { ssr: false });
const PrivacyPolicy = dynamic(() => import('@/app-pages/legal/PrivacyPolicy'), { ssr: false });
const TermsConditions = dynamic(() => import('@/app-pages/legal/TermsConditions'), { ssr: false });
const AttendanceUpload = dynamic(() => import('@/app-pages/attendance/AttendanceUpload'), { ssr: false });
const AttendanceResult = dynamic(() => import('@/app-pages/attendance/AttendanceResult'), { ssr: false });
const DailyAttendance = dynamic(() => import('@/app-pages/attendance/DailyAttendance'), { ssr: false });
const UpdateAttendance = dynamic(() => import('@/app-pages/attendance/UpdateAttendance'), { ssr: false });
const PendingEmployees = dynamic(() => import('@/app-pages/employee/PendingEmployees'), { ssr: false });
const EmployeeDetail = dynamic(() => import('@/app-pages/employee/EmployeeDetail'), { ssr: false });
const EditEmployee = dynamic(() => import('@/app-pages/employee/EditEmployee'), { ssr: false });
const EmployeeManagement = dynamic(() => import('@/app-pages/employee/EmployeeManagement'), { ssr: false });
const ManageDepartments = dynamic(() => import('@/app-pages/department/ManageDepartments'), { ssr: false });
const ManageDesignations = dynamic(() => import('@/app-pages/department/ManageDesignations'), { ssr: false });
const AddDepartment = dynamic(() => import('@/app-pages/department/AddDepartment'), { ssr: false });
const EditDepartment = dynamic(() => import('@/app-pages/department/EditDepartment'), { ssr: false });
const AddDesignation = dynamic(() => import('@/app-pages/department/AddDesignation'), { ssr: false });
const CandidateData = dynamic(() => import('@/app-pages/candidate/CandidateData'), { ssr: false });
const CandidateView = dynamic(() => import('@/app-pages/candidate/CandidateView'), { ssr: false });
const NoResponse = dynamic(() => import('@/app-pages/candidate/NoResponse'), { ssr: false });
const CandidatesForm = dynamic(() => import('@/app-pages/candidate/CandidatesForm'), { ssr: false });
const TemplateManagement = dynamic(() => import('@/app-pages/settings/TemplateManagement'), { ssr: false });
const EmailLog = dynamic(() => import('@/app-pages/communication/EmailLog'), { ssr: false });
const TemplateEditor = dynamic(() => import('@/app-pages/settings/TemplateEditor'), { ssr: false });
const SettingsWorkspace = dynamic(() => import('@/app-pages/settings/SettingsWorkspace'), { ssr: false });
const ProfilePage = dynamic(() => import('@/app-pages/auth/ProfilePage'), { ssr: false });
const ChangePassword = dynamic(() => import('@/app-pages/auth/ChangePassword'), { ssr: false });
const NotificationsPage = dynamic(() => import('@/app-pages/communication/NotificationsPage'), { ssr: false });
const DraftManagement = dynamic(() => import('@/app-pages/communication/DraftManagement'), { ssr: false });
const EmployeeCredentials = dynamic(() => import('@/app-pages/employee/EmployeeCredentials'), { ssr: false });
const Preferences = dynamic(() => import('@/app-pages/settings/Preferences'), { ssr: false });
const MyMail = dynamic(() => import('@/app-pages/mail/MyMail'), { ssr: false });
const AuditLog = dynamic(() => import('@/app-pages/system/AuditLog'), { ssr: false });
const Backup = dynamic(() => import('@/app-pages/system/Backup'), { ssr: false });
const AssetTypes = dynamic(() => import('@/app-pages/assets/AssetTypes'), { ssr: false });
const LeaveTypes = dynamic(() => import('@/app-pages/leave/LeaveTypes'), { ssr: false });
const RequestTypes = dynamic(() => import('@/app-pages/settings/RequestTypes'), { ssr: false });
const TemplateCategories = dynamic(() => import('@/app-pages/settings/TemplateCategories'), { ssr: false });
const Assets = dynamic(() => import('@/app-pages/assets/Assets'), { ssr: false });
const Reports = dynamic(() => import('@/app-pages/reports/Reports'), { ssr: false });
const AttendanceCorrections = dynamic(() => import('@/app-pages/attendance/AttendanceCorrections'), { ssr: false });
const AttendanceTemplateManager = dynamic(() => import('@/app-pages/attendance/AttendanceTemplateManager'), { ssr: false });
const Unauthorized = dynamic(() => import('@/app-pages/auth/Unauthorized'), { ssr: false });
const EmployeeDashboard = dynamic(() => import('@/app-pages/employee/EmployeeDashboard'), { ssr: false });
const OnboardingGate = dynamic(() => import('@/app-pages/employee/onboarding/OnboardingGate'), { ssr: false });
const ForceChangePassword = dynamic(() => import('@/app-pages/auth/ForceChangePassword'), { ssr: false });
const AdminLeaveManagement = dynamic(() => import('@/app-pages/leave/AdminLeaveManagement'), { ssr: false });
const AdminWFHManagement = dynamic(() => import('@/app-pages/leave/AdminWFHManagement'), { ssr: false });
const UserPermissionEditor = dynamic(() => import('@/app-pages/settings/UserPermissionEditor'), { ssr: false });
const PayrollSalaryStructures = dynamic(() => import('@/app-pages/payroll/PayrollSalaryStructures'), { ssr: false });
const PayrollSalarySheet = dynamic(() => import('@/app-pages/payroll/PayrollSalarySheet'), { ssr: false });
const PayrollGeneratePayslips = dynamic(() => import('@/app-pages/payroll/PayrollGeneratePayslips'), { ssr: false });
const PayrollPayslipHistory = dynamic(() => import('@/app-pages/payroll/PayrollPayslipHistory'), { ssr: false });
const DocumentApprovals = dynamic(() => import('@/app-pages/employee/DocumentApprovals'), { ssr: false });
const OrgChart = dynamic(() => import('@/app-pages/organization/OrgChart'), { ssr: false });
const ReportingStructure = dynamic(() => import('@/app-pages/organization/ReportingStructure'), { ssr: false });
function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [employeeStatus, setEmployeeStatus] = useState(() => sessionStorage.getItem('employee_status') || '');
  const location = useLocation();
  const pathname = location.pathname;
  useEffect(() => { setMobileNav(false); }, [pathname]); // the phone menu closes when you open a page

  const isAuthPage = ['/login', '/register', '/privacy-policy', '/terms-conditions'].includes(pathname);
  const isUserPortal = (() => {
    const role = sessionStorage.getItem('role');
    const userPaths = ['/', '/my-attendance', '/my-payslips', '/profile', '/change-password', '/notifications', '/settings/view-notifications', '/force-change-password'];
    return role === 'USER' && (userPaths.includes(pathname) || pathname.startsWith('/employee-leave') || pathname.startsWith('/wfh'));
  })();
  // An invited/pending/needs_correction employee only ever sees the
  // onboarding gate (complete-profile form or a waiting screen), never the
  // real dashboard or any other route - re-checked after they submit so the
  // screen can swap to "pending" without a full reload.
  const needsOnboarding = isUserPortal && pathname !== '/force-change-password' && employeeStatus && employeeStatus !== 'active';

  return (
    <>
      {isAuthPage ? (
        <Routes>
          <Route path="/login" element={<HRLogin />} />
          <Route path="/register" element={<EmployeeRegister />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-conditions" element={<TermsConditions />} />
        </Routes>
      ) : isUserPortal ? (
        <>
          {pathname === '/force-change-password' ? (
            <ForceChangePassword />
          ) : needsOnboarding ? (
            <OnboardingGate
              status={employeeStatus}
              onSubmitted={() => {
                sessionStorage.setItem('employee_status', 'pending');
                sessionStorage.removeItem('hr_remarks');
                setEmployeeStatus('pending');
              }}
            />
          ) : (
            <EmployeeDashboard />
          )}
        </>
      ) : (
        <div className={`app-layout ${sidebarCollapsed ? 'collapsed' : ''} ${mobileNav ? 'mobile-open' : ''}`}>
          <div className="mobile-backdrop" onClick={() => setMobileNav(false)} />
          <Navigation collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} pathname={pathname} />
          <div className="app-main">
            <header className="app-header">
              <div className="header-left">
                <button type="button" className="mobile-menu-btn" aria-label="Menu" onClick={() => setMobileNav(o => !o)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <GlobalSearch />
                <span style={{ fontSize: '1.35rem', fontWeight: 700, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.5px' }}>HRMS</span>
              </div>
              <div className="header-right">
                <InstallApp />
                <NotificationDropdown />
                <ProfileDropdown />
                <Link to="/settings/company" className="header-icon-btn" title="Settings">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </Link>
              </div>
            </header>
            <main className="app-content">
              <PageTransition pageKey={pathname} className="page-container">
                <Routes>
                  <Route path="/dashboard" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><Dashboard /></PrivateRoute>} />
                  <Route path="/departments" element={<PrivateRoute allowedRoles={ADMIN_HR}><Departments /></PrivateRoute>} />
                  <Route path="/employees" element={<PrivateRoute allowedRoles={ADMIN_HR}><Employees /></PrivateRoute>} />
                  <Route path="/attendance/upload" element={<PrivateRoute allowedRoles={ADMIN_HR}><AttendanceUpload /></PrivateRoute>} />
                  <Route path="/attendance/result" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><AttendanceResult /></PrivateRoute>} />
                  <Route path="/attendance/daily" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><DailyAttendance /></PrivateRoute>} />
                  <Route path="/attendance/update" element={<PrivateRoute allowedRoles={ADMIN_HR}><UpdateAttendance /></PrivateRoute>} />
                  <Route path="/preferences" element={<PrivateRoute allowedRoles={null}><Preferences /></PrivateRoute>} />
                  <Route path="/mail" element={<PrivateRoute allowedRoles={null}><MyMail /></PrivateRoute>} />
                  <Route path="/audit-log" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><AuditLog /></PrivateRoute>} />
                  <Route path="/backup" element={<PrivateRoute allowedRoles={ADMIN_ONLY}><Backup /></PrivateRoute>} />
                  <Route path="/masters/asset-types" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><AssetTypes /></PrivateRoute>} />
                  <Route path="/masters/leave-types" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><LeaveTypes /></PrivateRoute>} />
                  <Route path="/masters/request-types" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><RequestTypes /></PrivateRoute>} />
                  <Route path="/masters/template-categories" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><TemplateCategories /></PrivateRoute>} />
                  <Route path="/assets" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><Assets /></PrivateRoute>} />
                  <Route path="/reports" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><Reports /></PrivateRoute>} />
                  <Route path="/attendance/corrections" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><AttendanceCorrections /></PrivateRoute>} />
                  <Route path="/attendance/templates" element={<PrivateRoute allowedRoles={ADMIN_HR}><AttendanceTemplateManager /></PrivateRoute>} />
                  <Route path="/employees/add" element={<PrivateRoute allowedRoles={ADMIN_HR}><EmployeeRegister /></PrivateRoute>} />
                  <Route path="/employees/invite" element={<PrivateRoute allowedRoles={ADMIN_HR}><InviteEmployee /></PrivateRoute>} />
                  <Route path="/employees/pending" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><PendingEmployees /></PrivateRoute>} />
                  <Route path="/document-approvals" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><DocumentApprovals /></PrivateRoute>} />
                  <Route path="/employees/detail/:id" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><EmployeeDetail /></PrivateRoute>} />
                  <Route path="/employees/edit/:id" element={<PrivateRoute allowedRoles={ADMIN_HR}><EditEmployee /></PrivateRoute>} />
                  <Route path="/employees/manage" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><EmployeeManagement /></PrivateRoute>} />
                  <Route path="/leave/manage" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><AdminLeaveManagement /></PrivateRoute>} />
                  <Route path="/wfh/manage" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><AdminWFHManagement /></PrivateRoute>} />
                  <Route path="/masters/departments" element={<PrivateRoute allowedRoles={ADMIN_HR}><ManageDepartments /></PrivateRoute>} />
                  <Route path="/masters/designations" element={<PrivateRoute allowedRoles={ADMIN_HR}><ManageDesignations /></PrivateRoute>} />
                  <Route path="/masters/departments/add" element={<PrivateRoute allowedRoles={ADMIN_HR}><AddDepartment /></PrivateRoute>} />
                  <Route path="/masters/departments/edit/:id" element={<PrivateRoute allowedRoles={ADMIN_HR}><EditDepartment /></PrivateRoute>} />
                  <Route path="/masters/designations/add" element={<PrivateRoute allowedRoles={ADMIN_HR}><AddDesignation /></PrivateRoute>} />
                  <Route path="/masters/designations/edit/:id" element={<PrivateRoute allowedRoles={ADMIN_HR}><AddDesignation /></PrivateRoute>} />
                    <Route path="/candidates/data" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><CandidateData /></PrivateRoute>} />
                  <Route path="/candidates/view/:id" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><CandidateView /></PrivateRoute>} />
                  <Route path="/candidates/no-response" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><NoResponse /></PrivateRoute>} />
                  <Route path="/candidates/add" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><CandidatesForm /></PrivateRoute>} />
                  <Route path="/settings/template-editor" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><TemplateEditor /></PrivateRoute>} />
                  <Route path="/settings/templates" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><TemplateManagement /></PrivateRoute>} />
                  <Route path="/email-log" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><EmailLog /></PrivateRoute>} />
                  <Route path="/drafts" element={<PrivateRoute allowedRoles={ADMIN_HR}><DraftManagement /></PrivateRoute>} />
                  <Route path="/employee-credentials" element={<PrivateRoute allowedRoles={ADMIN_HR}><EmployeeCredentials /></PrivateRoute>} />
                  <Route path="/org-chart" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><OrgChart /></PrivateRoute>} />
                  <Route path="/reporting-structure" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><ReportingStructure /></PrivateRoute>} />
                  <Route path="/payroll/salary-structures" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><PayrollSalaryStructures /></PrivateRoute>} />
                  <Route path="/payroll/salary-sheet" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><PayrollSalarySheet /></PrivateRoute>} />
                  <Route path="/payroll/generate" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><PayrollGeneratePayslips /></PrivateRoute>} />
                  <Route path="/payroll/history" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><PayrollPayslipHistory /></PrivateRoute>} />
                  <Route path="/settings" element={<Navigate to="/settings/company" replace />} />
                  <Route path="/settings/:section" element={<PrivateRoute allowedRoles={ADMIN_HR_STAFF}><SettingsWorkspace /></PrivateRoute>} />
                  <Route path="/users/:userId/permissions" element={<PrivateRoute allowedRoles={ADMIN_HR}><UserPermissionEditor /></PrivateRoute>} />
                  <Route path="/profile" element={<PrivateRoute allowedRoles={null}><ProfilePage /></PrivateRoute>} />
                  <Route path="/change-password" element={<PrivateRoute allowedRoles={null}><ChangePassword /></PrivateRoute>} />
                  <Route path="/notifications" element={<PrivateRoute allowedRoles={null}><NotificationsPage /></PrivateRoute>} />
                  <Route path="/unauthorized" element={<Unauthorized />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </PageTransition>
            </main>
          </div>
        </div>
      )}
    </>
  );
}

export default function ClientApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <MotionProvider>
    <LanguageProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<HRLogin />} />
        <Route path="/register" element={<EmployeeRegister />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/force-change-password" element={<ForceChangePassword />} />
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </Router>
    </LanguageProvider>
    </MotionProvider>
  );
}
