import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField, SaveButton } from './shared';

export default function SMTPSettings({ saving, setSaving }) {
  const [form, setForm] = useState({ smtp_host: '', smtp_port: 587, sender_email: '', sender_name: '', app_password: '', encryption: 'TLS', default_cc_emails: '', default_bcc_emails: '' });
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch(`${API}/settings/smtp`, { headers: auth() }).then(r => r.json()).then(d => {
      if (d && d.smtp_host !== undefined) {
        setForm(d);
        setCcInput('');
        setBccInput('');
      }
    }).finally(() => setLoading(false));
  }, []);

  const ccEmails = () => (form.default_cc_emails || '').split(',').filter(Boolean);
  const bccEmails = () => (form.default_bcc_emails || '').split(',').filter(Boolean);

  const addEmail = (field, input, setInput) => {
    const email = input.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Swal.fire({ icon: 'warning', title: 'Invalid Email', text: `"${email}" is not a valid email address.` });
      return;
    }
    const current = (form[field] || '').split(',').filter(Boolean);
    if (current.includes(email)) {
      Swal.fire({ icon: 'warning', title: 'Duplicate', text: `"${email}" is already added.` });
      return;
    }
    current.push(email);
    setForm(f => ({ ...f, [field]: current.join(',') }));
    setInput('');
  };

  const removeEmail = (field, email) => {
    const current = (form[field] || '').split(',').filter(Boolean);
    setForm(f => ({ ...f, [field]: current.filter(e => e !== email).join(',') }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/smtp`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      Swal.fire({ icon: 'success', title: 'Saved!', text: 'SMTP settings updated.', timer: 1500, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    } finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${API}/settings/smtp/test`, { method: 'POST', headers: auth() });
      const d = await res.json();
      Swal.fire({ icon: res.ok ? 'success' : 'error', title: res.ok ? 'Connected!' : 'Failed', text: (res.ok ? d.message : d.detail) || '' });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    } finally { setTesting(false); }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <SettingsCard title="SMTP Settings" desc="Configure email sending for interview invitations, offer letters, etc.">
      <div className="settings-grid">
        <FormField label="SMTP Host"><input className="settings-input" value={form.smtp_host || ''} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} /></FormField>
        <FormField label="SMTP Port"><input type="number" className="settings-input" value={form.smtp_port || 587} onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) }))} /></FormField>
        <FormField label="Sender Email"><input className="settings-input" value={form.sender_email || ''} onChange={e => setForm(f => ({ ...f, sender_email: e.target.value }))} /></FormField>
        <FormField label="Sender Name"><input className="settings-input" value={form.sender_name || ''} onChange={e => setForm(f => ({ ...f, sender_name: e.target.value }))} /></FormField>
        <FormField label="App Password"><input type="password" className="settings-input" value={form.app_password || ''} onChange={e => setForm(f => ({ ...f, app_password: e.target.value }))} /></FormField>
        <FormField label="Encryption Type">
          <select className="settings-input" value={form.encryption || 'TLS'} onChange={e => setForm(f => ({ ...f, encryption: e.target.value }))}>
            <option value="TLS">TLS</option>
            <option value="SSL">SSL</option>
          </select>
        </FormField>
      </div>

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1.5px solid var(--border)' }}>
        <div className="settings-grid">
          <FormField label="Default CC Emails">
            <div className="email-chip-wrap">
              {ccEmails().map(email => (
                <span key={email} className="email-chip">
                  {email} <button className="chip-remove" onClick={() => removeEmail('default_cc_emails', email)}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="settings-input" style={{ flex: 1 }} value={ccInput} onChange={e => setCcInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail('default_cc_emails', ccInput, setCcInput); } }} placeholder="Type email and press Enter" />
              <button type="button" className="btn-premium" style={{ padding: '8px 16px', fontSize: '.8rem' }} onClick={() => addEmail('default_cc_emails', ccInput, setCcInput)}>+ Add</button>
            </div>
          </FormField>
          <FormField label="Default BCC Emails">
            <div className="email-chip-wrap">
              {bccEmails().map(email => (
                <span key={email} className="email-chip">
                  {email} <button className="chip-remove" onClick={() => removeEmail('default_bcc_emails', email)}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="settings-input" style={{ flex: 1 }} value={bccInput} onChange={e => setBccInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail('default_bcc_emails', bccInput, setBccInput); } }} placeholder="Type email and press Enter" />
              <button type="button" className="btn-premium" style={{ padding: '8px 16px', fontSize: '.8rem' }} onClick={() => addEmail('default_bcc_emails', bccInput, setBccInput)}>+ Add</button>
            </div>
          </FormField>
        </div>

      </div>

      <div className="settings-actions" style={{ marginTop: 24 }}>
        <SaveButton onClick={save} saving={saving} />
        <button className="btn-premium-outline" onClick={testConnection} disabled={testing} style={{ marginLeft: 12 }}>
          {testing ? 'Testing...' : '🔌 Test SMTP Connection'}
        </button>
      </div>
    </SettingsCard>
  );
}
