import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

// Settings are grouped by topic. A group with several pages opens as a submenu; a group
// with a single page is shown as a plain link.
const GROUPS = [
  {
    label: 'My Account', icon: svgBell(),
    items: [
      { key: 'view-notifications', label: 'Notifications', icon: svgBell(), perm: null },
    ],
  },
  {
    label: 'General', icon: svgBuilding(),
    items: [
      { key: 'company', label: 'Company Settings', icon: svgBuilding(), perm: 'settings_company' },
      { key: 'smtp', label: 'SMTP Settings', icon: svgMail(), perm: 'settings_smtp' },
      { key: 'google-drive', label: 'Google Drive', icon: svgDrive(), perm: null },
    ],
  },
  {
    label: 'Recruitment', icon: svgUsers(),
    items: [
      { key: 'interviews', label: 'Interview Settings', icon: svgClock(), perm: null },
      { key: 'templates', label: 'Email Templates', icon: svgMail(), perm: 'settings_templates' },
    ],
  },
  {
    label: 'Attendance & Leave', icon: svgClock(),
    items: [
      { key: 'attendance', label: 'Attendance Settings', icon: svgChart(), perm: null },
      { key: 'holidays', label: 'Holiday Calendar', icon: svgClock(), perm: null },
      { key: 'statuses', label: 'Status Master', icon: svgChart(), perm: null },
    ],
  },
  {
    label: 'Payroll', icon: svgBuilding(),
    items: [
      { key: 'payslip', label: 'Payslip Settings', icon: svgBuilding(), perm: 'manage_salary_structures' },
    ],
  },
  {
    label: 'Users & Access', icon: svgUsers(),
    items: [
      { key: 'users', label: 'User Management', icon: svgUsers(), perm: null },
      { key: 'roles', label: 'Roles & Permissions', icon: svgUsers(), perm: 'manage_departments' },
    ],
  },
  {
    label: 'Communication', icon: svgMessage(),
    items: [
      { key: 'notifications', label: 'Notification Settings', icon: svgBell(), perm: null },
      { key: 'communication', label: 'Communication Settings', icon: svgMessage(), perm: null },
    ],
  },
];

const OPEN_KEY = 'settings_open_groups';
const readOpen = () => { try { return JSON.parse(sessionStorage.getItem(OPEN_KEY) || '[]'); } catch { return []; } };

const sidebarStyles = `
.sg-btn { width:100%; display:flex; align-items:center; gap:12px; padding:10px 12px; border:none; background:transparent; border-radius:10px; cursor:pointer; color:#475569; font:inherit; font-size:.9rem; font-weight:600; text-align:left; transition:background .15s, color .15s; }
.sg-btn:hover { background:#f1f5f9; color:#1e293b; }
.sg-btn.has-active { color:#4338ca; }
.sg-btn .sg-ic { display:flex; color:#64748b; }
.sg-btn.has-active .sg-ic { color:#6366f1; }
.sg-btn .sg-lb { flex:1; }
.sg-chev { transition:transform .2s ease; color:#94a3b8; flex-shrink:0; }
.sg-chev.open { transform:rotate(90deg); }
.sg-sub { overflow:hidden; max-height:0; transition:max-height .25s ease; margin-left:21px; padding-left:8px; border-left:2px solid #eef2f7; }
.sg-sub.open { max-height:400px; margin-bottom:4px; }
.sg-sub .nav-link { padding:8px 12px; font-size:.84rem; }
.sg-sub .nav-link .nav-icon { display:none; }
.sg-sub .nav-link.active { font-weight:700; }
.sg-count { font-size:.68rem; font-weight:700; background:#eef2ff; color:#6366f1; border-radius:20px; padding:1px 7px; }
`;

export default function SettingsSidebar({ collapsed, onToggleCollapse }) {
  const location = useLocation();
  const role = sessionStorage.getItem('role');
  const rawPerms = JSON.parse(sessionStorage.getItem('permissions') || '{}');
  const isAdminOrHr = role === 'ADMIN' || role === 'HR';
  const hasPerm = (p) => p === null || isAdminOrHr || (p && rawPerms[p] === true);

  const activeSection = location.pathname.includes('/permissions') ? 'users' : location.pathname.split('/settings/')[1] || 'company';

  const [companySettings, setCompanySettings] = useState(null);

  useEffect(() => {
    fetch(`${API}/settings/company`, { headers: auth() })
      .then(r => r.json())
      .then(d => { if (d && d.company_name !== undefined) setCompanySettings(d); })
      .catch(() => {});
  }, []);

  const filteredGroups = GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => hasPerm(item.perm)),
  })).filter(group => group.items.length > 0);

  const [openGroups, setOpenGroups] = useState(readOpen);
  const activeGroup = (filteredGroups.find(g => g.items.some(i => i.key === activeSection)) || {}).label;
  // Opening a page (e.g. from a link elsewhere) opens its submenu too.
  useEffect(() => {
    if (activeGroup) setOpenGroups(prev => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);
  const toggleGroup = (label) => setOpenGroups(prev => {
    const next = prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label];
    try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const linkFor = (item, label) => (
    <Link key={item.key} to={`/settings/${item.key}`} className={`nav-link${activeSection === item.key ? ' active' : ''}`} title={collapsed ? item.label : undefined}>
      <span className="nav-icon">{item.icon}</span>
      {!collapsed && <span className="nav-label">{label || item.label}</span>}
    </Link>
  );

  return (
    <aside className={`app-sidebar settings-sidebar${collapsed ? ' collapsed' : ''}`}>
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

      <nav className="sidebar-nav settings-nav">
        {!collapsed && <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', margin: '4px 0 16px', padding: '0 12px' }}>Settings</h2>}
        <style>{sidebarStyles}</style>
        {collapsed
          ? filteredGroups.flatMap(group => group.items).map(item => linkFor(item))
          : filteredGroups.map(group => {
              // one page in the group: plain link, no submenu
              if (group.items.length === 1) return linkFor(group.items[0]);
              const open = openGroups.includes(group.label);
              const hasActive = group.items.some(i => i.key === activeSection);
              return (
                <div key={group.label}>
                  <button type="button" className={`sg-btn${hasActive ? ' has-active' : ''}`} onClick={() => toggleGroup(group.label)} aria-expanded={open}>
                    <span className="sg-ic">{group.icon}</span>
                    <span className="sg-lb">{group.label}</span>
                    <span className="sg-count">{group.items.length}</span>
                    <svg className={`sg-chev${open ? ' open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                  <div className={`sg-sub${open ? ' open' : ''}`}>
                    {group.items.map(item => linkFor(item))}
                  </div>
                </div>
              );
            })}
      </nav>

      <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid #f1f5f9' }}>
        <Link to="/" className="back-link" title="Back to Dashboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          {!collapsed && <span>Back to Dashboard</span>}
        </Link>
      </div>
    </aside>
  );
}

/* ── SVG icon helpers ── */
function svgBuilding() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/></svg>;
}
function svgMail() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function svgClock() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function svgUsers() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function svgChart() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>;
}
function svgBell() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}
function svgMessage() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function svgDrive() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="18" rx="8" ry="3"/><path d="M4 18V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M8 6v0"/></svg>;
}