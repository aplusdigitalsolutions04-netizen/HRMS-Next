import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard } from './shared';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '@/lib/permissions';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState(null);
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

  const handleSave = async (data) => {
    const method = editRole ? 'PUT' : 'POST';
    const url = editRole ? `${API}/settings/roles/${editRole.id}` : `${API}/settings/roles`;
    
    const res = await fetch(url, {
      method,
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || 'Failed');
    load();
  };

  const deleteRole = (role) => {
    Swal.fire({
      title: 'Delete Role?',
      text: `Are you sure you want to delete the "${role.name}" role?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444'
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const resp = await fetch(`${API}/settings/roles/${role.id}`, { method: 'DELETE', headers: auth() });
          const d = await resp.json();
          if (!resp.ok) throw new Error(d.detail || 'Failed to delete');
          Swal.fire('Deleted!', 'Role has been deleted.', 'success');
          load();
        } catch(e) {
          Swal.fire('Error', e.message, 'error');
        }
      }
    });
  };

  return (
    <SettingsCard title="Role Management" desc="Create and manage custom roles and their permissions">
      {!showModal ? (
        <>
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <button className="btn-premium" onClick={() => { setEditRole(null); setShowModal(true); }}>+ Add Role</button>
          </div>
          
          {loading ? <div className="p-3 text-center">Loading...</div> : (
            <div className="premium-table-wrapper">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Role Name</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r, idx) => (
                    <tr key={r.id}>
                      <td style={{ color: '#64748b', fontSize: '.85rem' }}>{(page - 1) * pageSize + idx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>{r.name}</td>
                      <td style={{ color: '#64748b' }}>{r.description || '—'}</td>
                      <td>
                        <button className="tbl-action tbl-view" onClick={() => { setEditRole(r); setShowModal(true); }} style={{ marginRight: 8 }}>✏️ Edit</button>
                        <button className="tbl-action tbl-view" onClick={() => deleteRole(r)} style={{ color: '#ef4444' }}>🗑️ Delete</button>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-muted">No custom roles found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination page={page} totalItems={roles.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="roles" />
            </div>
          )}
        </>
      ) : (
        <RoleForm onClose={() => setShowModal(false)} onSave={handleSave} edit={editRole} />
      )}
    </SettingsCard>
  );
}

function RoleForm({ onClose, onSave, edit }) {
  const [form, setForm] = useState({
    name: edit?.name || '',
    description: edit?.description || '',
    permissions: edit?.permissions || {}
  });
  const [submitting, setSubmitting] = useState(false);

  const togglePermission = (key) => {
    setForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) {
      Swal.fire({ icon: 'warning', title: 'Validation', text: 'Role Name is required.' });
      return;
    }
    setSubmitting(true);
    try {
      await onSave(form);
      onClose();
      Swal.fire({ icon: 'success', title: edit ? 'Role Updated!' : 'Role Created!', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Group permissions for rendering
  const groupedPerms = {};
  PERMISSION_GROUPS.forEach(g => groupedPerms[g] = []);
  Object.entries(ALL_PERMISSIONS).forEach(([key, config]) => {
    if (groupedPerms[config.group]) {
      groupedPerms[config.group].push({ key, ...config });
    } else {
      if(!groupedPerms["Other"]) groupedPerms["Other"] = [];
      groupedPerms["Other"].push({ key, ...config });
    }
  });

  return (
    <form onSubmit={submit} className="animate-in fade-in zoom-in" style={{ animationDuration: '0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
          {edit ? 'Edit Role' : 'Create New Role'}
        </h3>
        <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>✖</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', fontWeight: 600, color: '#475569' }}>Role Name</label>
          <input
            type="text"
            className="premium-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            placeholder="e.g. Finance Manager"
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '.85rem', fontWeight: 600, color: '#475569' }}>Description</label>
          <input
            type="text"
            className="premium-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Role description"
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>Role Permissions</h4>
        
        {Object.keys(groupedPerms).map(group => (
          groupedPerms[group].length > 0 && (
            <div key={group} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '.9rem', fontWeight: 700, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {group}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                {groupedPerms[group].map(p => (
                  <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.9rem', color: '#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <input 
                      type="checkbox" 
                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#4338ca' }}
                      checked={form.permissions[p.key] === true}
                      onChange={() => togglePermission(p.key)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
        <button type="button" onClick={onClose} style={{ background: '#f1f5f9', color: '#475569', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
        <button type="submit" className="btn-premium" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Role'}
        </button>
      </div>
    </form>
  );
}
