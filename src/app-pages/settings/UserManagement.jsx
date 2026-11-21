import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard } from './shared';
import Pagination, { paginate } from '../shared/Pagination';
import { appLocale } from '@/lib/app-config-client';

const PAGE_SIZE = 10;
const JSON_H = () => ({ ...auth(), 'Content-Type': 'application/json' });
const BUILT_IN = [
  ['ADMIN', 'Admin', 'Everything, always. Cannot be limited.'],
  ['HR', 'HR', 'HR team. What the person may do is set under Permissions.'],
  ['HR_STAFF', 'HR Staff', 'Limited HR work. What the person may do is set under Permissions.'],
];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (v) => { if (!v) return null; try { return new Date(v).toLocaleString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return null; } };
// a password that follows the usual rules (letters, numbers and a sign), shown once to the administrator
const makePassword = () => {
  const L = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', D = '23456789', S = '!@#$%*?';
  const pick = (set, n) => Array.from(crypto.getRandomValues(new Uint32Array(n))).map(x => set[x % set.length]).join('');
  const raw = (pick(L, 7) + pick(D, 3) + pick(S, 2)).split('');
  for (let i = raw.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [raw[i], raw[j]] = [raw[j], raw[i]]; }
  return raw.join('');
};

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = the list; { user } = the add / edit form
  const [rolesList, setRolesList] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [statusF, setStatusF] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/settings/users`, { headers: auth() }).then(r => r.json()),
      fetch(`${API}/settings/roles`, { headers: auth() }).then(r => r.json()).catch(() => []),
    ]).then(([usersData, rolesData]) => {
      setUsers(Array.isArray(usersData) ? usersData : []);
      setRolesList(Array.isArray(rolesData) ? rolesData : []);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter(u => (!t || `${u.name || ''} ${u.email}`.toLowerCase().includes(t))
      && (!roleF || u.role === roleF)
      && (!statusF || (statusF === 'active' ? !!u.is_active : !u.is_active)));
  }, [users, q, roleF, statusF]);
  useEffect(() => { setPage(1); }, [q, roleF, statusF, users.length]);
  const pageItems = paginate(shown, page, pageSize);

  const send = async (url, method, body) => {
    const res = await fetch(url, { method, headers: JSON_H(), body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || d.message || 'Failed');
    return d;
  };

  const toggleActive = async (u) => {
    if (u.is_active) {
      const c = await Swal.fire({ icon: 'warning', title: `Disable ${u.name || u.email}?`, text: 'They are signed out at once and cannot sign in until you enable the account again.', showCancelButton: true, confirmButtonText: 'Disable' });
      if (!c.isConfirmed) return;
    }
    try { await send(`${API}/settings/users/${u.id}`, 'PUT', { is_active: !u.is_active }); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Not changed', text: e.message }); }
  };

  const deleteUser = async (u) => {
    const c = await Swal.fire({ icon: 'warning', title: 'Delete this user?', text: `"${u.name || u.email}" will be deleted for good. To keep the account but stop it signing in, disable it instead.`, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626', focusCancel: true });
    if (!c.isConfirmed) return;
    try { await send(`${API}/settings/users/${u.id}`, 'DELETE'); Swal.fire({ icon: 'success', title: 'User deleted', timer: 1300, showConfirmButton: false }); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Not deleted', text: e.message }); }
  };

  const resetPassword = async (u) => {
    const r = await Swal.fire({
      title: 'Reset password', width: 460, showCancelButton: true, confirmButtonText: 'Reset password', focusConfirm: false,
      html: `<div style="text-align:left"><div style="font-size:.84rem;margin-bottom:10px">New password for <b>${esc(u.name || u.email)}</b>. Tell it to them yourself; it is not emailed.</div>
        <label for="rp-pw">New password</label>
        <div style="display:flex;gap:8px"><input id="rp-pw" type="text" class="swal2-input" style="margin:4px 0;flex:1" autocomplete="off"><button type="button" id="rp-gen" class="swal2-styled" style="margin:4px 0;background:#fff;color:#475569;border:1px solid #e2e8f0">Generate</button></div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;text-transform:none;font-size:.84rem"><input id="rp-must" type="checkbox" checked> Ask them to choose a new password at the next sign-in</label></div>`,
      didOpen: () => { document.getElementById('rp-gen').onclick = () => { document.getElementById('rp-pw').value = makePassword(); }; document.getElementById('rp-pw').focus(); },
      preConfirm: () => { const pw = document.getElementById('rp-pw').value; if (!pw) { Swal.showValidationMessage('Type a password or press Generate'); return false; } return { pw, must: document.getElementById('rp-must').checked }; },
    });
    if (!r.isConfirmed) return;
    try {
      await send(`${API}/settings/users/${u.id}`, 'PUT', { new_password: r.value.pw, must_change_password: r.value.must });
      Swal.fire({ icon: 'success', title: 'Password reset', text: 'Give the new password to the user.', confirmButtonText: 'Done' });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not reset', text: e.message }); }
  };

  const roleBadge = (u) => {
    const isAdmin = u.role === 'ADMIN', builtIn = BUILT_IN.some(b => b[0] === u.role), custom = rolesList.some(r => r.id === u.role);
    // a role that is neither built in nor on the Roles page (left from an older version): shown grey, to be corrected with Edit
    const unknown = !builtIn && !custom && rolesList.length >= 0 && !loading;
    const st = isAdmin ? { bg: 'var(--brand-soft-2)', c: 'var(--brand-dark)' } : custom ? { bg: '#dcfce7', c: '#166534' } : unknown ? { bg: '#f1f5f9', c: '#64748b' } : { bg: '#fef3c7', c: '#92400e' };
    return <span title={unknown ? 'This role does not exist any more. Press Edit and choose a role.' : undefined} style={{ background: st.bg, color: st.c, padding: '2px 10px', borderRadius: 50, fontWeight: 600, fontSize: '.72rem', display: 'inline-block', whiteSpace: 'nowrap' }}>{unknown ? `${u.role} (no role)` : (u.role_name || u.role)}</span>;
  };

  if (form) return <SettingsCard title="User Management" desc="People who sign in to run the system"><UserForm key={form.user?.id || 'new'} user={form.user} rolesList={rolesList} onClose={() => setForm(null)} onDone={() => { setForm(null); load(); }} send={send} /></SettingsCard>;

  const activeCount = users.filter(u => u.is_active).length;
  return (
    <SettingsCard title="User Management" desc="People who sign in to run the system. Their role decides what they can open; Permissions can add or remove single things.">
      <style>{UM_CSS}</style>
      <div className="um-bar">
        <div className="um-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email..." aria-label="Search users" />
        </div>
        <select className="um-sel" value={roleF} onChange={e => setRoleF(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {BUILT_IN.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          {rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="um-sel" value={statusF} onChange={e => setStatusF(e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option><option value="active">Active</option><option value="disabled">Disabled</option>
        </select>
        <span className="um-count">{users.length ? `${activeCount} active of ${users.length}` : ''}</span>
        <button className="btn-premium um-add" onClick={() => setForm({ user: null })}>+ Add User</button>
      </div>

      {loading ? <div className="p-3 text-center">Loading...</div> : (
        <div className="premium-table-wrapper">
          <table className="premium-table">
            <thead><tr><th style={{ width: 40 }}>#</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Actions</th></tr></thead>
            <tbody>
              {pageItems.map((u, idx) => (
                <tr key={u.id}>
                  <td style={{ color: '#64748b', fontSize: '.85rem' }}>{(page - 1) * pageSize + idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{u.name || <span style={{ color: '#94a3b8', fontWeight: 400 }}>No name</span>}</td>
                  <td>{u.email}</td>
                  <td>{roleBadge(u)}</td>
                  <td><span className={`badge-premium ${u.is_active ? 'badge-success' : 'badge-danger'}`} style={{ whiteSpace: 'nowrap' }}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                  <td style={{ fontSize: '.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>{when(u.last_login) || 'Never'}</td>
                  <td>
                    <div className="um-actions">
                      <button className="um-b" onClick={() => setForm({ user: u })}>Edit</button>
                      {u.role !== 'ADMIN' && <button className="um-b" onClick={() => navigate(`/users/${u.id}/permissions`)} title="Allow or block single things for this person">Permissions</button>}
                      {u.role !== 'ADMIN' && <button className="um-b" onClick={() => resetPassword(u)}>Password</button>}
                      {u.role === 'ADMIN' ? (
                        <>{!u.is_active && <button className="um-b" onClick={() => toggleActive(u)}>Enable</button>}<span className="um-prot" title="An Admin account cannot be disabled, demoted or deleted">Protected</span></>
                      ) : (
                        <>
                          <button className="um-b" onClick={() => toggleActive(u)}>{u.is_active ? 'Disable' : 'Enable'}</button>
                          <button className="um-b um-del" onClick={() => deleteUser(u)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted">{users.length ? 'No user matches the search.' : 'No users found'}</td></tr>}
            </tbody>
          </table>
          <Pagination page={page} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="users" />
        </div>
      )}
    </SettingsCard>
  );
}

// Add a user, or change one (name, email and role; the password is reset from the list).
function UserForm({ user, rolesList, onClose, onDone, send }) {
  const edit = !!user;
  const isAdminAccount = user?.role === 'ADMIN';
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', role: user?.role || 'HR_STAFF', password: '', must_change_password: true, is_active: true });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const roleNote = (BUILT_IN.find(b => b[0] === f.role) || [])[2] || (rolesList.find(r => r.id === f.role) || {}).description || 'The permissions of this role are set on the Roles page.';

  const submit = async (e) => {
    e.preventDefault();
    if (!f.email.trim()) { Swal.fire({ icon: 'warning', title: 'Email is required' }); return; }
    if (!edit && !f.password) { Swal.fire({ icon: 'warning', title: 'Give a password', text: 'Type one, or press Generate.' }); return; }
    if (f.role === 'ADMIN' && (!edit || user.role !== 'ADMIN')) {
      const c = await Swal.fire({ icon: 'warning', title: 'Give full access?', text: 'An Admin can do everything, including managing users and roles, and the account can never be disabled or limited.', showCancelButton: true, confirmButtonText: 'Yes, make Admin' });
      if (!c.isConfirmed) return;
    }
    setBusy(true);
    try {
      if (edit) {
        const body = { full_name: f.name, email: f.email };
        if (!isAdminAccount) body.role = f.role;
        await send(`${API}/settings/users/${user.id}`, 'PUT', body);
        Swal.fire({ icon: 'success', title: 'User updated', timer: 1400, showConfirmButton: false });
      } else {
        await send(`${API}/settings/users`, 'POST', { full_name: f.name, email: f.email, password: f.password, role: f.role, is_active: f.is_active, must_change_password: f.must_change_password });
        Swal.fire({ icon: 'success', title: 'User created', text: 'Give them the email and the password you typed.', confirmButtonText: 'Done' });
      }
      onDone();
    } catch (err) { Swal.fire({ icon: 'error', title: 'Not saved', text: err.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="uf-container">
      <style>{UF_CSS}</style>
      <div className="uf-header">
        <div className="uf-header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
        </div>
        <div>
          <h3 className="uf-title">{edit ? 'Edit User' : 'Add User'}</h3>
          <p className="uf-subtitle">{edit ? user.email : 'A new person who signs in to run the system'}</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="uf-body">
          <div className="uf-field"><label className="uf-label" htmlFor="uf-name">Full name</label><input id="uf-name" className="uf-input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div className="uf-field"><label className="uf-label" htmlFor="uf-email">Email address</label><input id="uf-email" type="email" className="uf-input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></div>
          <div className="uf-field">
            <label className="uf-label" htmlFor="uf-role">Role</label>
            <select id="uf-role" className="uf-input" value={f.role} disabled={isAdminAccount} onChange={e => setF({ ...f, role: e.target.value })}>
              <optgroup label="Built in">{BUILT_IN.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</optgroup>
              {rolesList.length > 0 && <optgroup label="Your roles">{rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>}
              {edit && !BUILT_IN.some(b => b[0] === user.role) && !rolesList.some(r => r.id === user.role) && <option value={user.role}>{user.role} (not a valid role)</option>}
            </select>
            <small className="uf-note">{isAdminAccount ? 'The role of an Admin account cannot be changed.' : roleNote}</small>
          </div>
          {!edit && (
            <>
              <div className="uf-field">
                <label className="uf-label" htmlFor="uf-pw">Password</label>
                <div className="uf-pwrow">
                  <input id="uf-pw" type={show ? 'text' : 'password'} className="uf-input" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} autoComplete="new-password" required />
                  <button type="button" className="uf-mini" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
                  <button type="button" className="uf-mini" onClick={() => { setF({ ...f, password: makePassword() }); setShow(true); }}>Generate</button>
                </div>
                <small className="uf-note">It must follow the password rules (Settings &gt; Rules &amp; Limits). It is not emailed; tell it to the person yourself.</small>
              </div>
              <label className="uf-check"><input type="checkbox" checked={f.must_change_password} onChange={e => setF({ ...f, must_change_password: e.target.checked })} /> Ask them to choose a new password at the first sign-in</label>
              <label className="uf-check"><input type="checkbox" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} /> The account can sign in now</label>
            </>
          )}
        </div>
        <div className="uf-footer">
          <button type="button" className="uf-btn uf-btn-cancel" onClick={onClose}>Back to Users</button>
          <button type="submit" className="uf-btn uf-btn-primary" disabled={busy}>{busy ? 'Saving...' : edit ? 'Save changes' : 'Create user'}</button>
        </div>
      </form>
    </div>
  );
}

const UM_CSS = `
.um-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
.um-search { position:relative; flex:1 1 240px; max-width:340px; }
.um-search svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:#94a3b8; }
.um-search input { width:100%; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px 8px 32px; font-size:.86rem; font-family:inherit; background:#fff; }
.um-search input:focus, .um-sel:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.um-sel { border:1px solid #e2e8f0; border-radius:10px; padding:8px 10px; font-size:.84rem; font-family:inherit; background:#fff; }
.um-count { font-size:.78rem; color:#94a3b8; margin-left:auto; }
.um-add { height:36px; }
.um-actions { display:flex; gap:5px; flex-wrap:wrap; align-items:center; }
.um-b { height:28px; padding:0 10px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; font-family:inherit; }
.um-b:hover { border-color:var(--brand-line); color:var(--brand-dark); background:var(--brand-soft); }
.um-b.um-del { color:#b91c1c; } .um-b.um-del:hover { border-color:#fecaca; background:#fef2f2; color:#b91c1c; }
.um-prot { font-size:.72rem; color:#94a3b8; margin-left:4px; }
`;
const UF_CSS = `
.uf-container { width:100%; max-width:640px; }
.uf-header { display:flex; align-items:center; gap:14px; padding:15px 18px; background:linear-gradient(135deg,#f8fafc,#f1f5f9); border:1.5px solid #e2e8f0; border-bottom:none; border-radius:12px 12px 0 0; }
.uf-header-icon { width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,var(--brand),var(--brand-mid)); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
.uf-title { margin:0; font-family:'Outfit',sans-serif; font-size:1.1rem; font-weight:700; color:#1e293b; }
.uf-subtitle { margin:2px 0 0; font-size:.82rem; color:#64748b; }
.uf-body { padding:16px 18px; display:flex; flex-direction:column; gap:14px; border:1.5px solid #e2e8f0; border-bottom:none; background:#fff; }
.uf-field { display:flex; flex-direction:column; gap:5px; }
.uf-label { font-size:.8rem; font-weight:700; color:#334155; }
.uf-input { width:100%; padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:.9rem; color:#1e293b; background:#fff; outline:none; font-family:inherit; box-sizing:border-box; }
.uf-input:focus { border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.15); }
.uf-input:disabled { background:#f8fafc; color:#94a3b8; }
.uf-note { font-size:.74rem; color:#64748b; line-height:1.4; }
.uf-pwrow { display:flex; gap:8px; } .uf-pwrow .uf-input { flex:1; }
.uf-mini { border:1px solid #e2e8f0; background:#fff; border-radius:9px; padding:0 12px; font-size:.78rem; font-weight:600; color:#475569; cursor:pointer; font-family:inherit; }
.uf-mini:hover { border-color:var(--brand-line); background:var(--brand-soft); color:var(--brand-dark); }
.uf-check { display:flex; align-items:center; gap:8px; font-size:.84rem; color:#334155; cursor:pointer; }
.uf-footer { display:flex; justify-content:flex-end; gap:10px; padding:14px 18px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:0 0 12px 12px; }
.uf-btn { padding:9px 17px; border-radius:10px; font-size:.86rem; font-weight:600; cursor:pointer; font-family:'Outfit',sans-serif; border:none; }
.uf-btn-cancel { background:#fff; color:#475569; border:1.5px solid #e2e8f0; } .uf-btn-cancel:hover { background:#f1f5f9; }
.uf-btn-primary { background:linear-gradient(135deg,var(--brand),var(--brand-mid)); color:#fff; } .uf-btn-primary:disabled { opacity:.6; cursor:not-allowed; }
`;
