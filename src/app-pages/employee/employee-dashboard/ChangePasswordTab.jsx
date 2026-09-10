import React, { useState } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export default function ChangePasswordTab() {
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpMsg, setCpMsg] = useState('');
  const [cpErr, setCpErr] = useState('');
  const [cpSending, setCpSending] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setCpMsg('');
    setCpErr('');
    if (cpNew.length < 8) { setCpErr('New password must be at least 8 characters'); return; }
    if (cpNew !== cpConfirm) { setCpErr('Confirm password does not match'); return; }
    setCpSending(true);
    try {
      const res = await fetch(`${API}/change-password`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: cpCurrent, new_password: cpNew }),
      });
      const data = await res.json();
      if (res.ok) {
        setCpMsg('Password changed successfully');
        setCpCurrent('');
        setCpNew('');
        setCpConfirm('');
      } else {
        setCpErr(data.detail || 'Failed to change password');
      }
    } catch {
      setCpErr('Cannot connect to server');
    } finally {
      setCpSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="emp-card" style={{ padding: 32, maxWidth: 520, width: '100%' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Change Password</h2>
        {cpMsg && <div style={{ padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 13, marginBottom: 16 }}>{cpMsg}</div>}
        {cpErr && <div style={{ padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{cpErr}</div>}
        <form onSubmit={handleChangePassword}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Current Password</label>
            <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required placeholder="Enter current password" style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>New Password</label>
            <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} required placeholder="Min 8 characters" style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Confirm New Password</label>
            <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} required placeholder="Re-enter new password" style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          </div>
          <button type="submit" disabled={cpSending} style={{ padding: '10px 28px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{cpSending ? 'Updating...' : 'Update Password'}</button>
        </form>
      </div>
    </div>
  );
}
