import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { empDashboardStyles } from './employee-dashboard/styles';
import EmpIcon from './employee-dashboard/EmpIcon';

const EmployeeAttendance = lazy(() => import('./EmployeeAttendance'));
const EmployeeLeave = lazy(() => import('./EmployeeLeave'));
const WFH = lazy(() => import('./WFH'));
const NotificationsPage = lazy(() => import('../communication/NotificationsPage'));
const MyPayslips = lazy(() => import('../payroll/MyPayslips'));
const DashboardHome = lazy(() => import('./employee-dashboard/DashboardHome'));
const DocumentsPanel = lazy(() => import('./employee-dashboard/DocumentsPanel'));
const ChangePasswordTab = lazy(() => import('./employee-dashboard/ChangePasswordTab'));
const ProfileTab = lazy(() => import('./employee-dashboard/ProfileTab'));
const ContactHRTab = lazy(() => import('./employee-dashboard/ContactHRTab'));

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const menuItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'attendance', label: 'Attendance', icon: 'calendar' },
  { key: 'payslips', label: 'My Payslips', icon: 'dollar' },
  { key: 'documents', label: 'Documents', icon: 'file' },
  { key: 'leave', label: 'Leave Requests', icon: 'briefcase' },
  { key: 'wfh', label: 'Work From Home', icon: 'monitor' },
  { key: 'contact-hr', label: 'Contact HR', icon: 'mail' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
];

const TabFallback = () => <div className="p-4 text-center">Loading...</div>;

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const role = sessionStorage.getItem('role');
  const pathname = window.location.pathname;
  const initialMenu = pathname === '/profile' ? 'profile' : pathname === '/change-password' ? 'changePassword' : pathname === '/my-payslips' ? 'payslips' : pathname === '/my-attendance' ? 'attendance' : pathname === '/notifications' ? 'notifications' : pathname.startsWith('/employee-leave') ? 'leave' : pathname.startsWith('/wfh') ? 'wfh' : 'dashboard';
  const [activeMenu, setActiveMenu] = useState(initialMenu);
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [attSummary, setAttSummary] = useState(null);
  const [monthlyAtt, setMonthlyAtt] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState(false);
  const [companySettings, setCompanySettings] = useState(null);

  const handleUploadDoc = async (docKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingDoc(docKey);
    setUploadMsg('');
    setUploadError(false);
    const fd = new FormData();
    fd.append('document_type', docKey);
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/my-documents/upload`, { method: 'POST', headers: auth(), body: fd });
      const data = await res.json();
      if (!res.ok) { throw new Error(data.detail || 'Upload failed'); }
      setUploadMsg(data.message || 'Document submitted for HR approval');
      setUploadError(false);
      const h = auth();
      fetch(`${API}/my-documents`, { headers: h }).then(r => r.json()).then(d => setDocuments(d?.documents || [])).catch(() => {});
    } catch (err) {
      setUploadMsg(err.message);
      setUploadError(true);
    } finally {
      setUploadingDoc(null);
    }
  };
  const handleMultiUploadDoc = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';
    setUploadingDoc('Additional');
    setUploadMsg('');
    setUploadError(false);

    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('document_type', 'Additional');
        fd.append('file', file);
        const res = await fetch(`${API}/my-documents/upload`, { method: 'POST', headers: auth(), body: fd });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || 'Upload failed');
        }
      }
      setUploadMsg(`${files.length} document(s) submitted for HR approval`);
      setUploadError(false);
      const h = auth();
      fetch(`${API}/my-documents`, { headers: h }).then(r => r.json()).then(d => setDocuments(d?.documents || [])).catch(() => {});
    } catch (err) {
      setUploadMsg(err.message);
      setUploadError(true);
    } finally {
      setUploadingDoc(null);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    const mcp = sessionStorage.getItem('must_change_password');
    if (mcp === 'true') { navigate('/force-change-password', { replace: true }); return; }
    const role = sessionStorage.getItem('role');
    if (role !== 'USER') { navigate('/'); return; }

    const h = auth();
    Promise.all([
      fetch(`${API}/profile`, { headers: h }).then(r => r.json()).catch(() => null),
      fetch(`${API}/my-notifications?page=1&per_page=10`, { headers: h }).then(r => r.json()).catch(() => ({ notifications: [] })),
      fetch(`${API}/my-notifications/unread-count`, { headers: h }).then(r => r.json()).catch(() => ({ unread_count: 0 })),
      fetch(`${API}/my-attendance/summary`, { headers: h }).then(r => r.json()).catch(() => null),
      fetch(`${API}/my-attendance/monthly`, { headers: h }).then(r => r.json()).catch(() => ({ months: [] })),
      fetch(`${API}/my-documents`, { headers: h }).then(r => r.json()).catch(() => ({ documents: [] })),
      fetch(`${API}/settings/company`, { headers: h }).then(r => r.json()).catch(() => ({})),
    ]).then(([prof, notifs, unread, attSumm, monthly, docs, comp]) => {
      if (prof) setProfile(prof);
      setNotifications(notifs.notifications || []);
      setUnreadCount(unread.unread_count || 0);
      setAttSummary(attSumm);
      setMonthlyAtt(monthly?.months || []);
      setDocuments(docs?.documents || []);
      if (comp && comp.company_name !== undefined) setCompanySettings(comp);
      setLoading(false);
    });

    const iv = setInterval(() => {
      fetch(`${API}/my-notifications/unread-count`, { headers: auth() })
        .then(r => r.json()).then(d => setUnreadCount(d.unread_count || 0)).catch(() => {});
      fetch(`${API}/my-notifications?page=1&per_page=10`, { headers: auth() })
        .then(r => r.json()).then(d => setNotifications(d.notifications || [])).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const handle = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('must_change_password');
    sessionStorage.removeItem('permissions');
    navigate('/login');
  };

  const markRead = (id) => {
    fetch(`${API}/my-notifications/${id}/read`, { method: 'PUT', headers: auth() })
      .then(() => {
        fetch(`${API}/my-notifications?page=1&per_page=10`, { headers: auth() })
          .then(r => r.json()).then(d => setNotifications(d.notifications || []));
        fetch(`${API}/my-notifications/unread-count`, { headers: auth() })
          .then(r => r.json()).then(d => setUnreadCount(d.unread_count || 0));
      });
  };

  const markAllRead = () => {
    fetch(`${API}/my-notifications/read-all`, { method: 'PUT', headers: auth() })
      .then(() => {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      });
  };

  const initial = profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U';
  const empName = profile?.full_name || profile?.email?.split('@')[0];
  const empCode = profile?.emp_code || 'EMP-0000';
  const designation = profile?.designation || 'Employee';
  const hrs = new Date().getHours();
  const greeting = hrs < 12 ? 'Good Morning' : hrs < 17 ? 'Good Afternoon' : 'Good Evening';

  const [attMonthIdx, setAttMonthIdx] = useState(monthlyAtt.length > 0 ? monthlyAtt.length - 1 : 0);
  const currentMonth = monthlyAtt[attMonthIdx] || { present: 0, absent: 0, leave: 0, month: new Date().getMonth() + 1, year: new Date().getFullYear() };
  const presentDays = Number(currentMonth.present);
  const absentDays = Number(currentMonth.absent);
  const leaveDays = Number(currentMonth.leave);
  const totalAttDays = (presentDays + absentDays + leaveDays) || 1;
  const hasAttData = monthlyAtt.some(m => Number(m.present) > 0 || Number(m.absent) > 0 || Number(m.leave) > 0);
  const docCount = documents.length;
  const maxAtt = Math.max(presentDays, absentDays, leaveDays, 1);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
      <style>{empDashboardStyles}</style>

      {/* Sidebar */}
      <aside className="emp-sidebar">
        <div className="sidebar-brand" style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '10px' }}>
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
          <div className="brand-text">
            <span className="brand-name">HRMS</span>
            <span className="brand-sub">Employee Portal</span>
          </div>
        </div>
        <nav className="emp-sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.key}
              className={`emp-sidebar-item${activeMenu === item.key ? ' active' : ''}`}
              onClick={() => {
                setActiveMenu(item.key);
                if (item.key === 'profile') navigate('/profile');
                else if (item.key === 'settings') navigate('/settings/company');
              }}
            >
              <EmpIcon name={item.icon} size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="emp-main">
        {/* Header */}
        <header className="emp-header">
          <div className="emp-header-left"></div>
          <div className="emp-header-right">
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button className="emp-header-btn" onClick={() => setNotifOpen(!notifOpen)} title="Notifications">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && <span className="emp-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="emp-dropdown" style={{ width: 320, right: 0, left: 'auto' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Notifications {unreadCount > 0 && `(${unreadCount})`}</span>
                    {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Mark All Read</button>}
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} style={{ padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s', borderBottom: '1px solid #f8fafc', background: n.is_read ? 'transparent' : '#fafaff' }}
                          onClick={() => { if (!n.is_read) markRead(n.id); }}
                        >
                          <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: '#0f172a', marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                    <button onClick={() => { setNotifOpen(false); setActiveMenu('notifications'); }} style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>View All Notifications</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }} ref={profileRef}>
              <div className="emp-header-profile" onClick={() => setProfileOpen(!profileOpen)}>
                <div className="emp-avatar">{initial}</div>
                <div className="emp-header-profile-info">
                  <div>{empName}</div>
                  <div>{empCode}</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {profileOpen && (
                <div className="emp-dropdown" style={{ right: 0 }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="emp-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>{initial}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{empName}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{designation}</div>
                    </div>
                  </div>
                  <button className="emp-dropdown-item" onClick={() => { setProfileOpen(false); setActiveMenu('profile'); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    My Profile
                  </button>
                  <button className="emp-dropdown-item" onClick={() => { setProfileOpen(false); setActiveMenu('changePassword'); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Change Password
                  </button>
                  <button className="emp-dropdown-item logout" onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="emp-content">
          <Suspense fallback={<TabFallback />}>
            {activeMenu === 'dashboard' && (
              <DashboardHome
                greeting={greeting}
                empName={empName}
                presentDays={presentDays}
                absentDays={absentDays}
                totalAttDays={totalAttDays}
                leaveDays={leaveDays}
                docCount={docCount}
                notificationsCount={notifications.length}
                monthlyAtt={monthlyAtt}
                attMonthIdx={attMonthIdx}
                setAttMonthIdx={setAttMonthIdx}
                hasAttData={hasAttData}
                maxAtt={maxAtt}
              />
            )}

            {activeMenu === 'attendance' && <EmployeeAttendance />}

            {activeMenu === 'documents' && (
              <DocumentsPanel
                documents={documents}
                uploadingDoc={uploadingDoc}
                handleUploadDoc={handleUploadDoc}
                handleMultiUploadDoc={handleMultiUploadDoc}
                uploadMsg={uploadMsg}
                uploadError={uploadError}
              />
            )}

            {activeMenu === 'contact-hr' && <ContactHRTab />}

            {activeMenu === 'leave' && <EmployeeLeave />}

            {activeMenu === 'wfh' && <WFH />}

            {activeMenu === 'notifications' && <NotificationsPage />}

            {activeMenu === 'payslips' && <MyPayslips />}

            {activeMenu === 'changePassword' && <ChangePasswordTab />}

            {activeMenu === 'profile' && (
              <ProfileTab profile={profile} setProfile={setProfile} role={role} />
            )}
          </Suspense>
        </div>

        {/* Footer */}
        <footer className="emp-footer">
          <span>&copy; 2026 HRMS. All rights reserved.</span>
          <span>v1.0.0</span>
        </footer>
      </div>
    </div>
  );
}
