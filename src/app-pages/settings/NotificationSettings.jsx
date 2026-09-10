import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, SaveButton } from './shared';

export default function NotificationSettings({ saving, setSaving }) {
  const [form, setForm] = useState({ enable_email_notifications: 'true', enable_interview_reminders: 'true', enable_attendance_alerts: 'true', enable_candidate_updates: 'true' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/settings/system`, { headers: auth() }).then(r => r.json()).then(d => {
      if (d.enable_email_notifications) setForm(d);
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(form).map(([k, v]) => ({ setting_key: k, setting_value: v }));
      const res = await fetch(`${API}/settings/system`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      Swal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <SettingsCard title="Notification Settings" desc="Configure email and system notifications">
      <div className="notif-list">
        {[
          { key: 'enable_email_notifications', label: 'Enable Email Notifications' },
          { key: 'enable_interview_reminders', label: 'Enable Interview Reminders' },
          { key: 'enable_attendance_alerts', label: 'Enable Attendance Alerts' },
          { key: 'enable_candidate_updates', label: 'Enable Candidate Status Updates' },
        ].map(item => (
          <label key={item.key} className="notif-item">
            <input type="checkbox" className="notif-check" checked={form[item.key] === 'true'} onChange={e => setForm(f => ({ ...f, [item.key]: e.target.checked ? 'true' : 'false' }))} />
            <span className="notif-label">{item.label}</span>
          </label>
        ))}
      </div>
      <div className="settings-actions"><SaveButton onClick={save} saving={saving} /></div>
    </SettingsCard>
  );
}
