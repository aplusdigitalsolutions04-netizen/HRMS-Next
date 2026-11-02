import React, { useState } from 'react';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

// Bank and contact details: the employee can look at them; changing them needs HR's permission (given once, used up on save).
const DETAIL_FIELDS = [
  ['bank_name', 'Bank Name'], ['account_number', 'Account Number'], ['pan', 'PAN'], ['uan', 'UAN'],
  ['alternate_mobile_no', 'Alternate Mobile'], ['present_address', 'Present Address'], ['permanent_address', 'Permanent Address'],
];
const lbl = { fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 };
const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' };

function DetailsCard({ profile, setProfile }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const allowed = !!profile?.profile_edit_allowed;

  const startEdit = () => { const f = {}; DETAIL_FIELDS.forEach(([k]) => { f[k] = profile?.[k] || ''; }); setForm(f); setEditing(true); };
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/profile/details`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      setProfile({ ...profile, ...form, profile_edit_allowed: false });
      setEditing(false);
      Swal.fire({ icon: 'success', title: 'Saved', text: d.message, timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Not saved', text: err.message === 'Failed to fetch' ? 'Could not reach the server. Please try again.' : err.message });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Bank &amp; Contact Details</h3>
        {allowed && !editing && <button onClick={startEdit} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Edit details</button>}
      </div>
      {!allowed && <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>To change these details, ask HR to allow it.</p>}
      {allowed && !editing && <p style={{ margin: '0 0 14px', fontSize: 13, color: '#15803d' }}>HR has allowed you to update these details once.</p>}
      {editing ? (
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {DETAIL_FIELDS.map(([k, label]) => (
              <div key={k} style={k.includes('address') ? { gridColumn: '1 / -1' } : undefined}>
                <label style={lbl}>{label}</label>
                {k.includes('address')
                  ? <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                  : <input style={inp} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} autoCapitalize={k === 'pan' ? 'characters' : undefined} />}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: '9px 24px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#94a3b8' }}>After you save, the permission is used up. Ask HR again if you need to change something later.</p>
        </form>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {DETAIL_FIELDS.map(([k, label]) => (
            <div key={k} style={k.includes('address') ? { gridColumn: '1 / -1' } : undefined}>
              <label style={lbl}>{label}</label>
              <span style={{ fontSize: 15, color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' }}>{profile?.[k] || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfileTab({ profile, setProfile, role }) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editDesig, setEditDesig] = useState('');

  return (
    <div className="emp-card" style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
        <div className="emp-avatar" style={{ width: 64, height: 64, fontSize: 20 }}>{profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{profile?.full_name || profile?.email?.split('@')[0]}</h2>
          <div style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>{profile?.designation || 'Employee'} · {profile?.emp_code || ''}</div>
        </div>
        {!editingProfile && (
          <button onClick={() => { setEditName(profile?.full_name || ''); setEditMobile(profile?.mobile_no || ''); setEditDept(profile?.department || ''); setEditDesig(profile?.designation || ''); setEditingProfile(true); }} style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Edit Profile
          </button>
        )}
      </div>

      {editingProfile ? (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!profile) return;
          try {
            const body = { full_name: editName, mobile_no: editMobile };
            if (role === 'ADMIN' || role === 'HR') {
              body.department = editDept;
              body.designation = editDesig;
            }
            const res = await fetch(`${API}/profile`, {
              method: 'PUT',
              headers: { ...auth(), 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
            setProfile({ ...profile, full_name: editName, mobile_no: editMobile, department: editDept, designation: editDesig });
            setEditingProfile(false);
          } catch (err) {
            alert(err.message);
          }
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Email</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.email || '—'}</span></div>
            <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Employee Code</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.emp_code || '—'}</span></div>
            <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Full Name</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} required style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} /></div>
            <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Mobile</label><input type="text" value={editMobile} onChange={e => setEditMobile(e.target.value)} required style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} /></div>
            <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Role</label><span style={{ fontSize: 14, color: '#2563eb', fontWeight: 600 }}>{profile?.role || 'Employee'}</span></div>
            {(role === 'ADMIN' || role === 'HR') ? (
              <><div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Department</label><input type="text" value={editDept} onChange={e => setEditDept(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} /></div>
              <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Designation</label><input type="text" value={editDesig} onChange={e => setEditDesig(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} /></div></>
            ) : (
              <><div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Department</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.department || '—'}</span></div>
              <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Designation</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.designation || '—'}</span></div></>
            )}
            <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Joined On</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.created_on ? new Date(profile.created_on).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
            {profile?.last_login && <div><label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Last Login</label><span style={{ fontSize: 14, color: '#0f172a' }}>{new Date(profile.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>}
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button type="submit" style={{ padding: '10px 28px', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Save Changes</button>
            <button type="button" onClick={() => setEditingProfile(false)} style={{ padding: '10px 28px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div><label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Email</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.email || '—'}</span></div>
          <div><label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Mobile</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.mobile_no || '—'}</span></div>
          <div><label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Role</label><span style={{ fontSize: 14, color: '#2563eb', fontWeight: 600 }}>{profile?.role || 'Employee'}</span></div>
          <div><label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Department</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.department || '—'}</span></div>
          <div><label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Designation</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.designation || '—'}</span></div>
          <div><label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Employee Code</label><span style={{ fontSize: 14, color: '#0f172a' }}>{profile?.emp_code || '—'}</span></div>
          {profile?.created_on && <div><label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Joined On</label><span style={{ fontSize: 14, color: '#0f172a' }}>{new Date(profile.created_on).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>}
          {profile?.last_login && <div><label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Last Login</label><span style={{ fontSize: 14, color: '#0f172a' }}>{new Date(profile.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>}
        </div>
      )}
      {profile?.role === 'USER' && <DetailsCard profile={profile} setProfile={setProfile} />}
    </div>
  );
}
