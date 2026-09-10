import React, { useState } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPass.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (newPass !== confirm) { setError('Confirm password does not match'); return; }

    setSending(true);
    try {
      const res = await fetch(`${API}/change-password`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: newPass }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Password changed successfully');
        setCurrent('');
        setNewPass('');
        setConfirm('');
      } else {
        setError(data.detail || 'Failed to change password');
      }
    } catch {
      setError('Cannot connect to server');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="profile-page">
      <style>{`
        .profile-page {
          max-width: 500px;
          margin: 2rem auto;
          padding: 0 1rem;
          animation: fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .profile-card {
          padding: 2.5rem;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .profile-header {
          margin-bottom: 2rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .profile-header h2 {
          font-size: 1.8rem;
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
        }
        .change-password-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .profile-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .profile-field label {
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          color: var(--text-muted);
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .profile-field input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          background: #f8fafc;
          color: var(--text-main);
          font-size: 1rem;
          transition: all 0.2s ease;
          outline: none;
        }
        .profile-field input:focus {
          background: #ffffff;
          border-color: var(--primary);
          box-shadow: 0 0 0 4px var(--primary-light);
        }
        .alert-success {
          background: rgba(16, 185, 129, 0.1);
          color: var(--success);
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .alert-danger {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
      `}</style>

      <div className="profile-card glass-card">
        <div className="profile-header">
          <h2>Change Password</h2>
        </div>
        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-danger">{error}</div>}
        <form onSubmit={handleSubmit} className="change-password-form">
          <div className="profile-field">
            <label>Current Password</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required placeholder="Enter current password" />
          </div>
          <div className="profile-field">
            <label>New Password</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required placeholder="Min 8 characters" />
          </div>
          <div className="profile-field">
            <label>Confirm New Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Re-enter new password" />
          </div>
          <button type="submit" className="btn-premium" disabled={sending}>{sending ? 'Updating...' : 'Update Password'}</button>
        </form>
      </div>
    </div>
  );
}
