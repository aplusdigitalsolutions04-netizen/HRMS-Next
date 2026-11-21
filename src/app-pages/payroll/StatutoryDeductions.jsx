import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const input = { padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.85rem', outline: 'none', background: '#fff', fontFamily: 'inherit', width: '100%' };
const lbl = { fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 };
const KIND = { percent: 'Percent of salary (PF, ESI ...)', fixed: 'Fixed amount every month', slab: 'Income tax by slabs (TDS)' };

async function call(method, url, body) {
  const res = await fetch(url, { method, headers: { ...auth(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.detail || 'Could not save');
  return d;
}
const blank = () => ({ id: null, code: '', name: '', kind: 'percent', enabled: 0, wage_base: 'basic', employee_rate: 0, employer_rate: 0, wage_ceiling: '', eligible_below: '', fixed_amount: 0, min_amount: '', rounding: 'rupee', exemption: 0, cess: 0, slabs: [], sort_order: 100 });

// Statutory deductions (PF, ESI, TDS, professional tax ...). The rules and every rate are entered here; nothing is built into the program.
export default function StatutoryDeductions() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(null);

  const load = useCallback(() => {
    fetch(`${API}/payroll/statutory`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => setRules(d.rules)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (r) => {
    try { const d = await call(r.id ? 'PUT' : 'POST', `${API}/payroll/statutory`, r); Swal.fire({ icon: 'success', title: d.message, timer: 2200, showConfirmButton: false }); setAdding(null); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
  };
  const remove = async (r) => {
    const c = await Swal.fire({ icon: 'warning', title: `Delete ${r.name}?`, text: 'Future salary sheets will not deduct it. Past payslips are not changed.', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
    if (!c.isConfirmed) return;
    try { await call('DELETE', `${API}/payroll/statutory?id=${r.id}`); load(); } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
  };

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Statutory Deductions</h1>
          <p>PF, ESI, TDS, professional tax and any other deduction the company has to make from salary. Rates and limits come from the law and change, so none are built in: fill them in here. A rule deducts nothing until it is switched on.</p>
        </div>
        <div className="ph-actions"><button className="btn-premium" onClick={() => setAdding(blank())}>+ Add a rule</button></div>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 10, padding: '9px 14px', fontSize: '.82rem', marginBottom: 14 }}>
        Once a rule is on, it is taken from every employee's salary in the Salary Sheet and shown on the payslip as its own deduction line. An employee can be left out of a rule on their salary structure. Please confirm the rates with your accountant before switching a rule on.
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}
      {adding && <Rule rule={adding} isNew onSave={save} onCancel={() => setAdding(null)} />}
      {loading ? <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Loading...</div> : rules.map(r => <Rule key={r.id} rule={r} onSave={save} onDelete={() => remove(r)} />)}
    </div>
  );
}

function Rule({ rule, isNew, onSave, onDelete, onCancel }) {
  const [r, setR] = useState({ ...rule, wage_ceiling: rule.wage_ceiling ?? '', eligible_below: rule.eligible_below ?? '', min_amount: rule.min_amount ?? '', slabs: rule.slabs || [] });
  const set = (k, v) => setR(x => ({ ...x, [k]: v }));
  const field = (k, label, props = {}) => <div><label style={lbl}>{label}</label><input type="number" min="0" step="any" style={input} value={r[k]} onChange={e => set(k, e.target.value)} {...props} /></div>;

  return (
    <div style={{ background: '#fff', border: '1px solid ' + (r.enabled ? '#86efac' : '#eadfd5'), borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '2 1 220px' }}><label style={lbl}>Name</label><input style={input} maxLength={80} value={r.name} onChange={e => set('name', e.target.value)} /></div>
        <div style={{ flex: '0 1 110px' }}><label style={lbl}>Code</label><input style={input} maxLength={20} value={r.code} disabled={!isNew} onChange={e => set('code', e.target.value.toUpperCase())} /></div>
        <div style={{ flex: '1 1 220px' }}><label style={lbl}>How it is worked out</label>
          <select style={input} value={r.kind} onChange={e => set('kind', e.target.value)}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: '.85rem', color: r.enabled ? '#15803d' : '#64748b', marginTop: 18 }}>
          <input type="checkbox" checked={!!r.enabled} onChange={e => set('enabled', e.target.checked ? 1 : 0)} /> {r.enabled ? 'ON - deducted' : 'OFF - not deducted'}
        </label>
      </div>

      {r.kind === 'percent' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <div><label style={lbl}>Percent of</label><select style={input} value={r.wage_base} onChange={e => set('wage_base', e.target.value)}><option value="basic">Basic Pay (of the paid days)</option><option value="gross">Gross salary (of the paid days)</option></select></div>
          {field('employee_rate', 'Employee pays (%)', { max: 100 })}
          {field('employer_rate', 'Company pays on top (%)', { max: 100 })}
          {field('wage_ceiling', 'Wage ceiling (monthly, optional)')}
          {field('eligible_below', 'Only if monthly salary is at most (optional)')}
          {field('min_amount', 'Smallest deduction (optional)')}
        </div>
      )}
      {r.kind === 'fixed' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {field('fixed_amount', 'Amount every month')}
          {field('eligible_below', 'Only if monthly salary is at most (optional)')}
        </div>
      )}
      {r.kind === 'slab' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
            {field('exemption', 'Yearly exemption / standard deduction')}
            {field('cess', 'Cess on the tax (%)', { max: 100 })}
            {field('eligible_below', 'Only if monthly salary is at most (optional)')}
          </div>
          <label style={lbl}>Slabs of yearly income (leave "up to" empty on the last one)</label>
          {r.slabs.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '.8rem', color: '#64748b', minWidth: 46 }}>Up to</span>
              <input type="number" min="0" style={{ ...input, maxWidth: 160 }} placeholder="no limit" value={s.upto ?? ''} onChange={e => set('slabs', r.slabs.map((x, k) => k === i ? { ...x, upto: e.target.value === '' ? null : e.target.value } : x))} />
              <span style={{ fontSize: '.8rem', color: '#64748b' }}>tax</span>
              <input type="number" min="0" max="100" step="any" style={{ ...input, maxWidth: 90 }} value={s.rate} onChange={e => set('slabs', r.slabs.map((x, k) => k === i ? { ...x, rate: e.target.value } : x))} />
              <span style={{ fontSize: '.8rem', color: '#64748b' }}>%</span>
              <button onClick={() => set('slabs', r.slabs.filter((_, k) => k !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>&#10005;</button>
            </div>
          ))}
          <button className="btn-premium" style={{ marginTop: 4 }} onClick={() => set('slabs', [...r.slabs, { upto: '', rate: 0 }])}>+ Add a slab</button>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>The tax is worked out on (monthly gross x 12 - exemption), band by band, plus the cess, divided by 12 for each month. Model any rebate or regime by the exemption and the slabs.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
        <div style={{ width: 200 }}><label style={lbl}>Rounding</label>
          <select style={input} value={r.rounding} onChange={e => set('rounding', e.target.value)}><option value="rupee">To the nearest rupee</option><option value="up">Up to the next rupee</option><option value="none">Keep paise</option></select></div>
        <div style={{ width: 90 }}><label style={lbl}>Order</label><input type="number" style={input} value={r.sort_order} onChange={e => set('sort_order', e.target.value)} /></div>
        <button className="btn-premium" onClick={() => onSave(r)}>{isNew ? 'Add rule' : 'Save'}</button>
        {onDelete && <button className="btn-premium" style={{ background: '#ef4444' }} onClick={onDelete}>Delete</button>}
        {onCancel && <button className="btn-premium" style={{ background: '#64748b' }} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
