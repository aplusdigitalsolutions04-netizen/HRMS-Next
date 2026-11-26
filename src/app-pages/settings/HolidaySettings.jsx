import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField } from './shared';
import Pagination, { paginate } from '../shared/Pagination';

const fmt = (d) => {
  const [y, m, dd] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, dd);
  return `${dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} (${dt.toLocaleDateString('en-US', { weekday: 'short' })})`;
};

export default function HolidaySettings() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // keep the page valid when the year changes or a holiday is removed
  useEffect(() => { setPage(p => Math.min(p, Math.max(1, Math.ceil(holidays.length / pageSize)))); }, [holidays.length, pageSize]);
  const [form, setForm] = useState({ date: '', name: '', holiday_type: 'Government', in_sandwich: true });

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
    if (await post(form, 'Holiday added')) setForm({ date: '', name: '', holiday_type: form.holiday_type, in_sandwich: form.in_sandwich });
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
      desc="Government and company holidays. If an employee works on a holiday (or a weekly off) it is recorded as Extra Work (EW) and paid on the payslip. &quot;Counts in sandwich leave&quot; says whether the holiday becomes a leave day when an employee is on leave the day before and after it (it works only while Sandwich leave and Count holidays are on in Attendance Settings)."
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
        <FormField label="Counts in sandwich leave?">
          <select className="settings-input" value={form.in_sandwich ? '1' : '0'} onChange={e => setForm(f => ({ ...f, in_sandwich: e.target.value === '1' }))} title="Yes: if an employee is on leave the day before and the day after, this holiday also counts as a leave day. No: it never does.">
            <option value="1">Yes</option><option value="0">No</option>
          </select>
        </FormField>
        <div><button className="btn-premium" onClick={add}>+ Add holiday</button></div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 18 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
            <th style={{ padding: '8px 10px', width: 44 }}>#</th><th style={{ padding: '8px 10px' }}>Date</th><th>Holiday</th><th>Type</th><th title="Does this holiday count as a leave day when it falls between leave days?">In sandwich leave</th><th></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr>
          ) : holidays.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No holidays added for {year}.</td></tr>
          ) : paginate(holidays, page, pageSize).map((h, idx) => (
            <tr key={h.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px', color: '#94a3b8', fontSize: 13 }}>{(page - 1) * pageSize + idx + 1}</td>
              <td style={{ padding: '10px' }}>{fmt(h.holiday_date)}</td>
              <td style={{ fontWeight: 600 }}>{h.name}</td>
              <td>{h.holiday_type}</td>
              <td>
                <select className="settings-input" style={{ width: 90, padding: '4px 8px' }} value={Number(h.in_sandwich) === 0 ? '0' : '1'} aria-label={`Counts in sandwich leave: ${h.name}`} onChange={async e => {
                  const v = e.target.value === '1';
                  const res = await fetch(`${API}/settings/holidays`, { method: 'PATCH', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: h.id, in_sandwich: v }) });
                  if (res.ok) setHolidays(list => list.map(x => (x.id === h.id ? { ...x, in_sandwich: v ? 1 : 0 } : x)));
                  else { const d = await res.json().catch(() => ({})); Swal.fire({ icon: 'error', title: 'Not saved', text: d.detail || 'Could not save' }); }
                }}><option value="1">Yes</option><option value="0">No</option></select>
              </td>
              <td style={{ textAlign: 'right' }}><button onClick={() => remove(h)} style={{ border: 'none', background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalItems={holidays.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="holidays" />
    </SettingsCard>
  );
}
