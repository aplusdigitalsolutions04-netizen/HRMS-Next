import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard } from './shared';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '@/lib/permissions';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;
const TOTAL = Object.keys(ALL_PERMISSIONS).length;

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = the list; { role, copy } = the form
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setPage(1); }, [roles.length]);
  const pageItems = paginate(roles, page, pageSize);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/settings/roles`, { headers: auth() })
      .then(r => r.json())
      .then(d => setRoles(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSave = async (data, editing) => {
    const res = await fetch(editing ? `${API}/settings/roles/${editing.id}` : `${API}/settings/roles`, {
      method: editing ? 'PUT' : 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || 'Failed');
    load();
  };

  const deleteRole = async (role) => {
    const c = await Swal.fire({ icon: 'warning', title: 'Delete this role?', text: `"${role.name}" will be deleted. Nobody has it.`, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626', focusCancel: true });
    if (!c.isConfirmed) return;
    try {
      const resp = await fetch(`${API}/settings/roles/${role.id}`, { method: 'DELETE', headers: auth() });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(d.detail || 'Failed to delete');
      Swal.fire({ icon: 'success', title: 'Role deleted', timer: 1300, showConfirmButton: false });
      load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not deleted', text: e.message }); }
  };

  if (form) {
    return (
      <SettingsCard title="Role Management" desc="Create and manage custom roles and their permissions">
        <RoleForm key={form.role?.id || (form.copy ? 'copy' : 'new')} edit={form.role} copy={form.copy} onClose={() => setForm(null)} onSave={handleSave} />
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title="Role Management" desc="A role is a ready set of permissions. Give it to a person under Users, and change it here once for everyone who has it.">
      <style>{RM_CSS}</style>
      <div className="rm-built">
        <b>Built in</b>
        <span><i>Admin</i> can do everything.</span>
        <span><i>HR</i> and <i>HR Staff</i> get their permissions one person at a time (Users &gt; Permissions).</span>
      </div>
      <div style={{ textAlign: 'right', marginBottom: 14 }}>
        <button className="btn-premium" onClick={() => setForm({ role: null })}>+ Add Role</button>
      </div>

      {loading ? <div className="p-3 text-center">Loading...</div> : (
        <div className="premium-table-wrapper">
          <table className="premium-table">
            <thead>
              <tr><th style={{ width: 40 }}>#</th><th>Role Name</th><th>Description</th><th>Permissions</th><th>People</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {pageItems.map((r, idx) => (
                <tr key={r.id}>
                  <td style={{ color: '#64748b', fontSize: '.85rem' }}>{(page - 1) * pageSize + idx + 1}</td>
                  <td style={{ fontWeight: 600, color: '#334155' }}>{r.name}</td>
                  <td style={{ color: '#64748b' }}>{r.description || '—'}</td>
                  <td><span className="rm-pill">{r.permission_count ?? 0} of {TOTAL}</span></td>
                  <td>{r.user_count > 0 ? <span className="rm-pill on">{r.user_count} {r.user_count === 1 ? 'person' : 'people'}</span> : <span style={{ color: '#94a3b8', fontSize: '.8rem' }}>Nobody yet</span>}</td>
                  <td>
                    <div className="rm-actions">
                      <button className="um-b" onClick={() => setForm({ role: r })}>Edit</button>
                      <button className="um-b" onClick={() => setForm({ role: null, copy: r })} title="Make a new role with the same permissions">Duplicate</button>
                      <button className="um-b um-del" onClick={() => deleteRole(r)} disabled={r.user_count > 0} title={r.user_count > 0 ? 'Give these people another role first' : 'Delete the role'}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr><td colSpan={6} className="text-center py-4 text-muted">No custom roles yet. Press "+ Add Role" to make one, for example "Payroll Officer".</td></tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalItems={roles.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="roles" />
        </div>
      )}
    </SettingsCard>
  );
}

function RoleForm({ edit, copy, onClose, onSave }) {
  const base = edit || copy;
  const [form, setForm] = useState({
    name: edit ? edit.name : copy ? `${copy.name} (copy)` : '',
    description: base?.description || '',
    permissions: { ...(base?.permissions || {}) },
  });
  const [submitting, setSubmitting] = useState(false);
  const [q, setQ] = useState('');
  const first = useMemo(() => JSON.stringify(form), []); // eslint-disable-line
  const dirty = JSON.stringify(form) !== first;

  const setPerm = (keys, v) => setForm(prev => { const p = { ...prev.permissions }; keys.forEach(k => { p[k] = v; }); return { ...prev, permissions: p }; });
  const on = (k) => form.permissions[k] === true;
  const picked = Object.keys(ALL_PERMISSIONS).filter(on).length;

  const close = async () => {
    if (dirty) {
      const c = await Swal.fire({ icon: 'question', title: 'Leave without saving?', text: 'The changes you made to this role will be lost.', showCancelButton: true, confirmButtonText: 'Leave' });
      if (!c.isConfirmed) return;
    }
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { Swal.fire({ icon: 'warning', title: 'Role name is required' }); return; }
    setSubmitting(true);
    try {
      await onSave(form, edit);
      onClose();
      Swal.fire({ icon: 'success', title: edit ? 'Role updated' : 'Role created', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Not saved', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // permissions grouped as the Permissions page groups them
  const groups = [];
  const seen = new Set();
  [...PERMISSION_GROUPS, ...Object.values(ALL_PERMISSIONS).map(p => p.group)].forEach(g => {
    if (seen.has(g)) return; seen.add(g);
    const items = Object.entries(ALL_PERMISSIONS).filter(([, c]) => c.group === g).map(([key, c]) => ({ key, ...c }))
      .filter(p => !q.trim() || `${p.label} ${p.key} ${g}`.toLowerCase().includes(q.trim().toLowerCase()));
    if (items.length) groups.push([g, items]);
  });

  return (
    <form onSubmit={submit} className="rm-form">
      <style>{RM_CSS}</style>
      <div className="rm-form-head">
        <h3>{edit ? `Edit role: ${edit.name}` : copy ? 'Duplicate role' : 'Create a new role'}</h3>
        <button type="button" onClick={close} aria-label="Close" className="rm-x">&#10005;</button>
      </div>
      {edit && edit.user_count > 0 && <div className="rm-warn">{edit.user_count} {edit.user_count === 1 ? 'person has' : 'people have'} this role. A change to its permissions reaches them at their next click.</div>}

      <div className="rm-two">
        <div>
          <label className="rm-label" htmlFor="rm-name">Role name</label>
          <input id="rm-name" className="rm-input" value={form.name} maxLength={100} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Payroll Officer" required />
        </div>
        <div>
          <label className="rm-label" htmlFor="rm-desc">Description</label>
          <input id="rm-desc" className="rm-input" value={form.description} maxLength={250} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What this role is for" />
        </div>
      </div>

      <div className="rm-permhead">
        <h4>Permissions <span>{picked} of {TOTAL} selected</span></h4>
        <div className="rm-permtools">
          <input className="rm-input rm-find" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a permission..." aria-label="Find a permission" />
          <button type="button" className="um-b" onClick={() => setPerm(Object.keys(ALL_PERMISSIONS), true)}>Select all</button>
          <button type="button" className="um-b" onClick={() => setPerm(Object.keys(ALL_PERMISSIONS), false)}>Clear all</button>
        </div>
      </div>

      {groups.length === 0 && <div className="rm-none">No permission matches "{q}".</div>}
      {groups.map(([g, items]) => {
        const keys = items.map(p => p.key), n = keys.filter(on).length;
        return (
          <section key={g} className="rm-group">
            <div className="rm-group-h">
              <b>{g}</b><span>{n}/{keys.length}</span>
              <span className="rm-sp" />
              <button type="button" className="rm-link" onClick={() => setPerm(keys, true)}>All</button>
              <button type="button" className="rm-link" onClick={() => setPerm(keys, false)}>None</button>
            </div>
            <div className="rm-perms">
              {items.map(p => (
                <label key={p.key} className={`rm-perm${on(p.key) ? ' on' : ''}`}>
                  <input type="checkbox" checked={on(p.key)} onChange={() => setPerm([p.key], !on(p.key))} />
                  {p.label}
                </label>
              ))}
            </div>
          </section>
        );
      })}

      <div className="rm-foot">
        <button type="button" className="btn-o" onClick={close}>Cancel</button>
        <button type="submit" className="btn-premium" disabled={submitting}>{submitting ? 'Saving...' : edit ? 'Save role' : 'Create role'}</button>
      </div>
    </form>
  );
}

const RM_CSS = `
.rm-built { display:flex; gap:6px 16px; flex-wrap:wrap; align-items:center; font-size:.8rem; color:#64748b; background:var(--brand-soft,#f4ede7); border:1px solid var(--brand-line,#d9c5b3); border-radius:10px; padding:9px 14px; margin-bottom:14px; }
.rm-built b { color:var(--brand-dark); font-size:.72rem; text-transform:uppercase; letter-spacing:.4px; } .rm-built i { font-style:normal; font-weight:700; color:#334155; }
.rm-pill { font-size:.74rem; font-weight:600; background:#f1f5f9; color:#475569; border-radius:20px; padding:2px 10px; white-space:nowrap; }
.rm-pill.on { background:#dcfce7; color:#166534; }
.rm-actions { display:flex; gap:5px; flex-wrap:wrap; }
.um-b { height:28px; padding:0 10px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; font-family:inherit; }
.um-b:hover:not(:disabled) { border-color:var(--brand-line); color:var(--brand-dark); background:var(--brand-soft); }
.um-b:disabled { opacity:.45; cursor:default; }
.um-b.um-del { color:#b91c1c; } .um-b.um-del:hover:not(:disabled) { border-color:#fecaca; background:#fef2f2; color:#b91c1c; }
.rm-form-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; } .rm-form-head h3 { margin:0; font-size:1.1rem; }
.rm-x { background:transparent; border:none; font-size:1.1rem; cursor:pointer; color:#94a3b8; }
.rm-warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:10px; padding:8px 12px; font-size:.82rem; margin-bottom:14px; }
.rm-two { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; }
.rm-label { display:block; margin-bottom:5px; font-size:.78rem; font-weight:700; color:#475569; }
.rm-input { width:100%; box-sizing:border-box; border:1.5px solid #e2e8f0; border-radius:10px; padding:9px 12px; font-size:.9rem; font-family:inherit; background:#fff; color:#1e293b; }
.rm-input:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.rm-permhead { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:14px; }
.rm-permhead h4 { margin:0; font-size:1rem; } .rm-permhead h4 span { font-size:.76rem; font-weight:600; color:#94a3b8; margin-left:8px; }
.rm-permtools { display:flex; gap:6px; align-items:center; flex-wrap:wrap; } .rm-find { width:220px; padding:6px 10px; font-size:.82rem; }
.rm-none { text-align:center; color:#94a3b8; padding:20px; }
.rm-group { margin-bottom:16px; }
.rm-group-h { display:flex; align-items:center; gap:8px; margin-bottom:8px; } .rm-group-h b { font-size:.78rem; text-transform:uppercase; letter-spacing:.05em; color:#475569; } .rm-group-h span { font-size:.7rem; color:#94a3b8; } .rm-sp { flex:1; }
.rm-link { border:none; background:none; color:var(--brand); font-size:.74rem; font-weight:600; cursor:pointer; font-family:inherit; padding:0 2px; } .rm-link:hover { text-decoration:underline; }
.rm-perms { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:8px; }
.rm-perm { display:flex; align-items:center; gap:8px; cursor:pointer; font-size:.86rem; color:#334155; background:#f8fafc; padding:7px 11px; border-radius:8px; border:1px solid #e2e8f0; }
.rm-perm.on { background:var(--brand-soft); border-color:var(--brand-line); color:var(--brand-dark); font-weight:600; }
.rm-perm input { width:16px; height:16px; accent-color:var(--brand-dark); cursor:pointer; }
.rm-foot { display:flex; justify-content:flex-end; gap:10px; margin-top:24px; padding-top:14px; border-top:1px solid #e2e8f0; }
@media (max-width:700px) { .rm-two { grid-template-columns:1fr; } }
`;
