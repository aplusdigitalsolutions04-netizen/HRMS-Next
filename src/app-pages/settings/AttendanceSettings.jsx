import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField, SaveButton } from './shared';
import { appLocale } from '@/lib/app-config-client';

// one rule of the Sandwich / CL blocks: a name, the control, and a line saying what it does
function Rule({ label, hint, children }) {
  return (
    <div className="rule-item">
      <div className="rule-label">{label}</div>
      <div className="rule-ctl">{children}</div>
      {hint && <div className="rule-hint">{hint}</div>}
    </div>
  );
}
// an on / off switch (the value is kept as '1' / '0' like the other settings)
function Switch({ on, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 46, height: 26, borderRadius: 20, border: 'none', padding: 3, cursor: disabled ? 'not-allowed' : 'pointer', background: on ? 'var(--brand)' : '#cbd5e1', opacity: disabled ? .5 : 1, transition: 'background .2s', display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  );
}

export default function AttendanceSettings({ saving, setSaving }) {
  const [form, setForm] = useState({ office_start_time: '09:00', office_end_time: '18:00', grace_period: '15', half_day_threshold: '4', overtime_threshold: '8', attendance_auto_sync: '1', attendance_sync_interval_minutes: '5', attendance_weekly_off_days: '0,6', cl_yearly_days: '12', cl_monthly_days: '1', sandwich_leave_on: '1', sandwich_min_days: '3', sandwich_weekoff: '1', sandwich_holiday: '1', cl_carry_forward: '0', cl_half_day_rule: 'cl', cl_after_months: '0', cl_max_per_leave: '0', cl_sandwich_uses_cl: '1' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState({ at: '', result: '' });

  useEffect(() => {
    fetch(`${API}/settings/system`, { headers: auth() }).then(r => r.json()).then(d => {
      setForm(f => ({
        ...f,
        ...(d.office_start_time ? { office_start_time: d.office_start_time, office_end_time: d.office_end_time, grace_period: d.grace_period || '15', half_day_threshold: d.half_day_threshold || '4', overtime_threshold: d.overtime_threshold || '8' } : {}),
        attendance_auto_sync: d.attendance_auto_sync === '0' ? '0' : '1',
        attendance_sync_interval_minutes: d.attendance_sync_interval_minutes || '5',
        cl_yearly_days: d.cl_yearly_days !== undefined && d.cl_yearly_days !== '' ? String(d.cl_yearly_days) : '12',
        cl_monthly_days: d.cl_monthly_days !== undefined && d.cl_monthly_days !== '' ? String(d.cl_monthly_days) : '1',
        sandwich_leave_on: d.sandwich_leave_on === '0' ? '0' : '1',
        cl_carry_forward: d.cl_carry_forward === '1' ? '1' : '0',
        cl_half_day_rule: d.cl_half_day_rule === 'unpaid' ? 'unpaid' : 'cl',
        cl_after_months: d.cl_after_months !== undefined && d.cl_after_months !== '' ? String(d.cl_after_months) : '0',
        cl_max_per_leave: d.cl_max_per_leave !== undefined && d.cl_max_per_leave !== '' ? String(d.cl_max_per_leave) : '0',
        cl_sandwich_uses_cl: d.cl_sandwich_uses_cl === '0' ? '0' : '1',
        sandwich_weekoff: d.sandwich_weekoff === '0' ? '0' : '1',
        sandwich_holiday: d.sandwich_holiday === '0' ? '0' : '1',
        sandwich_min_days: d.sandwich_min_days !== undefined && d.sandwich_min_days !== '' ? String(d.sandwich_min_days) : '3',
        attendance_weekly_off_days: d.attendance_weekly_off_days !== undefined && d.attendance_weekly_off_days !== null ? String(d.attendance_weekly_off_days) : '0,6',
      }));
      setLastSync({ at: d.attendance_last_sync_at || '', result: d.attendance_last_sync_result || '' });
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
    <style>{`
      .rule-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; }
      .rule-item { border:1px solid var(--brand-line); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:8px; background:rgba(255,255,255,.5); }
      .rule-label { font-size:13px; font-weight:700; color:#334155; }
      .rule-ctl .settings-input { max-width:160px; }
      .rule-hint { font-size:12px; color:#64748b; line-height:1.45; }
    `}</style>
    <SettingsCard title="Attendance Settings" desc="Configure office hours and attendance rules">
      <div className="settings-grid">
        <FormField label="Office Start Time"><input type="time" className="settings-input" value={form.office_start_time} onChange={e => setForm(f => ({ ...f, office_start_time: e.target.value }))} /></FormField>
        <FormField label="Office End Time"><input type="time" className="settings-input" value={form.office_end_time} onChange={e => setForm(f => ({ ...f, office_end_time: e.target.value }))} /></FormField>
        <FormField label="Grace Period (minutes)"><input type="number" className="settings-input" value={form.grace_period} onChange={e => setForm(f => ({ ...f, grace_period: e.target.value }))} /></FormField>
        <FormField label="Half Day Threshold (hours)"><input type="number" className="settings-input" value={form.half_day_threshold} onChange={e => setForm(f => ({ ...f, half_day_threshold: e.target.value }))} /></FormField>
        <FormField label="Overtime Threshold (hours)"><input type="number" className="settings-input" value={form.overtime_threshold} onChange={e => setForm(f => ({ ...f, overtime_threshold: e.target.value }))} /></FormField>
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Weekly off days</h4>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>
          These days are Week Off for everyone, whatever each person's TeamOffice roster says. If somebody punches in on one of them, it is counted as Extra Work.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((nm, i) => {
            const on = String(form.attendance_weekly_off_days).split(',').filter(x => x !== '').includes(String(i));
            return (
              <button key={nm} type="button" aria-pressed={on}
                onClick={() => setForm(f => {
                  const cur = String(f.attendance_weekly_off_days).split(',').filter(x => x !== '');
                  const next = on ? cur.filter(x => x !== String(i)) : [...cur, String(i)];
                  return { ...f, attendance_weekly_off_days: next.sort().join(',') };
                })}
                style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid ' + (on ? 'var(--brand)' : '#e2e8f0'), background: on ? 'var(--brand)' : '#fff', color: on ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {nm}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1.5px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 2px', fontSize: 15 }}>Sandwich leave</h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>When a leave is long enough, the weekly offs and holidays that fall between its leave days count as leave too. For example, leave on Thursday, Friday and Monday also makes Saturday and Sunday leave days. A shorter leave, a half day, and off days at the start or end of a leave are not counted.</p>
        <div className="rule-grid">
          <Rule label="Sandwich leave" hint="Switch it off to never count off days as leave."><Switch on={form.sandwich_leave_on === '1'} onChange={v => set('sandwich_leave_on', v ? '1' : '0')} /></Rule>
          <Rule label="Applies from (working days in the leave)" hint="For example with 3: a leave of 3 or more working days."><input type="number" min="1" max="31" className="settings-input" value={form.sandwich_min_days} onChange={e => set('sandwich_min_days', e.target.value)} /></Rule>
          <Rule label="Count weekly offs between leave days" hint="Saturday / Sunday (or whichever days are weekly off above)."><Switch on={form.sandwich_weekoff === '1'} onChange={v => set('sandwich_weekoff', v ? '1' : '0')} disabled={form.sandwich_leave_on !== '1'} /></Rule>
          <Rule label="Count holidays between leave days" hint="Holidays from the Holiday Calendar."><Switch on={form.sandwich_holiday === '1'} onChange={v => set('sandwich_holiday', v ? '1' : '0')} disabled={form.sandwich_leave_on !== '1'} /></Rule>
        </div>
      </div>

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1.5px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 2px', fontSize: 15 }}>Casual Leave (CL)</h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>When a leave is approved, its days use CL (paid) first and the rest become Unpaid Leave (UPL). For example with 1 CL a month, a 3-day leave is 1 CL + 2 UPL. These rules apply to leaves approved from now on; leaves already approved are not changed.</p>
        <div className="rule-grid">
          <Rule label="CL days in a month" hint="Earned every calendar month."><input type="number" min="0" max="31" step="0.5" className="settings-input" value={form.cl_monthly_days} onChange={e => set('cl_monthly_days', e.target.value)} /></Rule>
          <Rule label="CL days in a year" hint="Most CL in January to December. 0 means no yearly limit."><input type="number" min="0" max="366" step="0.5" className="settings-input" value={form.cl_yearly_days} onChange={e => set('cl_yearly_days', e.target.value)} /></Rule>
          <Rule label="CL can be used after (months from joining)" hint="0 means from the first day."><input type="number" min="0" max="60" className="settings-input" value={form.cl_after_months} onChange={e => set('cl_after_months', e.target.value)} /></Rule>
          <Rule label="Most CL days one leave can use" hint="The rest of the days become Unpaid Leave. 0 means no limit."><input type="number" min="0" max="366" step="0.5" className="settings-input" value={form.cl_max_per_leave} onChange={e => set('cl_max_per_leave', e.target.value)} /></Rule>
          <Rule label="Carry unused CL to later months" hint="On: with 1 CL a month and none used, March has 3 CL. Off: a month's CL is only for that month."><Switch on={form.cl_carry_forward === '1'} onChange={v => set('cl_carry_forward', v ? '1' : '0')} /></Rule>
          <Rule label="Half-day leave uses half a CL" hint="On: half CL when there is one, otherwise an unpaid Half Day. Off: always an unpaid Half Day."><Switch on={form.cl_half_day_rule === 'cl'} onChange={v => set('cl_half_day_rule', v ? 'cl' : 'unpaid')} /></Rule>
          <Rule label="Sandwich days can use CL" hint="On: CL first, then Unpaid Leave. Off: sandwich days are always Unpaid Leave."><Switch on={form.cl_sandwich_uses_cl === '1'} onChange={v => set('cl_sandwich_uses_cl', v ? '1' : '0')} /></Rule>
        </div>
      </div>
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1.5px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>Auto-sync check-in / check-out</h4>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
          When on, the server pulls today's punches from TeamOffice by itself, so check-in and check-out times show up in attendance without opening any page or pressing Sync.
        </p>
        <div className="settings-grid">
          <FormField label="Auto-sync">
            <select className="settings-input" value={form.attendance_auto_sync} onChange={e => setForm(f => ({ ...f, attendance_auto_sync: e.target.value }))}>
              <option value="1">On</option>
              <option value="0">Off</option>
            </select>
          </FormField>
          <FormField label="Sync every (minutes)">
            <input type="number" min="1" max="60" className="settings-input" value={form.attendance_sync_interval_minutes} onChange={e => setForm(f => ({ ...f, attendance_sync_interval_minutes: e.target.value }))} />
          </FormField>
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 6 }}>
          {lastSync.at
            ? <>Last auto-sync: <strong>{new Date(lastSync.at).toLocaleString(appLocale())}</strong> &middot; {lastSync.result}</>
            : 'No auto-sync has run yet. It starts a few seconds after the server starts.'}
        </div>
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
