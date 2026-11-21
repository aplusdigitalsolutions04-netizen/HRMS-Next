import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '@/lib/permissions';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const KEYS = Object.keys(ALL_PERMISSIONS);

// Settings > Users > Permissions: what one person may do. A role (if the person has one made on the Roles page) gives a base set;
// what is set here for the person is added on top of it, so a single thing can be given or taken away.
export default function UserPermissionEditor() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [own, setOwn] = useState({});          // what is set for this person
  const [saved, setSaved] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/settings/users/${userId}/permissions`, { headers: auth() })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setUser(d); setOwn(d.permissions || {}); setSaved(JSON.stringify(d.permissions || {})); })
      .catch(e => Swal.fire({ icon: 'error', title: 'Could not load the permissions', text: e.message }))
      .finally(() => setLoading(false));
  }, [userId]);

  const rolePerms = user?.role_permissions || {};
  const isAdmin = user?.role === 'ADMIN';
  // what the person can do: their own setting when there is one, otherwise what the role gives
  const eff = (k) => (k in own ? !!own[k] : !!rolePerms[k]);
  const dirty = JSON.stringify(own) !== saved;
  const total = KEYS.filter(eff).length;

  const setMany = (keys, v) => setOwn(prev => { const n = { ...prev }; keys.forEach(k => { n[k] = v; }); return n; });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/users/${userId}/permissions`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: own }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      setSaved(JSON.stringify(own));
      Swal.fire({ icon: 'success', title: 'Permissions saved', text: 'They take effect at the next click of this person.', timer: 2200, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Not saved', text: e.message });
    } finally { setSaving(false); }
  };
  const back = async () => {
    if (dirty) { const c = await Swal.fire({ icon: 'question', title: 'Leave without saving?', text: 'Your changes to these permissions will be lost.', showCancelButton: true, confirmButtonText: 'Leave' }); if (!c.isConfirmed) return; }
    navigate('/settings/users');
  };

  const groups = useMemo(() => {
    const out = []; const seen = new Set();
    [...PERMISSION_GROUPS, ...Object.values(ALL_PERMISSIONS).map(p => p.group)].forEach(g => {
      if (seen.has(g)) return; seen.add(g);
      const items = KEYS.filter(k => ALL_PERMISSIONS[k].group === g && (!q.trim() || `${ALL_PERMISSIONS[k].label} ${k} ${g}`.toLowerCase().includes(q.trim().toLowerCase())));
      if (items.length) out.push([g, items]);
    });
    return out;
  }, [q]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#94a3b8' }}>Loading...</div>;
  if (!user) return <div style={{ padding: 30 }}><button className="btn-o" onClick={() => navigate('/settings/users')}>&larr; Back to Users</button></div>;

  return (
    <div className="pe-page">
      <style>{CSS}</style>
      <div className="pe-head">
        <button type="button" className="pe-back" onClick={back}>&larr; Back</button>
        <div className="pe-who">
          <h2>Permissions</h2>
          <p>{user.name || user.email} &lt;{user.email}&gt; <span className="pe-role">{user.role_name}</span></p>
        </div>
        <div className="pe-tools">
          <input className="pe-find" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a permission..." aria-label="Find a permission" />
        </div>
      </div>

      {isAdmin ? (
        <div className="pe-note">This is an Admin account. An Admin can do everything and cannot be limited, so there is nothing to set here.</div>
      ) : (
        <>
          <div className="pe-note">
            {user.role_name && !['HR', 'HR Staff'].includes(user.role_name)
              ? <>The role <b>{user.role_name}</b> gives the permissions marked <i className="pe-tag">from role</i>. Change a switch to give or take away that one thing for this person only. To change the role for everyone who has it, use Roles.</>
              : <>This person has the built-in role <b>{user.role_name}</b>, so what they may do is set here. Switch on only what they need.</>}
            <span className="pe-count">{total} of {KEYS.length} allowed</span>
          </div>

          {groups.length === 0 && <div className="pe-none">No permission matches &quot;{q}&quot;.</div>}
          {groups.map(([group, keys]) => (
            <section key={group} className="pe-card">
              <div className="pe-card-h">
                <h3>{group} <span>{keys.filter(eff).length}/{keys.length}</span></h3>
                <div>
                  <button type="button" className="pe-link" onClick={() => setMany(keys, true)}>All</button>
                  <button type="button" className="pe-link" onClick={() => setMany(keys, false)}>None</button>
                </div>
              </div>
              <div className="pe-rows">
                {keys.map(k => {
                  const fromRole = !!rolePerms[k] && !(k in own), changedFromRole = (k in own) && !!rolePerms[k] !== !!own[k];
                  return (
                    <label key={k} className="pe-row">
                      <span className="pe-label">{ALL_PERMISSIONS[k].label}
                        {fromRole && <i className="pe-tag">from role</i>}
                        {changedFromRole && <i className={`pe-tag ${own[k] ? 'add' : 'rem'}`}>{own[k] ? 'added for this person' : 'taken away'}</i>}
                      </span>
                      <input type="checkbox" checked={eff(k)} onChange={() => setOwn(prev => ({ ...prev, [k]: !eff(k) }))} />
                      <span className="pe-switch" aria-hidden="true" />
                    </label>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="pe-bar">
            <span>{dirty ? 'Unsaved changes' : 'All changes are saved'}</span>
            <span className="pe-bar-actions">
              <button type="button" className="btn-o" onClick={back}>Cancel</button>
              <button type="button" className="btn-premium" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving...' : 'Save permissions'}</button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const CSS = `
.pe-page { max-width:100%; padding:6px 0 18px; display:flex; flex-direction:column; gap:14px; }
.pe-head { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.pe-back { background:#fff; border:1.5px solid #e2e8f0; border-radius:8px; padding:6px 12px; cursor:pointer; color:#64748b; font-size:.85rem; font-weight:600; font-family:inherit; }
.pe-who h2 { margin:0; font-family:'Outfit',sans-serif; font-size:1.2rem; } .pe-who p { margin:3px 0 0; font-size:.84rem; color:#64748b; }
.pe-role { background:#fef3c7; color:#92400e; padding:1px 9px; border-radius:50px; font-weight:600; font-size:.74rem; margin-left:4px; }
.pe-tools { margin-left:auto; } .pe-find { border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:.85rem; font-family:inherit; width:240px; max-width:100%; background:#fff; }
.pe-find:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.pe-note { background:var(--brand-soft,#f4ede7); border:1px solid var(--brand-line,#d9c5b3); border-radius:10px; padding:10px 14px; font-size:.84rem; color:#475569; display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; line-height:1.5; }
.pe-count { font-weight:700; color:var(--brand-dark); white-space:nowrap; }
.pe-none { text-align:center; color:#94a3b8; padding:24px; }
.pe-card { background:#fff; border:1.5px solid #e2e8f0; border-radius:14px; overflow:hidden; }
.pe-card-h { padding:10px 16px; background:#f8fafc; border-bottom:1.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
.pe-card-h h3 { margin:0; font-family:'Outfit',sans-serif; font-size:.92rem; } .pe-card-h h3 span { font-size:.72rem; color:#94a3b8; font-weight:600; margin-left:6px; }
.pe-link { border:none; background:none; color:var(--brand); font-size:.76rem; font-weight:600; cursor:pointer; font-family:inherit; padding:0 6px; } .pe-link:hover { text-decoration:underline; }
.pe-rows { padding:2px 16px; }
.pe-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid #f1f5f9; cursor:pointer; position:relative; }
.pe-row:last-child { border-bottom:none; }
.pe-label { font-size:.88rem; font-weight:500; color:#334155; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.pe-tag { font-style:normal; font-size:.66rem; font-weight:700; padding:1px 8px; border-radius:20px; background:#dcfce7; color:#166534; }
.pe-tag.add { background:#dbeafe; color:#1d4ed8; } .pe-tag.rem { background:#fee2e2; color:#b91c1c; }
.pe-row input { position:absolute; opacity:0; pointer-events:none; }
.pe-switch { width:38px; height:22px; border-radius:20px; background:#cbd5e1; position:relative; flex-shrink:0; transition:background .15s; }
.pe-switch::after { content:''; position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.3); transition:transform .15s; }
.pe-row input:checked + .pe-switch { background:var(--brand); } .pe-row input:checked + .pe-switch::after { transform:translateX(16px); }
.pe-row input:focus-visible + .pe-switch { box-shadow:0 0 0 3px rgba(111,78,55,.25); }
.pe-bar { position:sticky; bottom:12px; z-index:20; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:10px 14px; box-shadow:0 10px 30px -14px rgba(78,54,38,.4); font-size:.84rem; color:#64748b; }
.pe-bar-actions { display:flex; gap:8px; } .pe-bar .btn-o, .pe-bar .btn-premium { height:32px; padding:0 16px; font-size:.82rem; } .pe-bar .btn-premium:disabled { opacity:.45; cursor:default; }
`;
