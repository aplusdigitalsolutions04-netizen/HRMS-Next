// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import dynamic from 'next/dynamic';
import { motion } from '@/lib/ui-motion';

const SettingsSidebar = dynamic(() => import('@/app-pages/settings/SettingsSidebar'), { ssr: false });

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

export default function Navigation({ collapsed, onToggleCollapse, pathname }) {
  const isAdminOrHr = ['ADMIN', 'HR'].includes(sessionStorage.getItem('role'));
  const rawPerms = (() => { try { return JSON.parse(sessionStorage.getItem('permissions') || '{}'); } catch { return {}; } })();
  const hasPerm = (p) => isAdminOrHr || rawPerms[p] === true;
  const isSettingsPage = pathname.startsWith('/settings') || pathname.includes('/permissions');

  const [openMenus, setOpenMenus] = useState(() => (pathname.startsWith('/letters') ? { letters: true } : {}));
  const [companySettings, setCompanySettings] = useState(null);

  useEffect(() => {
    fetch(`${API}/settings/company`, { headers: auth() })
      .then(r => r.json())
      .then(d => { if (d && d.company_name !== undefined) setCompanySettings(d); })
      .catch(() => {});
  }, []);

  // landing on a Letters page (a link, a search, a refresh) opens its menu
  useEffect(() => { if (pathname.startsWith('/letters')) setOpenMenus({ letters: true }); }, [pathname]);

  const toggleMenu = (menu) => {
    // accordion: opening one menu closes the others
    setOpenMenus(prev => (prev[menu] ? {} : { [menu]: true }));
  };

  const navLink = (to, icon, label, perm = null, isSubmenu = false) => {
    if (perm && !hasPerm(perm)) return null;
    const active = pathname === to || (to !== '/' && pathname.startsWith(to));
    return (
      <Link to={to} className={`nav-link ${active ? 'active' : ''} ${isSubmenu ? 'submenu-link' : ''}`}>
        {active && <motion.span layoutId={isSubmenu ? 'nav-active-sub' : 'nav-active'} className="nav-active-bg" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
        {icon && <span className="nav-icon" dangerouslySetInnerHTML={{ __html: icon }} />}
        <span className="nav-label">{label}</span>
      </Link>
    );
  };

  const navDropdown = (menuKey, label, icon, children, requiredPerms = []) => {
    const canSee = requiredPerms.length === 0 || isAdminOrHr || requiredPerms.some(p => rawPerms[p]);
    if (!canSee) return null;

    const isOpen = openMenus[menuKey];

    return (
      <div className="nav-dropdown-container">
        <button className={`nav-dropdown-btn ${isOpen ? 'open' : ''}`} onClick={() => toggleMenu(menuKey)}>
          <div className="nav-dropdown-left">
            <span className="nav-icon" dangerouslySetInnerHTML={{ __html: icon }} />
            <span className="nav-label">{label}</span>
          </div>
          <svg className="nav-dropdown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div className={`nav-submenu ${isOpen ? 'open' : ''}`}>
          {children}
        </div>
      </div>
    );
  };

  return (
    <>
      {isSettingsPage ? (
        <SettingsSidebar collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      ) : (
        <aside className="app-sidebar">
          <div className="sidebar-brand">
            <div className="brand-logo">
              {companySettings?.company_logo ? (
                <>
                  <img className="logo-light" src={companySettings.company_logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <img className="logo-dark" src="/api/company-logo?dark=1" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </>
              ) : (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="url(#brand-grad)"/>
                  <path d="M8 20V12l8-4 8 4v8l-8 4-8-4z" fill="rgba(255,255,255,.2)"/>
                  <circle cx="16" cy="16" r="4" fill="#fff"/>
                  <defs><linearGradient id="brand-grad" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#6f4e37"/><stop offset="1" stopColor="#8a6a52"/></linearGradient></defs>
                </svg>
              )}
            </div>
            {!collapsed && (
              <div className="brand-text">
                <span className="brand-name">HRMS</span>
              </div>
            )}
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section-title">Main</div>
            {navLink('/dashboard',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
              'Dashboard', 'view_dashboard')}

            <div className="nav-section-title" style={{ marginTop: '8px' }}>People</div>

            {navDropdown('employees', 'Employee Management',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
              <>
                {navLink('/employees/manage', null, 'Manage Employees', 'view_employees', true)}
                {navLink('/employees/pending', null, 'Pending Approvals', 'approve_employee', true)}
                {navLink('/employee-credentials', null, 'Employee Credentials', 'approve_employee', true)}
                {navLink('/directory', null, 'Directory', 'view_employees', true)}
                {navLink('/org-chart', null, 'Org Chart', 'view_employees', true)}
                {navLink('/reporting-structure', null, 'Reporting Structure', 'view_employees', true)}
              </>,
              ['view_employees', 'approve_employee']
            )}

            {navDropdown('recruitment', 'Recruitment',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
              <>
                {navLink('/candidates/data', null, 'Candidate Pool', 'view_candidates', true)}
                {navLink('/candidates/no-response', null, 'No Response', 'view_candidates', true)}
              </>,
              ['view_candidates']
            )}

            <div className="nav-section-title" style={{ marginTop: '8px' }}>Time &amp; Leave</div>

            {navDropdown('attendance', 'Attendance',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
              <>
                {navLink('/attendance/daily', null, 'Daily Records', 'view_attendance', true)}
                {navLink('/attendance/result', null, 'Attendance Summary', 'view_attendance', true)}
                {navLink('/attendance/corrections', null, 'Corrections', 'view_attendance', true)}
                {navLink('/attendance/upload', null, 'Upload Attendance', 'upload_attendance', true)}
                {navLink('/attendance/templates', null, 'Templates', 'upload_attendance', true)}
              </>,
              ['upload_attendance', 'view_attendance']
            )}

            {navDropdown('leave-wfh', 'Leave & WFH',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
              <>
                {navLink('/leave/manage', null, 'Leave Management', 'view_leave', true)}
                {navLink('/wfh/manage', null, 'WFH Management', 'view_wfh', true)}
              </>,
              ['view_leave', 'view_wfh']
            )}

            <div className="nav-section-title" style={{ marginTop: '8px' }}>Payroll</div>

            {navDropdown('payroll', 'Payroll',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
              <>
                {navLink('/payroll/salary-structures', null, 'Salary Structures', 'manage_salary_structures', true)}
                {navLink('/payroll/salary-sheet', null, 'Salary Sheet', 'view_payroll', true)}
                {navLink('/payroll/statutory', null, 'Statutory Deductions', 'view_payroll', true)}
                {navLink('/payroll/revisions', null, 'Salary Revisions', 'view_payroll', true)}
                {navLink('/payroll/generate', null, 'Generate Payslips', 'generate_payslips', true)}
                {navLink('/payroll/history', null, 'Payslip History', 'view_payroll', true)}
              </>,
              ['manage_salary_structures', 'generate_payslips', 'view_payroll']
            )}

            <div className="nav-section-title" style={{ marginTop: '8px' }}>Employee Services</div>

            {navDropdown('documents', 'Documents',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
              <>
                {navLink('/document-approvals', null, 'Document Approvals', 'approve_documents', true)}
                {navLink('/documents/expiry', null, 'Document Expiry', 'view_employees', true)}
              </>,
              ['approve_documents', 'view_employees']
            )}

            {navDropdown('letters', 'Letters',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
              <>
                {navLink('/letters/make', null, 'Make a Letter', 'view_employees', true)}
                {navLink('/letters/made', null, 'Letters Made', 'view_employees', true)}
                {navLink('/letters/texts', null, 'Letter Texts', 'view_employees', true)}
                {navLink('/letters/words', null, 'Letter Words', 'view_employees', true)}
                {navLink('/letters/letterhead', null, 'Letterhead', 'view_employees', true)}
              </>,
              ['view_employees']
            )}

            {navLink('/helpdesk/manage',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
              'Help Desk', 'view_employees')}

            {navLink('/exits',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
              'Exit & Full and Final', 'view_employees')}

            {navLink('/assets',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="12" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/><line x1="8" y1="16" x2="8" y2="20"/><line x1="16" y1="16" x2="16" y2="20"/></svg>',
              'Assets', 'view_assets')}

            <div className="nav-section-title" style={{ marginTop: '8px' }}>Insights &amp; Communication</div>

            {navLink('/reports',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
              'Reports', 'view_reports')}

            {navDropdown('communications', 'Communications',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
              <>
                {navLink('/email-log', null, 'Email Log', 'view_email_logs', true)}
                {navLink('/drafts', null, 'Draft Emails', 'view_drafts', true)}
                {navLink('/announcements', null, 'Announcements', 'manage_announcements', true)}
              </>,
              ['view_email_logs', 'view_drafts', 'manage_announcements']
            )}

            {navLink('/mail',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
              'My Mail', null)}

            <div className="nav-section-title" style={{ marginTop: '8px' }}>Admin</div>

            {navDropdown('system-masters', 'Masters',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
              <>
                {navLink('/masters/departments', null, 'Departments', 'view_departments', true)}
                {navLink('/masters/designations', null, 'Designations', 'view_departments', true)}
                {navLink('/masters/asset-types', null, 'Asset Types', 'view_assets', true)}
                {navLink('/masters/leave-types', null, 'Leave Types', 'view_leave', true)}
                {navLink('/masters/template-categories', null, 'Template Categories', 'settings_templates', true)}
                {navLink('/masters/request-types', null, 'Request Types', 'settings_templates', true)}
              </>,
              ['view_departments', 'view_assets', 'view_leave', 'settings_templates']
            )}

            {(hasPerm('view_audit_log') || sessionStorage.getItem('role') === 'ADMIN') && navDropdown('system-tools', 'Administration',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
              <>
                {navLink('/audit-log', null, 'Audit Log', 'view_audit_log', true)}
                {sessionStorage.getItem('role') === 'ADMIN' && navLink('/backup', null, 'Backup & Export', null, true)}
                {sessionStorage.getItem('role') === 'ADMIN' && navLink('/api-logs', null, 'API Logs', null, true)}
              </>,
              ['view_audit_log']
            )}

            <div className="nav-section-title" style={{ marginTop: '8px' }}>Help</div>
            {navLink('/guide',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
              'Guide', null)}
          </nav>
        </aside>
      )}
    </>
  );
}
