import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard } from './shared';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [rolesList, setRolesList] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setPage(1); }, [users.length]);
  const pageItems = paginate(users, page, pageSize);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/settings/users`, { headers: auth() }).then(r => r.json()),
      fetch(`${API}/settings/roles`, { headers: auth() }).then(r => r.json()).catch(() => [])
    ]).then(([usersData, rolesData]) => {
      setUsers(Array.isArray(usersData) ? usersData : []);
      setRolesList(Array.isArray(rolesData) ? rolesData : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const createUser = async (data) => {
    const formBody = new URLSearchParams();
    formBody.append('email', data.email);
    formBody.append('password', data.password);
    formBody.append('name', data.name || '');
    formBody.append('is_active', data.is_active !== false ? 'true' : 'false');
    formBody.append('role', data.role || 'ADMIN');
    const res = await fetch(`${API}/settings/users`, { method: 'POST', headers: { ...auth() }, body: formBody });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || 'Failed');
    load();
  };

  const toggleActive = async (id, current) => {
    await fetch(`${API}/settings/users/${id}`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !current }) });
    load();
  };

  const deleteUser = (id, label) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `"${label}" will be permanently deleted`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete'
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const res = await fetch(`${API}/settings/users/${id}`, { method: 'DELETE', headers: auth() });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        Swal.fire('Deleted!', 'User deleted successfully', 'success');
      } else {
        Swal.fire('Error', d.detail || d.message || 'Failed to delete user', 'error');
      }
    });
  };

  const roleBadge = (role) => {
    const styles = {
      ADMIN: { bg: '#e0e7ff', c: '#3730a3', label: 'Admin' },
    };
    const customRole = rolesList.find(r => r.id === role);
    const s = styles[role] || (customRole ? { bg: '#dcfce7', c: '#166534', label: customRole.name } : { bg: '#f1f5f9', c: '#64748b', label: role });
    return <span style={{ background: s.bg, color: s.c, padding: '2px 10px', borderRadius: 50, fontWeight: 600, fontSize: '.72rem', display: 'inline-block' }}>{s.label}</span>;
  };

  return (
    <SettingsCard title="User Management" desc="Manage HR/Admin users">
      {!showModal ? (
        <>
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <button className="btn-premium" onClick={() => { setEditUser(null); setShowModal(true); }}>+ Add User</button>
          </div>
          {loading ? <div className="p-3 text-center">Loading...</div> : (
            <div className="premium-table-wrapper">
              <table className="premium-table">
                <thead><tr><th style={{width:40}}>#</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {pageItems.map((u, idx) => (
                    <tr key={u.id}>
                      <td style={{color:'#64748b', fontSize:'.85rem'}}>{(page - 1) * pageSize + idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{u.name || u.email.split('@')[0]}</td>
                      <td>{u.email}</td>
                      <td>{roleBadge(u.role)}</td>
                      <td><span className={`badge-premium ${u.is_active ? 'badge-success' : 'badge-danger'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                      <td>
                        <span style={{ fontSize: '.78rem', color: '#94a3b8', marginRight: 8 }}>🔑 Managed in Roles</span>
                        {u.role === 'ADMIN' ? (
                          <span style={{ fontSize: '.78rem', color: '#94a3b8' }}>🛡️ Protected</span>
                        ) : (
                          <>
                            <button className="tbl-action tbl-view" onClick={() => toggleActive(u.id, u.is_active)}>{u.is_active ? '🔴 Disable' : '🟢 Enable'}</button>
                            <button className="tbl-action tbl-view" style={{ marginLeft: 8, color: '#dc2626' }} onClick={() => deleteUser(u.id, u.name || u.email)}>🗑️ Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted">No users found</td></tr>}
                </tbody>
              </table>
              <Pagination page={page} totalItems={users.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="users" />
            </div>
          )}
        </>
      ) : (
        <UserForm onClose={() => setShowModal(false)} onSave={createUser} edit={editUser} rolesList={rolesList} />
      )}
    </SettingsCard>
  );
}

function UserForm({ onClose, onSave, edit, rolesList }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', is_active: true, role: 'ADMIN' });
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || (!edit && !form.password)) { Swal.fire({ icon: 'warning', title: 'Validation', text: 'Email and password are required.' }); return; }
    setSubmitting(true);
    try { await onSave(form); onClose(); Swal.fire({ icon: 'success', title: 'User Created!', timer: 1500, showConfirmButton: false }); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="uf-container">
      <div className="uf-header">
        <div className="uf-header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </div>
        <div>
          <h3 className="uf-title">{edit ? 'Edit User' : 'Create User'}</h3>
          <p className="uf-subtitle">{edit ? 'Update user account details' : 'Add a new team member to the system'}</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="uf-body">
          <Input label="Full Name" icon={svgPerson()} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Email Address" icon={svgMailSmall()} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          {!edit && <Input label="Password" icon={svgLockSmall()} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />}
          {!edit && <Input label="Role" icon={svgShield()}>
            <select className="uf-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="ADMIN">Admin</option>
              {rolesList.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Input>}
        </div>
        <div className="uf-footer">
          <button type="button" className="uf-btn uf-btn-cancel" onClick={onClose}>Back to Users</button>
          <button type="submit" className="uf-btn uf-btn-primary" disabled={submitting}>
            {submitting ? <span className="uf-spinner" /> : null}
            {submitting ? 'Saving...' : edit ? 'Update User' : 'Create User'}
          </button>
        </div>
      </form>
      <style>{ufStyles}</style>
    </div>
  );
}

const svgPerson = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const svgMailSmall = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const svgLockSmall = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const svgShield = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;

const ufStyles = `
.uf-container { width: 100%; }
.uf-header { display: flex; align-items: center; gap: 14px; padding: 20px 24px; background: linear-gradient(135deg,#f8fafc,#f1f5f9); border-bottom: 1.5px solid #e2e8f0; border-radius: 12px 12px 0 0; }
.uf-header-icon { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg,#6366f1,#8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
.uf-title { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
.uf-subtitle { margin: 2px 0 0; font-size: .82rem; color: #64748b; }
.uf-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
.uf-field { display: flex; flex-direction: column; gap: 6px; }
.uf-label { font-size: .82rem; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 6px; letter-spacing: .01em; }
.uf-label-icon { display: inline-flex; color: #6366f1; opacity: .7; }
.uf-input { width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .9rem; color: #1e293b; background: #fff; transition: all .2s; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box; }
.uf-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
select.uf-input { cursor: pointer; appearance: auto; }
.uf-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; background: #f8fafc; border-top: 1.5px solid #e2e8f0; border-radius: 0 0 12px 12px; }
.uf-btn { padding: 10px 22px; border-radius: 10px; font-size: .88rem; font-weight: 600; cursor: pointer; transition: all .2s; display: flex; align-items: center; gap: 8px; font-family: 'Outfit', sans-serif; border: none; }
.uf-btn-cancel { background: #fff; color: #475569; border: 1.5px solid #e2e8f0; }
.uf-btn-cancel:hover { background: #f1f5f9; }
.uf-btn-primary { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; }
.uf-btn-primary:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(99,102,241,.35); transform: translateY(-1px); }
.uf-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.uf-spinner { display: inline-block; width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; animation: ufSpin .6s linear infinite; }
@keyframes ufSpin { to { transform: rotate(360deg); } }
`;

function Input({ label, icon, type = 'text', value, onChange, required, children }) {
  return (
    <div className="uf-field">
      <label className="uf-label">{icon && <span className="uf-label-icon">{icon}</span>}{label}</label>
      {children || <input type={type} className="uf-input" value={value} onChange={onChange} required={required} />}
    </div>
  );
}
