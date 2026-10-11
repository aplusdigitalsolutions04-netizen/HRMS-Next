import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';
import Pagination from '../shared/Pagination';
import { Tabs, Dialog } from '@/lib/ui-motion';
import useStatusMaster from '../shared/useStatusMaster';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const JH = () => ({ ...auth(), 'Content-Type': 'application/json' });
const STATUS_COLORS = { Available: ['#f0fdf4', '#15803d'], Assigned: ['#eff6ff', '#1d4ed8'], 'In repair': ['#fffbeb', '#b45309'], Lost: ['#fef2f2', '#b91c1c'], Retired: ['#f1f5f9', '#475569'] };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmt = (d) => { if (!d) return ''; try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

const lab = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 };
const inp = { height: 36, padding: '0 11px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' };

function Field({ label, children }) { return <div style={{ marginBottom: 10 }}><label style={lab}>{label}</label>{children}</div>; }

// Dropdown with every working employee and a search box inside it. Click the field, type to narrow the list, pick one.
function useEmployees() {
  const sm = useStatusMaster();
  const [all, setAll] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (let p = 1; p <= 30; p++) {
        const d = await fetch(`${API}/employee/manage?per_page=100&page=${p}`, { headers: auth() }).then(r => r.json()).catch(() => ({}));
        out.push(...(d.data || []));
        if (!d.data || out.length >= (d.total || 0)) break;
      }
      if (alive) setAll(out);
    })();
    return () => { alive = false; };
  }, []);
  const working = new Set(sm.employee.filter(x => x.is_working === 1 || x.is_working === true).map(x => x.code));
  const list = (all || []).filter(e => (working.size === 0 ? e.status !== 'dropped' : working.has(e.status))).sort((x, y) => String(x.full_name).localeCompare(String(y.full_name)));
  return { list, loading: all === null };
}

function EmployeeSelect({ value, onPick }) {
  const { list, loading } = useEmployees();
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const shown = t ? list.filter(e => (String(e.full_name) + ' ' + String(e.emp_code) + ' ' + String(e.email_id || '')).toLowerCase().includes(t)) : list;

  // chosen: show who, with a way to change - no floating list, so nothing opens on top of the form
  if (value) {
    return (
      <div style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', borderColor: '#93c5fd' }}>
        <b style={{ color: '#0f172a' }}>{value.label}</b>
        <button type="button" className="as-b" onClick={() => onPick(null)}>Change</button>
      </div>
    );
  }
  // not chosen yet: a search box and the list of employees, right in the form (the form itself scrolls if needed)
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <input autoFocus style={{ ...inp, border: 'none', borderBottom: '1px solid #f1f5f9', borderRadius: 0 }} placeholder="Search by name, code or email..." value={q} onChange={e => setQ(e.target.value)} />
      <div role="listbox" style={{ maxHeight: 170, overflowY: 'auto' }}>
        {shown.length === 0 ? <div style={{ padding: 14, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{loading ? 'Loading employees...' : 'No employee found'}</div>
          : shown.map(e => (
            <button key={e.id} type="button" role="option"
              onClick={() => { onPick({ id: e.id, label: `${e.full_name} (${e.emp_code})` }); setQ(''); }}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f8fafc', background: 'none', cursor: 'pointer', fontSize: 13 }}>
              <span><b>{e.full_name}</b>{e.designation ? <span style={{ color: '#94a3b8' }}> - {e.designation}</span> : null}</span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>{e.emp_code}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

// Type: a searchable list from the Asset Types master (inline in the form, no floating popup).
function TypeField({ value, types, onChange }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const shown = t ? types.filter(x => x.toLowerCase().includes(t)) : types;
  if (value) {
    return (
      <div style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', borderColor: '#93c5fd' }}>
        <b style={{ color: '#0f172a' }}>{value}</b>
        <button type="button" className="as-b" onClick={() => onChange('')}>Change</button>
      </div>
    );
  }
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <input style={{ ...inp, border: 'none', borderBottom: '1px solid #f1f5f9', borderRadius: 0 }} placeholder="Search type..." value={q} onChange={e => setQ(e.target.value)} />
      <div role="listbox" style={{ maxHeight: 130, overflowY: 'auto' }}>
        {shown.length === 0 ? <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>{types.length === 0 ? 'No types yet - add them with the Asset Types button on the Assets page.' : 'No matching type'}</div>
          : shown.map(x => (
            <button key={x} type="button" role="option" onClick={() => { onChange(x); setQ(''); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f8fafc', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{x}</button>
          ))}
      </div>
    </div>
  );
}

// Name: type it, or pick from names already used by other assets (suggestions appear right under the box).
function NameField({ value, names, onChange }) {
  const [focus, setFocus] = useState(false);
  const t = String(value || '').trim().toLowerCase();
  const matches = names.filter(n => n.toLowerCase() !== t && (t === '' || n.toLowerCase().includes(t))).slice(0, 6);
  return (
    <div>
      <input style={inp} value={value || ''} placeholder="e.g. Dell Latitude 5420" autoComplete="off"
        onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} onChange={e => onChange(e.target.value)} />
      {focus && matches.length > 0 && (
        <div role="listbox" style={{ marginTop: 4, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '5px 12px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', background: '#f8fafc' }}>Already used</div>
          {matches.map(n => (
            <button key={n} type="button" role="option" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(n); setFocus(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', border: 'none', borderTop: '1px solid #f8fafc', background: 'none', cursor: 'pointer', fontSize: 13 }}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Assets() {
  const [tab, setTab] = useState('All');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [types, setTypes] = useState([]);
  const [allTypes, setAllTypes] = useState([]);
  const [names, setNames] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [typeF, setTypeF] = useState('');
  const [modal, setModal] = useState(null); // {kind:'add'|'edit'|'assign'|'return'|'history', asset}
  const [form, setForm] = useState({});
  const [pick, setPick] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const ready = useRef(false);

  const load = useCallback((p = page, o = {}) => {
    setLoading(true);
    const st = o.status !== undefined ? o.status : tab;
    const q = o.search !== undefined ? o.search : search;
    const ty = o.type !== undefined ? o.type : typeF;
    const params = new URLSearchParams({ page: p, per_page: o.perPage || pageSize });
    if (st && st !== 'All') params.set('status', st);
    if (ty) params.set('type', ty);
    if (q.trim()) params.set('search', q.trim());
    fetch(`${API}/assets?${params}`, { headers: auth() }).then(r => r.json())
      .then(d => { setRows(d.assets || []); setTotal(d.total || 0); setCounts(d.counts || {}); setTypes(d.types || []); setAllTypes(d.all_types || d.types || []); setNames(d.names || []); setPage(d.page || 1); })
      .catch(() => { setRows([]); setTotal(0); }).finally(() => setLoading(false));
  }, [page, tab, search, typeF, pageSize]);

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1, { search }), 350);
    return () => clearTimeout(t);
  }, [search]);

  const open = async (kind, asset) => {
    setPick(null); setHistory([]);
    let fresh = types;
    if (kind === 'add' || kind === 'edit') {
      try {
        const d = await fetch(`${API}/asset-types`, { headers: auth() }).then(x => x.json());
        fresh = (d.types || []).filter(t => t.is_active).map(t => t.name);
        setTypes(fresh); setAllTypes(prev => [...new Set([...prev, ...(d.types || []).map(t => t.name)])]);
      } catch { /* keep the list we have */ }
    }
    if (kind === 'add') setForm({ asset_type: '' });
    else if (kind === 'edit') setForm({ asset_tag: asset.asset_tag, asset_type: asset.asset_type, name: asset.name, serial_no: asset.serial_no || '', notes: asset.notes || '', status: asset.status });
    else if (kind === 'assign') setForm({ assigned_on: today(), condition_out: '', notes: '' });
    else if (kind === 'return') setForm({ returned_on: today(), condition_in: '', status_after: 'Available', notes: '' });
    setModal({ kind, asset });
    if (kind === 'history') {
      fetch(`${API}/assets/${asset.id}`, { headers: auth() }).then(r => r.json()).then(d => setHistory(d.history || [])).catch(() => {});
    }
  };

  const send = async (url, method, body, okMsg) => {
    setSaving(true);
    try {
      const res = await fetch(url, { method, headers: JH(), body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      setModal(null);
      Swal.fire({ icon: 'success', title: okMsg || d.message, timer: 1400, showConfirmButton: false });
      load(page);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setSaving(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    const k = modal.kind, a = modal.asset;
    if (k === 'add' || k === 'edit') {
      if (!String(form.asset_tag || '').trim()) { Swal.fire({ icon: 'warning', title: 'Enter the asset tag' }); return; }
      if (!String(form.name || '').trim()) { Swal.fire({ icon: 'warning', title: 'Enter the asset name' }); return; }
      if (!String(form.asset_type || '').trim()) { Swal.fire({ icon: 'warning', title: 'Choose the asset type', text: types.length === 0 ? 'There are no types yet. Close this form and add one with the Asset Types button.' : '' }); return; }
    }
    if (k === 'add') return send(`${API}/assets`, 'POST', form, 'Asset added');
    if (k === 'edit') return send(`${API}/assets/${a.id}`, 'PUT', form, 'Asset updated');
    if (k === 'assign') { if (!pick) { Swal.fire({ icon: 'warning', title: 'Pick an employee from the list' }); return; } return send(`${API}/assets/${a.id}/assign`, 'POST', { ...form, employee_id: pick.id }, 'Assigned'); }
    if (k === 'return') return send(`${API}/assets/${a.id}/assign`, 'POST', { ...form, action: 'return' }, 'Returned');
  };

  const pill = (s) => { const c = STATUS_COLORS[s] || ['#f1f5f9', '#475569']; return <span style={{ background: c[0], color: c[1], padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>{s}</span>; };
  const all = Object.values(counts).reduce((t, n) => t + n, 0);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <style>{`
        .as-t { width:100%; border-collapse:collapse; }
        .as-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #e8edf6; text-align:left; white-space:nowrap; }
        .as-t td { padding:8px 12px; font-size:.82rem; color:#334155; border-bottom:1px solid #f4f6fa; vertical-align:middle; }
        .as-b { height:28px; padding:0 10px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; }
        .as-b:hover { border-color:#93c5fd; color:#1d4ed8; background:#f1f6ff; }
        .as-b.pri { background:#2563eb; border-color:#2563eb; color:#fff; } .as-b.pri:hover { background:#1d4ed8; color:#fff; }
        .as-card { background:#fff; border:1px solid #e8edf6; border-radius:12px; overflow:hidden; }
      `}</style>

      <div className="ph">
        <div>
          <h1>Assets</h1>
          <p>Laptops, ID cards and other company items - who has each one, since when, and when it came back. Use the Asset Types button to manage the type list.</p>
        </div>
        <div className="ph-actions">
          <Link to="/masters/asset-types" className="btn-o">Asset Types</Link>
          <button className="btn-p" onClick={() => open('add')}>+ Add asset</button>
        </div>
      </div>

      <div className="tabs-bar">
        <Tabs id="asset-tabs" value={tab} onChange={v => { setTab(v); setPage(1); load(1, { status: v }); }} tabs={[
          { id: 'All', label: <>All ({all})</> },
          ...['Available', 'Assigned', 'In repair', 'Lost', 'Retired'].map(s => ({ id: s, label: <>{s} ({counts[s] || 0})</> })),
        ]} />
      </div>

      <div className="filters">
        <div className="f-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by tag, name, serial or employee..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={typeF} onChange={e => { setTypeF(e.target.value); load(1, { type: e.target.value }); }} aria-label="Type">
          <option value="">All Types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-reset" onClick={() => { setSearch(''); setTypeF(''); load(1, { search: '', type: '' }); }}>Reset</button>
      </div>

      <div className="as-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="as-t">
            <thead><tr><th style={{ width: 40 }}>#</th><th>Tag</th><th>Asset Name</th><th>Type</th><th>Serial</th><th>Status</th><th>Assigned To</th><th>Emp ID</th><th>Since</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="10" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : rows.length === 0 ? <tr><td colSpan="10" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No assets yet. Use &quot;Add asset&quot; to start.</td></tr>
                : rows.map((a, i) => (
                  <tr key={a.id}>
                    <td style={{ color: '#94a3b8' }}>{(page - 1) * pageSize + i + 1}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{a.asset_tag}</td>
                    <td>{a.name}</td>
                    <td>{a.asset_type}</td>
                    <td style={{ color: '#64748b' }}>{a.serial_no || '-'}</td>
                    <td>{pill(a.status)}</td>
                    <td style={{ fontWeight: a.holder_name ? 600 : 400 }}>{a.holder_name || '-'}</td>
                    <td style={{ color: '#64748b' }}>{a.holder_code || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(a.assigned_on) || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {a.status === 'Available' && <button className="as-b pri" onClick={() => open('assign', a)}>Assign</button>}
                        {a.status === 'Assigned' && <button className="as-b" onClick={() => open('return', a)}>Return</button>}
                        <button className="as-b" onClick={() => open('history', a)}>History</button>
                        <button className="as-b" onClick={() => open('edit', a)}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={total} pageSize={pageSize} itemLabel="assets" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>

      <Dialog open={!!modal} onClose={() => setModal(null)} width={modal && modal.kind === 'history' ? 640 : 460} label="Asset">
        {modal && (
          <form onSubmit={submit} noValidate style={{ padding: 18 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>
              {modal.kind === 'add' ? 'Add asset' : modal.kind === 'edit' ? 'Edit asset' : modal.kind === 'assign' ? 'Assign asset' : modal.kind === 'return' ? 'Take asset back' : 'History'}
              {modal.asset && <span style={{ color: '#94a3b8', fontWeight: 500 }}> - {modal.asset.asset_tag} {modal.asset.name}</span>}
            </h3>

            {(modal.kind === 'add' || modal.kind === 'edit') && (<>
              <Field label="Asset tag *"><input style={inp} required value={form.asset_tag || ''} onChange={set('asset_tag')} placeholder="e.g. LAP-014" /></Field>
              <Field label="Name *"><NameField value={form.name} names={names} onChange={v => setForm(f => ({ ...f, name: v }))} /></Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><Field label="Type *"><TypeField value={form.asset_type} types={types} onChange={v => setForm(f => ({ ...f, asset_type: v }))} /></Field></div>
                <div style={{ flex: 1 }}><Field label="Serial number"><input style={inp} value={form.serial_no || ''} onChange={set('serial_no')} /></Field></div>
              </div>
              {modal.kind === 'edit' && modal.asset.status !== 'Assigned' && (
                <Field label="Status"><select style={inp} value={form.status} onChange={set('status')}>{['Available', 'In repair', 'Lost', 'Retired'].map(s => <option key={s}>{s}</option>)}</select></Field>
              )}
              <Field label="Notes"><textarea rows={2} style={{ ...inp, height: 'auto', padding: '8px 11px' }} value={form.notes || ''} onChange={set('notes')} /></Field>
            </>)}

            {modal.kind === 'assign' && (<>
              <Field label="Employee *"><EmployeeSelect value={pick} onPick={setPick} /></Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><Field label="Given on"><input type="date" style={inp} value={form.assigned_on} max={today()} onChange={set('assigned_on')} /></Field></div>
                <div style={{ flex: 1 }}><Field label="Condition"><input style={inp} value={form.condition_out} onChange={set('condition_out')} placeholder="New / Good" /></Field></div>
              </div>
              <Field label="Notes"><input style={inp} value={form.notes} onChange={set('notes')} /></Field>
            </>)}

            {modal.kind === 'return' && (<>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#475569' }}>Currently with <b>{modal.asset.holder_name}</b> since {fmt(modal.asset.assigned_on)}.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><Field label="Returned on"><input type="date" style={inp} value={form.returned_on} max={today()} onChange={set('returned_on')} /></Field></div>
                <div style={{ flex: 1 }}><Field label="Condition now"><input style={inp} value={form.condition_in} onChange={set('condition_in')} placeholder="Good / Damaged" /></Field></div>
              </div>
              <Field label="After returning it is"><select style={inp} value={form.status_after} onChange={set('status_after')}>{['Available', 'In repair', 'Lost', 'Retired'].map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Notes"><input style={inp} value={form.notes} onChange={set('notes')} /></Field>
            </>)}

            {modal.kind === 'history' && (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {history.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Nobody has held this asset yet.</p> : (
                  <table className="as-t"><thead><tr><th>Employee</th><th>Given</th><th>Returned</th><th>Condition</th></tr></thead>
                    <tbody>{history.map(h => (
                      <tr key={h.id}><td>{h.full_name} <span style={{ color: '#94a3b8' }}>({h.emp_code})</span></td><td>{fmt(h.assigned_on)}</td><td>{h.returned_on ? fmt(h.returned_on) : <b style={{ color: '#1d4ed8' }}>Still with them</b>}</td><td>{[h.condition_out, h.condition_in].filter(Boolean).join(' → ') || '-'}</td></tr>
                    ))}</tbody></table>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" className="btn-o" onClick={() => setModal(null)}>{modal.kind === 'history' ? 'Close' : 'Cancel'}</button>
              {modal.kind !== 'history' && <button type="submit" className="btn-p" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
