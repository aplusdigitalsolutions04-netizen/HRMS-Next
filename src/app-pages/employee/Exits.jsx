import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import Pagination from '../shared/Pagination';
import { appLocale, currencySymbol } from '@/lib/app-config-client';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const day = (v) => { try { return new Date(v + 'T00:00:00').toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; } };
const money = (v) => currencySymbol() + ' ' + Number(v || 0).toLocaleString(appLocale(), { maximumFractionDigits: 2 });
const STATUS_COLOR = { 'In Progress': ['#fffbeb', '#b45309'], Settled: ['var(--brand-soft)', 'var(--brand-dark)'], Completed: ['#f0fdf4', '#15803d'] };
const input = { padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.85rem', outline: 'none', background: '#fff', fontFamily: 'inherit', width: '100%' };
const lbl = { fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 };
const Badge = ({ s }) => { const c = STATUS_COLOR[s] || STATUS_COLOR['In Progress']; return <span style={{ background: c[0], color: c[1], padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{s}</span>; };

async function call(method, url, body) {
  const res = await fetch(url, { method, headers: { ...auth(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.detail || 'Could not save');
  return d;
}

// Exit and full & final: employees who are leaving, their checklist and the settlement of what is paid and recovered.
export default function Exits() {
  const [openId, setOpenId] = useState(null);
  const [data, setData] = useState({ exits: [], total: 0, counts: {}, reasons: [], statuses: [], settings: { notice_days: 30, el_rate: 1, notice_recovery: true } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const ready = useRef(false);

  const load = useCallback((p = 1, o = {}) => {
    setLoading(true); setError('');
    const q = { status, search, perPage: pageSize, ...o };
    const params = new URLSearchParams({ page: p, per_page: q.perPage });
    if (q.status) params.set('status', q.status);
    if (q.search) params.set('search', q.search);
    fetch(`${API}/exits?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setData(d); setPage(d.page || 1); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [status, search, pageSize]);
  useEffect(() => { load(1); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [search]);

  if (openId) return <Detail id={openId} onBack={() => { setOpenId(null); load(page); }} />;

  const chip = (key, label) => {
    const n = key ? (data.counts[key] || 0) : Object.values(data.counts).reduce((a, b) => a + b, 0);
    const on = status === key;
    return <button key={key || 'all'} onClick={() => { setStatus(key); load(1, { status: key }); }} style={{ border: '1px solid ' + (on ? 'var(--brand)' : '#e2e8f0'), background: on ? 'var(--brand)' : '#fff', color: on ? '#fff' : '#475569', padding: '6px 14px', borderRadius: 20, fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' }}>{label} ({n})</button>;
  };
  const cell = { padding: '9px 12px' };

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Exit &amp; Full and Final</h1>
          <p>When an employee leaves: the checklist, the notice period, and the full and final settlement (salary, EL, recoveries) with a statement as a PDF.</p>
        </div>
        <div className="ph-actions"><button className="btn-premium" onClick={() => setForm({ employee: null, q: '', people: [], resignation_date: '', last_working_day: '', reason: 'Resignation', notice_days: data.settings.notice_days })}>+ Start an exit</button></div>
      </div>

      {form && <StartForm form={form} setForm={setForm} reasons={data.reasons} onDone={(id) => { setForm(null); setOpenId(id); }} />}
      <Settings settings={data.settings} onSaved={() => load(page)} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {chip('In Progress', 'In progress')}{chip('Settled', 'Settled')}{chip('Completed', 'Completed')}{chip('', 'All')}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by employee..." style={{ ...input, flex: '1 1 200px', maxWidth: 300, width: 'auto' }} />
      </div>
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}

      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={{ ...cell, width: 40 }}>#</th><th style={cell}>Employee</th><th style={cell}>Last working day</th><th style={cell}>Reason</th><th style={cell}>Checklist</th><th style={{ ...cell, textAlign: 'right' }}>Net settlement</th><th style={cell}>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : data.exits.length === 0 ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Nobody is leaving. Press "Start an exit" when an employee resigns.</td></tr>
                : data.exits.map((x, idx) => (
                  <tr key={x.id} onClick={() => setOpenId(x.id)} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}>
                    <td style={{ ...cell, color: '#94a3b8', fontWeight: 700 }}>{(page - 1) * pageSize + idx + 1}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}><b>{x.full_name}</b> <span style={{ color: '#94a3b8' }}>({x.emp_code})</span></td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{day(x.last_working_day)}</td>
                    <td style={cell}>{x.reason || '-'}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{x.done} of {x.items} done</td>
                    <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{x.status === 'In Progress' && !Number(x.fnf_total) ? <span style={{ color: '#94a3b8' }}>not saved</span> : money(x.fnf_total)}</td>
                    <td style={cell}><Badge s={x.status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={data.total} pageSize={pageSize} itemLabel="exits" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>
    </div>
  );
}

function Settings({ settings, onSaved }) {
  const [s, setS] = useState(null);
  if (!s) return <div style={{ marginBottom: 10 }}><button className="btn-premium" style={{ background: '#475569' }} onClick={() => setS({ ...settings })}>Settlement settings</button></div>;
  const save = async () => {
    try {
      await call('POST', `${API}/settings/system`, [
        { setting_key: 'exit_notice_days', setting_value: String(s.notice_days) }, { setting_key: 'fnf_el_rate', setting_value: String(s.el_rate) }, { setting_key: 'fnf_notice_recovery', setting_value: s.notice_recovery ? '1' : '0' }]);
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1300, showConfirmButton: false }); setS(null); onSaved();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
  };
  return (
    <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: 150 }}><label style={lbl}>Notice period (days)</label><input type="number" min="0" max="365" style={input} value={s.notice_days} onChange={e => setS({ ...s, notice_days: e.target.value })} /></div>
        <div style={{ width: 170 }}><label style={lbl}>EL paid at (x PerDay)</label><input type="number" min="0" max="5" step="0.25" style={input} value={s.el_rate} onChange={e => setS({ ...s, el_rate: e.target.value })} /></div>
        <label style={{ fontSize: '.82rem', display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 9 }}><input type="checkbox" checked={!!s.notice_recovery} onChange={e => setS({ ...s, notice_recovery: e.target.checked })} /> Recover the notice shortfall</label>
        <button className="btn-premium" onClick={save}>Save</button>
        <button className="btn-premium" style={{ background: '#64748b' }} onClick={() => setS(null)}>Close</button>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>The notice period is the default for a new exit. The EL balance is paid at this many times one day's pay. The notice shortfall is the days short of the notice period, recovered at one day's pay each. HR can change every amount of a settlement.</div>
    </div>
  );
}

function StartForm({ form, setForm, reasons, onDone }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (form.q.trim().length < 2) { setForm(f => ({ ...f, people: [] })); return; }
      fetch(`${API}/directory?search=${encodeURIComponent(form.q.trim())}&per_page=8`, { headers: auth() }).then(r => r.json()).then(d => setForm(f => ({ ...f, people: d.people || [] }))).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [form.q]);
  const go = async () => {
    if (!form.employee) { Swal.fire({ icon: 'warning', title: 'Pick an employee' }); return; }
    setBusy(true);
    try { const d = await call('POST', `${API}/exits`, { employee_id: form.employee.id, resignation_date: form.resignation_date, last_working_day: form.last_working_day, reason: form.reason, notice_days: form.notice_days }); onDone(d.id); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Not started', text: e.message }); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Start an exit</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <label style={lbl}>Employee</label>
          {form.employee ? <div style={{ ...input, display: 'flex', justifyContent: 'space-between' }}><span><b>{form.employee.full_name}</b> ({form.employee.emp_code})</span><button onClick={() => setForm(f => ({ ...f, employee: null }))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>&#10005;</button></div> : (
            <>
              <input style={input} value={form.q} onChange={e => setForm(f => ({ ...f, q: e.target.value }))} placeholder="Type a name..." />
              {form.people.length > 0 && <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}>
                {form.people.map(p => <div key={p.id} onClick={() => setForm(f => ({ ...f, employee: p, q: '', people: [] }))} style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid #f1f5f9' }}><b>{p.full_name}</b> <span style={{ color: '#94a3b8' }}>({p.emp_code})</span></div>)}
              </div>}
            </>
          )}
        </div>
        <div><label style={lbl}>Resignation date</label><input type="date" style={input} value={form.resignation_date} onChange={e => setForm(f => ({ ...f, resignation_date: e.target.value }))} /></div>
        <div><label style={lbl}>Last working day</label><input type="date" style={input} value={form.last_working_day} onChange={e => setForm(f => ({ ...f, last_working_day: e.target.value }))} /></div>
        <div><label style={lbl}>Reason</label><select style={input} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>{reasons.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
        <div><label style={lbl}>Notice period (days)</label><input type="number" min="0" max="365" style={input} value={form.notice_days} onChange={e => setForm(f => ({ ...f, notice_days: e.target.value }))} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="btn-premium" onClick={go} disabled={busy}>{busy ? 'Starting...' : 'Start'}</button>
        <button className="btn-premium" style={{ background: '#64748b' }} onClick={() => setForm(null)}>Cancel</button>
      </div>
    </div>
  );
}

function Detail({ id, onBack }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);       // { dates, checklist, lines }

  const load = useCallback(() => {
    fetch(`${API}/exits/${id}`, { headers: auth() }).then(async r => { const x = await r.json(); if (!r.ok) throw new Error(x.detail || 'Could not load'); return x; })
      .then(x => { setD(x); setDraft({ resignation_date: x.exit.resignation_date, last_working_day: x.exit.last_working_day, notice_days: x.exit.notice_days, reason: x.exit.reason || 'Resignation', remarks: x.exit.remarks || '', checklist: x.checklist, lines: x.lines }); })
      .catch(e => setError(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div><button className="btn-premium" onClick={onBack}>&larr; Back</button><div style={{ color: '#b91c1c', marginTop: 12 }}>{error}</div></div>;
  if (!d || !draft) return <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;
  const x = d.exit, locked = x.status !== 'In Progress', done = x.status === 'Completed';
  const net = draft.lines.reduce((t, l) => t + (l.type === 'deduction' ? -1 : 1) * (Number(l.amount) || 0), 0);

  const run = async (fn, okMsg) => { setBusy(true); try { const r = await fn(); if (okMsg !== false) Swal.fire({ icon: 'success', title: (r && r.message) || okMsg || 'Done', timer: 1800, showConfirmButton: false }); load(); } catch (e) { Swal.fire({ icon: 'error', title: 'Not done', text: e.message }); } finally { setBusy(false); } };
  const save = () => run(() => call('PUT', `${API}/exits/${id}`, { resignation_date: draft.resignation_date, last_working_day: draft.last_working_day, notice_days: draft.notice_days, reason: draft.reason, remarks: draft.remarks, checklist: draft.checklist, ...(locked ? {} : { lines: draft.lines }) }), 'Saved');
  const action = (a, text) => run(() => call('POST', `${API}/exits/${id}`, { action: a }), text);
  const confirm = async (title, text, fn) => { const c = await Swal.fire({ icon: 'question', title, text, showCancelButton: true, confirmButtonText: 'Yes' }); if (c.isConfirmed) fn(); };
  const setLine = (i, patch) => setDraft(s => ({ ...s, lines: s.lines.map((l, k) => k === i ? { ...l, ...patch } : l) }));
  const statement = async () => {
    const tab = window.open('', '_blank');
    try { const res = await fetch(`${API}/exits/${id}/statement`, { headers: auth() }); if (!res.ok) throw new Error('Could not open the statement'); const url = URL.createObjectURL(await res.blob()); if (tab) tab.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch (e) { if (tab) tab.close(); Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
  };
  const cell = { padding: '7px 10px' };

  return (
    <div>
      <div className="ph">
        <div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 6 }}>&larr; All exits</button>
          <h1>{x.full_name} <span style={{ color: '#94a3b8', fontWeight: 600 }}>({x.emp_code})</span></h1>
          <p>{x.designation || ''}{x.joined ? ` · joined ${day(x.joined)}` : ''}</p>
        </div>
        <div className="ph-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Badge s={x.status} />
          <Link to="/letters" className="btn-premium" style={{ textDecoration: 'none' }}>Make relieving / experience letter</Link>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div><label style={lbl}>Resignation date</label><input type="date" style={input} disabled={done} value={draft.resignation_date} onChange={e => setDraft({ ...draft, resignation_date: e.target.value })} /></div>
          <div><label style={lbl}>Last working day</label><input type="date" style={input} disabled={locked} value={draft.last_working_day} onChange={e => setDraft({ ...draft, last_working_day: e.target.value })} /></div>
          <div><label style={lbl}>Notice period (days)</label><input type="number" min="0" max="365" style={input} disabled={done} value={draft.notice_days} onChange={e => setDraft({ ...draft, notice_days: e.target.value })} /></div>
          <div><label style={lbl}>Reason</label><select style={input} disabled={done} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })}>{d.reasons.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
        </div>
        <div style={{ marginTop: 10 }}><label style={lbl}>Remarks</label><input style={input} maxLength={500} disabled={done} value={draft.remarks} onChange={e => setDraft({ ...draft, remarks: e.target.value })} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Checklist <span style={{ color: '#94a3b8', fontWeight: 600 }}>({draft.checklist.filter(c => c.done).length} of {draft.checklist.length})</span></div>
          {draft.checklist.map((c, i) => (
            <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: i ? '1px solid #f4f6fa' : 'none', fontSize: '.85rem', cursor: done ? 'default' : 'pointer' }}>
              <input type="checkbox" disabled={done} checked={!!c.done} onChange={e => setDraft(s => ({ ...s, checklist: s.checklist.map((z, k) => k === i ? { ...z, done: e.target.checked } : z) }))} style={{ marginTop: 3 }} />
              <span style={{ textDecoration: c.done ? 'line-through' : 'none', color: c.done ? '#94a3b8' : '#0f172a' }}>{c.label}{c.done && c.done_on ? <span style={{ color: '#94a3b8', fontSize: '.74rem' }}> &middot; {day(c.done_on)}</span> : null}</span>
            </label>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Full and final settlement {!d.saved && !locked ? <span style={{ color: '#b45309', fontWeight: 600, fontSize: '.76rem' }}>(suggested, not saved yet)</span> : null}</div>
          {d.info.warnings && d.info.warnings.map((w, i) => <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '6px 10px', fontSize: '.78rem', marginBottom: 8 }}>{w}</div>)}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left' }}><th style={cell}>Item</th><th style={cell}>Type</th><th style={{ ...cell, textAlign: 'right' }}>Amount</th><th></th></tr></thead>
              <tbody>
                {draft.lines.length === 0 && <tr><td colSpan="4" style={{ ...cell, color: '#94a3b8' }}>No lines yet. Add the amounts below.</td></tr>}
                {draft.lines.map((l, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f4f6fa' }}>
                    <td style={cell}><input style={input} disabled={locked} value={l.label} maxLength={120} onChange={e => setLine(i, { label: e.target.value })} /></td>
                    <td style={cell}><select style={{ ...input, width: 110 }} disabled={locked} value={l.type} onChange={e => setLine(i, { type: e.target.value })}><option value="earning">Payable</option><option value="deduction">Recover</option></select></td>
                    <td style={{ ...cell, width: 120 }}><input type="number" min="0" step="0.01" style={{ ...input, textAlign: 'right', color: l.type === 'deduction' ? '#b91c1c' : '#15803d', fontWeight: 700 }} disabled={locked} value={l.amount} onChange={e => setLine(i, { amount: e.target.value })} /></td>
                    <td style={cell}>{!locked && <button onClick={() => setDraft(s => ({ ...s, lines: s.lines.filter((_, k) => k !== i) }))} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>&#10005;</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!locked && <button className="btn-premium" style={{ marginTop: 8 }} onClick={() => setDraft(s => ({ ...s, lines: [...s.lines, { key: 'own_' + Date.now(), label: '', amount: 0, type: 'earning', auto: false }] }))}>+ Add a line</button>}
          <div style={{ marginTop: 10, padding: '10px 12px', background: net >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span>{net >= 0 ? 'Net amount payable' : 'Net amount recoverable'}</span><span style={{ color: net >= 0 ? '#15803d' : '#b91c1c' }}>{money(Math.abs(net))}</span>
          </div>
          <div style={{ fontSize: '.74rem', color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
            PerDay Salary {money(d.info.per_day)} &middot; {d.info.paid_days != null ? `${d.info.paid_days} paid days in the last month` : ''}{d.info.unpaid_days ? ` (${d.info.unpaid_days} unpaid)` : ''} &middot; EL balance {d.info.el_balance ?? 0} days &middot; notice {d.info.notice_served ?? 0} of {d.info.notice_days ?? 0} days served{d.info.notice_shortfall ? `, ${d.info.notice_shortfall} short` : ''}.
            Extra Work pay, incentives, insurance and other deductions of the last month are not included: add them as lines.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        {!done && <button className="btn-premium" onClick={save} disabled={busy}>Save</button>}
        {!locked && <button className="btn-premium" style={{ background: '#7c3aed' }} onClick={() => confirm('Work out the suggestions again?', 'Your own lines are kept. The suggested lines are replaced.', () => action('recalculate'))} disabled={busy}>Work out the suggestions again</button>}
        <button className="btn-premium" style={{ background: '#0891b2' }} onClick={statement} disabled={busy}>Statement (PDF)</button>
        {x.status === 'In Progress' && <button className="btn-premium" style={{ background: '#15803d' }} onClick={() => confirm('Mark the settlement as done?', 'The amounts are locked. You can reopen it later.', async () => { await save(); action('settle'); })} disabled={busy}>Mark settlement done</button>}
        {x.status === 'Settled' && <button className="btn-premium" style={{ background: '#64748b' }} onClick={() => action('reopen')} disabled={busy}>Reopen the settlement</button>}
        {x.status === 'Settled' && <button className="btn-premium" style={{ background: '#b91c1c' }} onClick={() => confirm('Complete the exit?', `${x.full_name} is marked as Dropped and can no longer sign in. This cannot be undone here.`, () => action('complete'))} disabled={busy}>Complete the exit</button>}
      </div>
      {done && <div style={{ marginTop: 10, color: '#15803d', fontWeight: 600, fontSize: '.85rem' }}>This exit is completed. The employee is marked as having left.</div>}
    </div>
  );
}
