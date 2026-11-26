import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField, SaveButton } from './shared';

export default function InterviewSettings({ saving, setSaving }) {
  const [form, setForm] = useState({ default_interview_duration: '30', default_platform: 'Google Meet', reminder_time: '24', office_address: '', office_map_link: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/settings/system`, { headers: auth() }).then(r => r.json()).then(d => {
      if (d.default_interview_duration) setForm({ default_interview_duration: d.default_interview_duration, default_platform: d.default_platform || 'Google Meet', reminder_time: d.reminder_time || '24', office_address: d.office_address || '', office_map_link: d.office_map_link || '' });
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
    <SettingsCard title="Interview Settings" desc="Configure default interview parameters">
      <div className="settings-grid">
        <FormField label="Default Interview Duration (min)"><select className="settings-input" value={form.default_interview_duration} onChange={e => setForm(f => ({ ...f, default_interview_duration: e.target.value }))}><option value="15">15 Minutes</option><option value="30">30 Minutes</option><option value="45">45 Minutes</option><option value="60">60 Minutes</option><option value="90">90 Minutes</option></select></FormField>
        <FormField label="Default Platform"><select className="settings-input" value={form.default_platform} onChange={e => setForm(f => ({ ...f, default_platform: e.target.value }))}><option value="Google Meet">Google Meet</option><option value="Zoom">Zoom</option><option value="Microsoft Teams">Microsoft Teams</option><option value="Skype">Skype</option><option value="Phone">Phone</option><option value="In-Person">In-Person</option></select></FormField>
        <FormField label="Reminder Time (hours before)"><select className="settings-input" value={form.reminder_time} onChange={e => setForm(f => ({ ...f, reminder_time: e.target.value }))}><option value="1">1 Hour Before</option><option value="2">2 Hours Before</option><option value="4">4 Hours Before</option><option value="12">12 Hours Before</option><option value="24">24 Hours Before</option><option value="48">48 Hours Before</option></select></FormField>
        <FormField label="Office address (for in-person interviews)" fullWidth><textarea className="settings-input" rows={2} value={form.office_address} onChange={e => setForm(f => ({ ...f, office_address: e.target.value }))} placeholder="Floor, building, street, city" style={{ resize: 'vertical', fontFamily: 'inherit' }} /></FormField>
        <FormField label="Google Maps link of the office" fullWidth><input className="settings-input" type="url" value={form.office_map_link} onChange={e => setForm(f => ({ ...f, office_map_link: e.target.value }))} placeholder="https://maps.app.goo.gl/..." /></FormField>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>Write <b>{'{OFFICE_ADDRESS}'}</b> and <b>{'{OFFICE_MAP_LINK}'}</b> in an email template (Settings &gt; Template Management). The Google Maps link goes into the mail as a link the candidate can click.</p>
      <div className="settings-actions"><SaveButton onClick={save} saving={saving} /></div>
    </SettingsCard>
  );
}
