import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField } from './shared';

const fmt = (d) => {
  const [y, m, dd] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, dd);
  return `${dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} (${dt.toLocaleDateString('en-US', { weekday: 'short' })})`;
};

export default function HolidaySettings() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: '', name: '', holiday_type: 'Government' });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/settings/holidays?year=${year}`, { headers: auth() })
      .then(r => r.json()).then(d => setHolidays(d.holidays || []))
      .finally(() => setLoading(false));
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const post = async (body, okMsg) => {
    try {
      const res = await fetch(`${API}/settings/holidays`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      Swal.fire({ icon: 'success', title: okMsg || d.message, timer: okMsg ? 1300 : undefined, showConfirmButton: !okMsg });
      load();
      return true;
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); return false; }
  };

  const add = async () => {
    if (await post(form, 'Holiday added')) setForm({ date: '', name: '', holiday_type: form.holiday_type });
  };

  const remove = async (h) => {
    const c = await Swal.fire({ icon: 'warning', title: `Remove ${h.name}?`, showCancelButton: true, confirmButtonText: 'Remove' });
    if (!c.isConfirmed) return;
    const res = await fetch(`${API}/settings/holidays?id=${h.id}`, { method: 'DELETE', headers: auth() });
    if (res.ok) load(); else Swal.fire({ icon: 'error', title: 'Error', text: 'Could not remove' });
  };

  return (
    <SettingsCard
      title="Holiday Calendar"
      desc="Government and company holidays. If an employee works on a holiday (or a weekly off) it is recorded as Extra Work (EW) and paid on the payslip."
      actions={
        <>
          <select className="settings-input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-premium" onClick={() => post({ preset: 'government', year })}>+ Add government holidays</button>
        </>
      }
    >
      <div className="settings-grid" style={{ alignItems: 'end' }}>
        <FormField label="Date"><input type="date" className="settings-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></FormField>
        <FormField label="Holiday name"><input className="settings-input" placeholder="e.g. Diwali" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></FormField>
        <FormField label="Type">
          <select className="settings-input" value={form.holiday_type} onChange={e => setForm(f => ({ ...f, holiday_type: e.target.value }))}>
            <option>Government</option><option>Company</option>
          </select>
        </FormField>
        <div><button className="btn-premium" onClick={add}>+ Add holiday</button></div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 18 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
            <th style={{ padding: '8px 10px' }}>Date</th><th>Holiday</th><th>Type</th><th></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr>
          ) : holidays.length === 0 ? (
            <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No holidays added for {year}.</td></tr>
          ) : holidays.map(h => (
            <tr key={h.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px' }}>{fmt(h.holiday_date)}</td>
              <td style={{ fontWeight: 600 }}>{h.name}</td>
              <td>{h.holiday_type}</td>
              <td style={{ textAlign: 'right' }}><button onClick={() => remove(h)} style={{ border: 'none', background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </SettingsCard>
  );
}
