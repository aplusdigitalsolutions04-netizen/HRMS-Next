import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField, SaveButton } from './shared';

export default function AttendanceSettings({ saving, setSaving }) {
  const [form, setForm] = useState({ office_start_time: '09:00', office_end_time: '18:00', grace_period: '15', half_day_threshold: '4', overtime_threshold: '8' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/settings/system`, { headers: auth() }).then(r => r.json()).then(d => {
      if (d.office_start_time) setForm({ office_start_time: d.office_start_time, office_end_time: d.office_end_time, grace_period: d.grace_period || '15', half_day_threshold: d.half_day_threshold || '4', overtime_threshold: d.overtime_threshold || '8' });
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
    <>
    <SettingsCard title="Attendance Settings" desc="Configure office hours and attendance rules">
      <div className="settings-grid">
        <FormField label="Office Start Time"><input type="time" className="settings-input" value={form.office_start_time} onChange={e => setForm(f => ({ ...f, office_start_time: e.target.value }))} /></FormField>
        <FormField label="Office End Time"><input type="time" className="settings-input" value={form.office_end_time} onChange={e => setForm(f => ({ ...f, office_end_time: e.target.value }))} /></FormField>
        <FormField label="Grace Period (minutes)"><input type="number" className="settings-input" value={form.grace_period} onChange={e => setForm(f => ({ ...f, grace_period: e.target.value }))} /></FormField>
        <FormField label="Half Day Threshold (hours)"><input type="number" className="settings-input" value={form.half_day_threshold} onChange={e => setForm(f => ({ ...f, half_day_threshold: e.target.value }))} /></FormField>
        <FormField label="Overtime Threshold (hours)"><input type="number" className="settings-input" value={form.overtime_threshold} onChange={e => setForm(f => ({ ...f, overtime_threshold: e.target.value }))} /></FormField>
      </div>
      <div className="settings-actions"><SaveButton onClick={save} saving={saving} /></div>
    </SettingsCard>
    <TeamOfficeSettings saving={saving} setSaving={setSaving} />
    </>
  );
}

function TeamOfficeSettings({ saving, setSaving }) {
  const [form, setForm] = useState({ teamoffice_api_url: '', teamoffice_corp_id: '', teamoffice_username: '', teamoffice_password: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/settings/teamoffice`, { headers: auth() }).then(r => r.json()).then(d => {
      if (d && d.teamoffice_username !== undefined) setForm(d);
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/teamoffice`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      Swal.fire({ icon: 'success', title: 'Saved!', text: 'TeamOffice settings updated.', timer: 1500, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <SettingsCard title="TeamOffice (E-TimeOffice) Integration" desc="Credentials used to sync attendance punch data from TeamOffice">
      <div className="settings-grid">
        <FormField label="API URL (optional)"><input className="settings-input" placeholder="https://api.etimeoffice.com/api" value={form.teamoffice_api_url || ''} onChange={e => setForm(f => ({ ...f, teamoffice_api_url: e.target.value }))} /></FormField>
        <FormField label="Corp ID"><input className="settings-input" value={form.teamoffice_corp_id || ''} onChange={e => setForm(f => ({ ...f, teamoffice_corp_id: e.target.value }))} /></FormField>
        <FormField label="Username"><input className="settings-input" value={form.teamoffice_username || ''} onChange={e => setForm(f => ({ ...f, teamoffice_username: e.target.value }))} /></FormField>
        <FormField label="Password"><input type="password" className="settings-input" value={form.teamoffice_password || ''} onChange={e => setForm(f => ({ ...f, teamoffice_password: e.target.value }))} /></FormField>
      </div>
      <div className="settings-actions"><SaveButton onClick={save} saving={saving} /></div>
    </SettingsCard>
  );
}
