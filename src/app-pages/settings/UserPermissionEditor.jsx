import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const PERMISSION_GROUPS = {
  'Dashboard': ['view_dashboard'],
  'Employee Management': ['view_employees', 'view_employee_details', 'add_employee', 'edit_employee', 'delete_employee', 'approve_employee', 'approve_documents'],
  'Leave Management': ['view_leave', 'approve_leave', 'view_wfh', 'approve_wfh'],
  'Attendance': ['view_attendance', 'upload_attendance', 'verify_attendance'],
  'Recruitment': ['view_candidates', 'add_candidate', 'delete_candidate', 'send_candidate_emails'],
  'Communications': ['view_email_logs', 'view_drafts', 'manage_drafts', 'manage_reminders'],
  'System Masters': ['view_departments', 'manage_departments'],
  'Payroll': ['view_payroll', 'manage_salary_structures', 'generate_payslips', 'delete_payslips'],
  'Settings': ['settings_company', 'settings_smtp', 'settings_interviews', 'settings_templates', 'settings_attendance', 'settings_notifications', 'settings_communication'],
};

const PERMISSION_LABELS = {
  view_dashboard: 'View Dashboard',
  view_employees: 'View Employee List',
  view_employee_details: 'View Employee Details',
  add_employee: 'Add Employees',
  edit_employee: 'Edit Employees',
  delete_employee: 'Delete Employees',
  approve_employee: 'Approve Pending Employees',
  approve_documents: 'Approve Employee Documents',
  view_leave: 'View Leave Requests',
  approve_leave: 'Approve/Reject Leave',
  view_wfh: 'View WFH Requests',
  approve_wfh: 'Approve/Reject WFH',
  view_attendance: 'View Attendance Reports',
  upload_attendance: 'Upload Attendance',
  verify_attendance: 'Verify Attendance',
  view_candidates: 'View Candidate Pool',
  add_candidate: 'Add/Edit Candidates',
  delete_candidate: 'Delete Candidates',
  send_candidate_emails: 'Send Emails to Candidates',
  view_email_logs: 'View Email Logs',
  view_drafts: 'View Email Drafts',
  manage_drafts: 'Manage Email Drafts',
  manage_reminders: 'Manage Reminders',
  view_departments: 'View Departments/Roles',
  manage_departments: 'Manage Departments/Roles',
  settings_company: 'Company Settings',
  settings_smtp: 'SMTP Settings',
  settings_interviews: 'Interview Settings',
  settings_templates: 'Email Templates',
  settings_attendance: 'Attendance Settings',
  settings_notifications: 'Notification Settings',
  settings_communication: 'Communication Settings',
  view_payroll: 'View Payroll Section',
  manage_salary_structures: 'Manage Salary Structures',
  generate_payslips: 'Generate Payslips',
  delete_payslips: 'Delete Payslips',
};

export default function UserPermissionEditor() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/settings/users/${userId}/permissions`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        setUser(d);
        setPermissions(d.permissions || {});
      })
      .catch(() => Swal.fire({ icon: 'error', title: 'Failed to load user permissions' }))
      .finally(() => setLoading(false));
  }, [userId]);

  const toggle = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllInGroup = (groupKeys) => {
    setPermissions(prev => {
      const next = { ...prev };
      groupKeys.forEach(k => { next[k] = true; });
      return next;
    });
  };

  const deselectAllInGroup = (groupKeys) => {
    setPermissions(prev => {
      const next = { ...prev };
      groupKeys.forEach(k => { next[k] = false; });
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/users/${userId}/permissions`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      Swal.fire({ icon: 'success', title: 'Permissions saved!', timer: 1500, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', animation: 'spin .7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%', padding: '28px 0' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .perm-toggle { position:relative; display:inline-block; width:40px; height:22px; flex-shrink:0; }
        .perm-toggle input { opacity:0; width:0; height:0; }
        .perm-slider { position:absolute; cursor:pointer; inset:0; background:#cbd5e1; border-radius:22px; transition:.2s; }
        .perm-slider:before { content:''; position:absolute; height:16px; width:16px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.2s; }
        .perm-toggle input:checked + .perm-slider { background:#6366f1; }
        .perm-toggle input:checked + .perm-slider:before { transform:translateX(18px); }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/settings/users')} style={{ background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#64748b', fontSize: '.85rem', fontWeight: 600 }}>
          &larr; Back
        </button>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', color: '#1e293b' }}>Permission Editor</h2>
          {user && (
            <p style={{ margin: '4px 0 0', fontSize: '.85rem', color: '#64748b' }}>
              {user.name} &lt;{user.email}&gt; &mdash; <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 50, fontWeight: 600, fontSize: '.75rem' }}>HR Staff</span>
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(PERMISSION_GROUPS).map(([group, keys]) => (
          <div key={group} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '.95rem', fontWeight: 700, color: '#1e293b' }}>{group}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => selectAllInGroup(keys)} style={{ padding: '4px 12px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '.72rem', fontWeight: 600, color: '#6366f1', cursor: 'pointer' }}>Select All</button>
                <button onClick={() => deselectAllInGroup(keys)} style={{ padding: '4px 12px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '.72rem', fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}>Deselect</button>
              </div>
            </div>
            <div style={{ padding: '8px 20px' }}>
              {keys.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 500, color: '#334155' }}>{PERMISSION_LABELS[key] || key}</span>
                  <label className="perm-toggle">
                    <input type="checkbox" checked={!!permissions[key]} onChange={() => toggle(key)} />
                    <span className="perm-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 28 }}>
        <button onClick={() => navigate('/settings/users')} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '.88rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: '.88rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>
    </div>
  );
}
