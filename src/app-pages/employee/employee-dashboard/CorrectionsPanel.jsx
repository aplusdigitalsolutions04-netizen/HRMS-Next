import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';

const API = '/api';
import useLiveRefresh from '@/lib/live';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const fmt = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const TYPES = [['Missed punch', 'Missed punch'], ['Late coming', 'Late coming']];
const EMPTY = { request_type: 'Missed punch', attendance_date: '', in_time: '', out_time: '', reason: '' };

// Two kinds of request, both with a reason: "Missed punch" (the times you were in) and "Late coming" (the time you
// arrived). The reporting manager approves first, then HR. Approved missed punches correct that day's attendance.
// Managers also see their team's requests here.
export default function CorrectionsPanel({ prefillDate }) {
  const [list, setList] = useState([]);
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState({ ...EMPTY, attendance_date: prefillDate || '' });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState('');
  const late = form.request_type === 'Late coming';

  const load = useCallback(() => {
    fetch(`${API}/attendance/regularization`, { headers: auth() }).then(r => r.json()).then(d => setList(d.requests || [])).catch(() => {});
    fetch(`${API}/attendance/regularization?team=1`, { headers: auth() }).then(r => r.json()).then(d => setTeam(d.requests || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);
  useEffect(() => { if (prefillDate) setForm(f => ({ ...f, attendance_date: prefillDate })); }, [prefillDate]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(editId ? `${API}/attendance/regularization/${editId}` : `${API}/attendance/regularization`, { method: editId ? 'PUT' : 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not send the request');
      Swal.fire({ icon: 'success', title: editId ? 'Request updated' : 'Request sent', text: editId ? 'Your changes were sent to the person who is reviewing it.' : d.message + ' You will get a notification.', timer: 2400, showConfirmButton: false });
      setEditId(null);
      setForm({ ...EMPTY, request_type: form.request_type });
      load();
    } catch (err) { Swal.fire({ icon: 'error', title: 'Error', text: err.message }); }
    finally { setSaving(false); }
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setForm({ request_type: r.request_type, attendance_date: r.attendance_date, in_time: r.in_time || '', out_time: r.out_time || '', reason: r.reason || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const stopEdit = () => { setEditId(null); setForm({ ...EMPTY, request_type: form.request_type }); };

  const decide = async (r, action) => {
    let note = '';
    if (action === 'reject') {
      const x = await Swal.fire({ title: 'Reject this request?', input: 'text', inputPlaceholder: 'Reason (the employee will see it)', showCancelButton: true, confirmButtonText: 'Reject', confirmButtonColor: '#dc2626', inputValidator: v => (!v || !v.trim() ? 'Please write a reason' : null) });
      if (!x.isConfirmed) return;
      note = x.value.trim();
    } else {
      const x = await Swal.fire({ icon: 'question', title: 'Approve and send to HR?', showCancelButton: true, confirmButtonText: 'Approve', confirmButtonColor: '#2563eb' });
      if (!x.isConfirmed) return;
    }
    setBusy(r.id);
    try {
      const res = await fetch(`${API}/attendance/regularization/${r.id}`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      Swal.fire({ icon: 'success', title: d.message, timer: 1500, showConfirmButton: false });
      load();
    } catch (err) { Swal.fire({ icon: 'error', title: 'Error', text: err.message }); }
    finally { setBusy(''); }
  };

  const pill = (r) => {
    const s = r.status;
    const m = { Pending: ['#fffbeb', '#b45309'], Approved: ['#f0fdf4', '#15803d'], Rejected: ['#fef2f2', '#b91c1c'] }[s] || ['#f1f5f9', '#475569'];
    const text = s === 'Pending' ? (r.awaiting === 'MANAGER' ? 'With manager' : r.awaiting === 'HR' ? 'With HR' : 'Pending') : s;
    return <span style={{ background: m[0], color: m[1], padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</span>;
  };
  const when = (r) => (r.request_type === 'Late coming' ? `Arrived ${r.in_time}` : `${r.in_time} - ${r.out_time}`);
  const inp = { height: 36, padding: '0 11px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
  const lab = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 };
  const th = { textAlign: 'left', padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e8edf6' };
  const td = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid #f4f6fa' };

  return (
    <div>
      {team.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: '.9rem', background: '#fffbeb', color: '#92400e' }}>Waiting for your approval ({team.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Employee', 'Type', 'Date', 'Time', 'Reason', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {team.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}<div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{r.emp_code}</div></td>
                    <td style={td}>{r.request_type}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmt(r.attendance_date)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{when(r)}</td>
                    <td style={{ ...td, maxWidth: 260 }}>{r.reason}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button className="btn-p" style={{ height: 30, padding: '0 12px', marginRight: 6 }} disabled={busy === r.id} onClick={() => decide(r, 'approve')}>Approve</button>
                      <button className="btn-o" style={{ height: 30, padding: '0 12px', color: '#b91c1c' }} disabled={busy === r.id} onClick={() => decide(r, 'reject')}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 14, alignItems: 'start' }} className="corr-grid">
        <style>{`@media (max-width: 900px) { .corr-grid { grid-template-columns: 1fr !important; } }`}</style>
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {TYPES.map(([k, l]) => (
              <button key={k} type="button" onClick={() => !editId && setForm(f => ({ ...f, request_type: k }))} disabled={!!editId && form.request_type !== k} aria-pressed={form.request_type === k}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 20, border: '1px solid ' + (form.request_type === k ? '#2563eb' : '#e2e8f0'), background: form.request_type === k ? '#2563eb' : '#fff', color: form.request_type === k ? '#fff' : '#475569', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          {editId && <div style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>Editing your request <button type="button" onClick={stopEdit} style={{ float: 'right', border: 'none', background: 'none', color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }}>Cancel</button></div>}
          <h3 style={{ margin: '0 0 4px', fontSize: '.95rem' }}>{late ? 'Came late?' : 'Missed a punch?'}</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#64748b' }}>
            {late ? 'Tell the day, the time you arrived and why. Your reporting manager approves first, then HR.' : 'Tell the day and the times you were in. Your reporting manager approves first, then HR. Once approved, that day\'s attendance is corrected.'}
          </p>
          <div style={{ marginBottom: 10 }}><label style={lab}>Date</label><input type="date" style={inp} max={todayStr()} required value={form.attendance_date} onChange={e => setForm(f => ({ ...f, attendance_date: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label style={lab}>{late ? 'Arrived at' : 'In time'}</label><input type="time" style={inp} required value={form.in_time} onChange={e => setForm(f => ({ ...f, in_time: e.target.value }))} /></div>
            {!late && <div style={{ flex: 1 }}><label style={lab}>Out time</label><input type="time" style={inp} required value={form.out_time} onChange={e => setForm(f => ({ ...f, out_time: e.target.value }))} /></div>}
          </div>
          <div style={{ marginBottom: 12 }}><label style={lab}>Reason</label><textarea rows={3} style={{ ...inp, height: 'auto', padding: '8px 11px', resize: 'vertical' }} required placeholder={late ? 'e.g. Heavy traffic, bus was late' : 'e.g. Biometric was not working, forgot to punch out'} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
          <button type="submit" className="btn-p" disabled={saving} style={{ width: '100%' }}>{saving ? 'Sending...' : editId ? 'Save changes' : 'Send request'}</button>
        </form>

        <div style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: '.9rem', borderBottom: '1px solid #eef2f7' }}>My requests</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Date', 'Type', 'Time', 'Reason', 'Status', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: 26, color: '#94a3b8', fontSize: 13 }}>No requests yet.</td></tr>
                ) : list.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmt(r.attendance_date)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.request_type}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{when(r)}</td>
                    <td style={{ ...td, maxWidth: 240 }}>{r.reason}{r.review_note && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Note: {r.review_note}</div>}</td>
                    <td style={td}>{pill(r)}</td>
                    <td style={td}>{Number(r.can_edit) === 1 && <button type="button" className="btn-o" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => startEdit(r)}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
