import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const [emailAccount, setEmailAccount] = useState(null);
  const [emailForm, setEmailForm] = useState({ sender_email: '', app_password: '', sender_name: '', smtp_host: 'smtp.gmail.com', smtp_port: 587, encryption: 'TLS' });
  const [editingEmail, setEditingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => { fetchProfile(); fetchEmailAccount(); }, []);

  const fetchEmailAccount = () => {
    fetch(`${API}/settings/my-email-account`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        setEmailAccount(d);
        if (d) setEmailForm({
          sender_email: d.sender_email || '',
          app_password: '',
          sender_name: d.sender_name || '',
          smtp_host: d.smtp_host || 'smtp.gmail.com',
          smtp_port: d.smtp_port || 587,
          encryption: d.encryption || 'TLS',
        });
      })
      .catch(() => {});
  };

  const handleEmailChange = (e) => {
    const { name, value } = e.target;
    setEmailForm({ ...emailForm, [name]: name === 'smtp_port' ? parseInt(value) || '' : value });
  };

  const handleSaveEmailAccount = () => {
    if (!emailForm.sender_email || !emailForm.app_password) return;
    setSavingEmail(true);
    fetch(`${API}/settings/my-email-account`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(emailForm),
    })
      .then(r => { if (r.ok) { setEditingEmail(false); fetchEmailAccount(); } })
      .finally(() => setSavingEmail(false));
  };

  const testEmailConnection = () => {
    setTestingEmail(true);
    fetch(`${API}/settings/my-email-account/test`, { method: 'POST', headers: auth() })
      .then(async r => {
        const d = await r.json();
        Swal.fire({ icon: r.ok ? 'success' : 'error', title: r.ok ? 'Connected!' : 'Failed', text: (r.ok ? d.message : d.detail) || '' });
      })
      .catch(e => Swal.fire({ icon: 'error', title: 'Error', text: e.message }))
      .finally(() => setTestingEmail(false));
  };

  const handleRemoveEmailAccount = () => {
    if (!window.confirm('Disconnect this email account? Emails you send will go back to using the shared company account.')) return;
    fetch(`${API}/settings/my-email-account`, { method: 'DELETE', headers: auth() })
      .then(() => { setEmailAccount(null); setEmailForm({ sender_email: '', app_password: '', sender_name: '' }); setEditingEmail(false); });
  };

  const fetchProfile = () => {
    setLoading(true);
    fetch(`${API}/profile`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        setProfile(d);
        setForm({
          full_name: d.full_name || '',
          mobile_no: d.mobile_no || '',
          role: d.role || '',
          department: d.department || '',
          designation: d.designation || '',
          profile_photo: d.profile_photo || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm(f => ({ ...f, profile_photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setSaving(true);
    fetch(`${API}/profile`, {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then(r => {
        if (r.ok) {
          setEditing(false);
          fetchProfile();
          window.dispatchEvent(new Event('profile-updated'));
        }
      })
      .finally(() => setSaving(false));
  };

  if (loading) return (
    <div className="profile-loading">
      <style>{`
        .profile-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }
        .profile-loading::after {
          content: '';
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );

  if (!profile) return (
    <div className="profile-page">
      <p style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontWeight: 500 }}>
        Could not load profile. Try logging in again.
      </p>
    </div>
  );

  return (
    <div className="profile-page">
      <style>{`
        .profile-page {
          max-width: 800px;
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
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
        }
        .profile-avatar-large {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.15);
          overflow: hidden;
          border: 3px solid white;
        }
        .profile-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .profile-avatar-large svg {
          color: white;
        }
        .profile-header h2 {
          font-size: 1.8rem;
          color: var(--text-main);
          margin-bottom: 0.25rem;
        }
        .profile-role-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 50px;
          background: var(--primary-light);
          color: var(--primary);
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-family: 'Outfit', sans-serif;
        }
        .profile-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
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
        .profile-field span {
          font-size: 1rem;
          color: var(--text-main);
          font-weight: 500;
          padding: 10px 14px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid var(--border);
          min-height: 45px;
          display: flex;
          align-items: center;
        }
        .profile-field input {
          width: 100%;
          padding: 10px 14px;
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
        .profile-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }
        @media (max-width: 600px) {
          .profile-details {
            grid-template-columns: 1fr;
          }
          .profile-header {
            flex-direction: column;
            text-align: center;
            align-items: center;
          }
        }
      `}</style>

      <div className="profile-card glass-card">
        <div className="profile-header">
          <div className="profile-avatar-large">
            {profile.profile_photo
              ? <img src={profile.profile_photo} alt="Profile" />
              : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          <div>
            <h2>{profile.full_name || profile.email}</h2>
            <span className="profile-role-badge">{profile.role || 'User'}</span>
          </div>
        </div>

        {!editing ? (
          <>
            <div className="profile-details">
              <div className="profile-field"><label>Email</label><span>{profile.email}</span></div>
              <div className="profile-field"><label>Mobile</label><span>{profile.mobile_no || '—'}</span></div>
              {profile.emp_code && <div className="profile-field"><label>Employee Code</label><span>{profile.emp_code}</span></div>}
              <div className="profile-field"><label>Role</label><span>{profile.role || '—'}</span></div>
              <div className="profile-field"><label>Department</label><span>{profile.department || '—'}</span></div>
              <div className="profile-field"><label>Designation</label><span>{profile.designation || '—'}</span></div>
              {profile.last_login && (
                <div className="profile-field" style={{ gridColumn: '1 / -1' }}><label>Last Login</label><span>{new Date(profile.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
              )}
            </div>
            <button className="btn-premium" onClick={() => setEditing(true)}>Edit Profile</button>
          </>
        ) : (
          <>
            <div className="profile-field" style={{ marginBottom: '1rem' }}>
              <label>Profile Photo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                {form.profile_photo && (
                  <img src={form.profile_photo} alt="Preview" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border, #e2e8f0)' }} />
                )}
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </div>
            </div>
            <div className="profile-details">
              <div className="profile-field">
                <label>Full Name</label>
                <input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Full Name" />
              </div>
              <div className="profile-field">
                <label>Mobile</label>
                <input name="mobile_no" value={form.mobile_no} onChange={handleChange} placeholder="Mobile Number" />
              </div>
              <div className="profile-field">
                <label>Role</label>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{profile.role || '—'}</span>
              </div>
              <div className="profile-field">
                <label>Department</label>
                <input name="department" value={form.department} onChange={handleChange} placeholder="Department" />
              </div>
              <div className="profile-field">
                <label>Designation</label>
                <input name="designation" value={form.designation} onChange={handleChange} placeholder="Designation" />
              </div>
            </div>
            <div className="profile-actions">
              <button className="btn-premium" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-premium-outline" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        )}
      </div>

      <div className="profile-card glass-card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>📧 My Email Account</h3>
            <p style={{ margin: '4px 0 0', fontSize: '.85rem', color: 'var(--text-muted)' }}>
              Connect your own webmail (email + app password) so emails you send use your own address instead of the shared company account.
            </p>
          </div>
        </div>

        {!editingEmail ? (
          emailAccount ? (
            <>
              <div className="profile-details">
                <div className="profile-field"><label>Sender Email</label><span>{emailAccount.sender_email}</span></div>
                <div className="profile-field"><label>Sender Name</label><span>{emailAccount.sender_name || '—'}</span></div>
                <div className="profile-field"><label>SMTP Host</label><span>{emailAccount.smtp_host || 'smtp.gmail.com'}:{emailAccount.smtp_port || 587} ({emailAccount.encryption || 'TLS'})</span></div>
              </div>
              <div className="profile-actions">
                <button className="btn-premium" onClick={() => setEditingEmail(true)}>Update</button>
                <button className="btn-premium-outline" onClick={testEmailConnection} disabled={testingEmail}>
                  {testingEmail ? 'Testing...' : '🔌 Test Connection'}
                </button>
                <button className="btn-premium-outline" onClick={handleRemoveEmailAccount}>Disconnect</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', margin: '0 0 1rem' }}>No personal email account connected — emails you send currently use the shared company account.</p>
              <button className="btn-premium" onClick={() => setEditingEmail(true)}>+ Connect Email Account</button>
            </>
          )
        ) : (
          <>
            <div className="profile-details">
              <div className="profile-field">
                <label>Sender Email</label>
                <input name="sender_email" type="email" value={emailForm.sender_email} onChange={handleEmailChange} placeholder="you@gmail.com" />
              </div>
              <div className="profile-field">
                <label>App Password</label>
                <input name="app_password" type="password" value={emailForm.app_password} onChange={handleEmailChange} placeholder="16-character app password" />
              </div>
              <div className="profile-field">
                <label>Display Name (optional)</label>
                <input name="sender_name" value={emailForm.sender_name} onChange={handleEmailChange} placeholder="Your Name" />
              </div>
              <div className="profile-field">
                <label>SMTP Host</label>
                <input name="smtp_host" value={emailForm.smtp_host} onChange={handleEmailChange} placeholder="smtp.gmail.com" />
              </div>
              <div className="profile-field">
                <label>SMTP Port</label>
                <input name="smtp_port" type="number" value={emailForm.smtp_port} onChange={handleEmailChange} placeholder="587" />
              </div>
              <div className="profile-field">
                <label>Encryption</label>
                <select name="encryption" value={emailForm.encryption} onChange={handleEmailChange}>
                  <option value="TLS">TLS</option>
                  <option value="SSL">SSL</option>
                </select>
              </div>
            </div>
            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              Most providers reject your regular login password for sending mail — use an <strong>App Password</strong> instead (for Gmail: Google Account → Security → App Passwords). If your email isn't Gmail, set the correct SMTP Host/Port for your provider (e.g. your company's mail server) — it defaults to Gmail's otherwise.
            </p>
            <div className="profile-actions">
              <button className="btn-premium" onClick={handleSaveEmailAccount} disabled={savingEmail || !emailForm.sender_email || !emailForm.app_password}>{savingEmail ? 'Saving...' : 'Save'}</button>
              <button className="btn-premium-outline" onClick={() => { setEditingEmail(false); if (emailAccount) setEmailForm({ sender_email: emailAccount.sender_email, app_password: '', sender_name: emailAccount.sender_name || '', smtp_host: emailAccount.smtp_host || 'smtp.gmail.com', smtp_port: emailAccount.smtp_port || 587, encryption: emailAccount.encryption || 'TLS' }); }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
