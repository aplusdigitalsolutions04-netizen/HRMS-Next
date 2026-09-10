// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import dynamic from 'next/dynamic';

const SettingsSidebar = dynamic(() => import('@/app-pages/settings/SettingsSidebar'), { ssr: false });

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export default function Navigation({ collapsed, onToggleCollapse, pathname }) {
  const isAdminOrHr = ['ADMIN', 'HR'].includes(localStorage.getItem('role'));
  const rawPerms = (() => { try { return JSON.parse(localStorage.getItem('permissions') || '{}'); } catch { return {}; } })();
  const hasPerm = (p) => isAdminOrHr || rawPerms[p] === true;
  const isSettingsPage = pathname.startsWith('/settings') || pathname.includes('/permissions');

  const [openMenus, setOpenMenus] = useState({});
  const [companySettings, setCompanySettings] = useState(null);

  useEffect(() => {
    fetch(`${API}/settings/company`, { headers: auth() })
      .then(r => r.json())
      .then(d => { if (d && d.company_name !== undefined) setCompanySettings(d); })
      .catch(() => {});
  }, []);

  const toggleMenu = (menu) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const navLink = (to, icon, label, perm = null, isSubmenu = false) => {
    if (perm && !hasPerm(perm)) return null;
    const active = pathname === to || (to !== '/' && pathname.startsWith(to));
    return (
      <Link to={to} className={`nav-link ${active ? 'active' : ''} ${isSubmenu ? 'submenu-link' : ''}`}>
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
                <img src={companySettings.company_logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="url(#brand-grad)"/>
                  <path d="M8 20V12l8-4 8 4v8l-8 4-8-4z" fill="rgba(255,255,255,.2)"/>
                  <circle cx="16" cy="16" r="4" fill="#fff"/>
                  <defs><linearGradient id="brand-grad" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
                </svg>
              )}
            </div>
            {!collapsed && (
              <div className="brand-text">
                <span className="brand-name">HRMS</span>
              </div>
            )}
            <button className="collapse-btn" onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} style={{ position: collapsed ? 'static' : 'absolute', right: collapsed ? 'auto' : '10px', top: collapsed ? 'auto' : '10px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points={collapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
              </svg>
            </button>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section-title">Main</div>
            {navLink('/dashboard',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
              'Dashboard', 'view_dashboard')}

            <div className="nav-section-title" style={{ marginTop: '8px' }}>Modules</div>

            {navDropdown('recruitment', 'Recruitment',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
              <>
                {navLink('/candidates/data', null, 'Candidate Pool', 'view_candidates', true)}
              </>,
              ['view_candidates']
            )}

            {navDropdown('organization', 'Organization',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20 M12 2v6 M12 8h6 M12 8H6 M6 8v6 M18 8v6 M4 14h4 M16 14h4 M8 14v4 M20 14v4"/></svg>',
              <>
                {navLink('/org-chart', null, 'Org Chart', 'view_employees', true)}
                {navLink('/reporting-structure', null, 'Reporting Structure', 'view_employees', true)}
              </>,
              ['view_employees']
            )}

            {navDropdown('employees', 'Employee Management',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
              <>
                {navLink('/employees/manage', null, 'Manage Employees', 'view_employees', true)}
                {navLink('/employees/pending', null, 'Pending Approvals', 'approve_employee', true)}
                {navLink('/document-approvals', null, 'Document Approvals', 'approve_documents', true)}
                {navLink('/leave/manage', null, 'Leave Management', 'view_leave', true)}
                {navLink('/wfh/manage', null, 'WFH Management', 'view_wfh', true)}
              </>,
              ['view_employees', 'approve_employee', 'approve_documents', 'view_leave', 'view_wfh']
            )}

            {navDropdown('attendance', 'Attendance',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
              <>
                {navLink('/attendance/upload', null, 'Upload Attendance', 'upload_attendance', true)}
                {navLink('/attendance/result', null, 'Attendance Summary', 'view_attendance', true)}
                {navLink('/attendance/daily', null, 'Daily Records', 'view_attendance', true)}
                {navLink('/attendance/templates', null, 'Templates', 'upload_attendance', true)}
              </>,
              ['upload_attendance', 'view_attendance']
            )}

            {navDropdown('payroll', 'Payroll',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
              <>
                {navLink('/payroll/salary-structures', null, 'Salary Structures', 'manage_salary_structures', true)}
                {navLink('/payroll/generate', null, 'Generate Payslips', 'generate_payslips', true)}
                {navLink('/payroll/history', null, 'Payslip History', 'view_payroll', true)}
              </>,
              ['manage_salary_structures', 'generate_payslips', 'view_payroll']
            )}

            {navDropdown('communications', 'Communications',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
              <>
                {navLink('/email-log', null, 'Email Log', 'view_email_logs', true)}
                {navLink('/drafts', null, 'Draft Emails', 'view_drafts', true)}
                {navLink('/employee-credentials', null, 'Employee Credentials', 'approve_employee', true)}
              </>,
              ['view_email_logs', 'view_drafts', 'approve_employee']
            )}

            {navDropdown('system-masters', 'System Masters',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
              <>
                {navLink('/masters/departments', null, 'Departments', 'view_departments', true)}
                {navLink('/masters/designations', null, 'Designations', 'view_departments', true)}
              </>,
              ['view_departments']
            )}
          </nav>
        </aside>
      )}
    </>
  );
}
