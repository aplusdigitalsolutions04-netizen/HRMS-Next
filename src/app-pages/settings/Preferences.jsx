import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useLang } from '@/lib/i18n';
import { InstallCard } from '../../app/layout-parts/InstallApp';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

// the dashboard cards a person can hide (key = data-w on the card in Dashboard.jsx)
export const DASH_WIDGETS = [
  { key: 'quick_actions', label: 'Quick action buttons' },
  { key: 'today_attendance', label: "Today's Attendance" },
  { key: 'leave_trends', label: 'Leave Trends' },
  { key: 'recent_activities', label: 'Recent Activities' },
  { key: 'birthdays', label: 'Birthdays' },
  { key: 'needs_attention', label: 'Needs Your Attention' },
  { key: 'interviews', label: 'Upcoming Interviews' },
  { key: 'attendance_overview', label: 'Attendance Overview (month)' },
  { key: 'hiring_pipeline', label: 'Hiring Pipeline' },
  { key: 'headcount', label: 'Headcount by Department' },
  { key: 'new_hires', label: 'New Hires' },
  { key: 'out_of_office', label: 'Out of Office Today' },
  { key: 'anniversaries', label: 'Work Anniversaries' },
  { key: 'holidays', label: 'Upcoming Holidays' },
];

// My Preferences: language, which notifications I want, and (HR side) which dashboard cards I see.
export default function Preferences() {
  const { lang, setLang } = useLang();
  const isEmployee = sessionStorage.getItem('role') === 'USER';
  const [groups, setGroups] = useState([]);
  const [prefs, setPrefs] = useState({ lang, notif_muted: [], dashboard_hidden: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/preferences`, { headers: auth() }).then(r => r.json())
      .then(d => { if (d.prefs) setPrefs(d.prefs); setGroups(d.groups || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (field, key) => setPrefs(p => ({ ...p, [field]: p[field].includes(key) ? p[field].filter(k => k !== key) : [...p[field], key] }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/preferences`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ notif_muted: prefs.notif_muted, dashboard_hidden: prefs.dashboard_hidden }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1300, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setSaving(false); }
  };

  const card = { background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, padding: 16, marginBottom: 14 };
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid #f4f6fa' };
  const Switch = ({ on, onChange, label }) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
      style={{ width: 40, height: 22, borderRadius: 20, border: 'none', background: on ? '#2563eb' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background-color .15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </button>
  );

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;

  return (
    <div style={{ width: '100%' }}>
      <div className="ph">
        <div>
          <h1>My Preferences</h1>
          <p>These settings are only for you.</p>
        </div>
        <div className="ph-actions"><button className="btn-p" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 4px', fontSize: '.95rem' }}>Language</h3>
        <p style={{ margin: '0 0 10px', fontSize: '.82rem', color: '#64748b' }}>Menus, buttons and headings are shown in Hindi when you choose हिन्दी. Names and your data stay as they are. It applies immediately.</p>
        <div style={{ display: 'flex', gap: 8 }} data-no-translate>
          {[['en', 'English'], ['hi', 'हिन्दी']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setLang(k)} aria-pressed={lang === k}
              style={{ padding: '8px 18px', borderRadius: 20, border: '1px solid ' + (lang === k ? '#2563eb' : '#e2e8f0'), background: lang === k ? '#2563eb' : '#fff', color: lang === k ? '#fff' : '#475569', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      </div>

      <InstallCard card={card} />

      <div style={card}>
        <h3 style={{ margin: '0 0 4px', fontSize: '.95rem' }}>Notifications</h3>
        <p style={{ margin: '0 0 6px', fontSize: '.82rem', color: '#64748b' }}>Switch off the groups you do not want to see in the bell and the Notifications page.</p>
        {groups.filter(g => !(isEmployee && ['payroll'].includes(g.key))).map(g => (
          <div key={g.key} style={row}>
            <div><div style={{ fontWeight: 600, fontSize: '.88rem', color: '#0f172a' }}>{g.label}</div><div style={{ fontSize: '.76rem', color: '#94a3b8' }}>{g.hint}</div></div>
            <Switch on={!prefs.notif_muted.includes(g.key)} onChange={() => toggle('notif_muted', g.key)} label={g.label} />
          </div>
        ))}
      </div>

      {!isEmployee && (
        <div style={card} id="dashboard">
          <h3 style={{ margin: '0 0 4px', fontSize: '.95rem' }}>Dashboard</h3>
          <p style={{ margin: '0 0 6px', fontSize: '.82rem', color: '#64748b' }}>Choose which cards you want on your dashboard. Cards you are not allowed to see because of your role never appear, whatever you pick.</p>
          {DASH_WIDGETS.map(w => (
            <div key={w.key} style={row}>
              <span style={{ fontWeight: 600, fontSize: '.88rem', color: '#0f172a' }}>{w.label}</span>
              <Switch on={!prefs.dashboard_hidden.includes(w.key)} onChange={() => toggle('dashboard_hidden', w.key)} label={w.label} />
            </div>
          ))}
          <button type="button" className="btn-reset" style={{ marginTop: 10 }} onClick={() => setPrefs(p => ({ ...p, dashboard_hidden: [] }))}>Show everything</button>
        </div>
      )}
    </div>
  );
}
