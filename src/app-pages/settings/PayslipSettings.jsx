import React, { useState, useEffect, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard } from './shared';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DEFAULTS = { prepared_by: '', authorised_by: '', prepared_signature: '', authorised_signature: '', ew_pay_multiplier: '1', el_payout_interval_months: '1', salary_month_days_mode: 'actual', payslip_auto_draft: '1', payslip_draft_day: '1' };

// who may change these settings (the server checks it again)
const canManage = () => {
  if (sessionStorage.getItem('role') === 'ADMIN') return true;
  try { return JSON.parse(sessionStorage.getItem('permissions') || '{}').manage_salary_structures === true; } catch { return false; }
};

// Shrink the uploaded image so it fits the settings table, and keep it as PNG
// so a transparent signature background stays transparent on the payslip.
function shrinkImage(file, maxW = 360, maxH = 120) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Please choose a PNG, JPG or WEBP image'));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL('image/png');
        if (out.length > 60000) reject(new Error('Signature image is too detailed. Use a simpler or smaller image.'));
        else resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// one person who signs the payslip: the name, an optional signature picture, and how it will look at the bottom of the slip
function Signatory({ title, name, signature, onName, onSignature, disabled }) {
  const ref = useRef(null);
  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { onSignature(await shrinkImage(file)); }
    catch (err) { Swal.fire({ icon: 'error', title: 'Signature not used', text: err.message }); }
  };
  return (
    <div className="ps-sign">
      <h4>{title}</h4>
      <label className="ps-label" htmlFor={`ps-name-${title}`}>Name</label>
      <input id={`ps-name-${title}`} className="ps-input" placeholder="Full name" value={name} maxLength={100} disabled={disabled} onChange={e => onName(e.target.value)} />
      <div className="ps-row">
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} style={{ display: 'none' }} />
        <button type="button" className="um-b" disabled={disabled} onClick={() => ref.current && ref.current.click()}>{signature ? 'Change signature' : 'Add signature'}</button>
        {signature && <button type="button" className="um-b ps-del" disabled={disabled} onClick={() => onSignature('')}>Remove</button>}
        <small>Optional. PNG, JPG or WEBP.</small>
      </div>
      <div className="ps-slip" aria-label={`How ${title} looks on the payslip`}>
        <div className="ps-slip-sig">{signature ? <img src={signature} alt="Signature" /> : <span>signature</span>}</div>
        <div className="ps-slip-name">{name.trim() ? `(${name.trim()})` : '(name)'}</div>
        <div className="ps-slip-title">{title}</div>
      </div>
    </div>
  );
}

// EL Frequencies master: how often EL encashment is paid with the salary. The salary structure of each employee picks one.
function ElFrequencies({ disabled }) {
  const [list, setList] = useState([]);
  const [orig, setOrig] = useState({});
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ name: '', months: '' });
  const load = () => fetch(`${API}/el-frequencies`, { headers: auth() }).then(r => r.json()).then(d => {
    const l = Array.isArray(d.frequencies) ? d.frequencies : [];
    setList(l); setOrig(Object.fromEntries(l.map(f => [f.id, JSON.stringify([f.name, String(f.months), !!f.is_active])])));
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const call = async (method, body, url = `${API}/el-frequencies`) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { ...auth(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      await load();
      return true;
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); return false; }
    finally { setBusy(false); }
  };
  const edit = (id, patch) => setList(l => l.map(f => (f.id === id ? { ...f, ...patch } : f)));
  const rowChanged = (f) => JSON.stringify([f.name, String(f.months), !!f.is_active]) !== orig[f.id];
  const rowOk = (f) => f.name.trim() && Number(f.months) >= 1 && Number(f.months) <= 12 && Number.isInteger(Number(f.months));
  const add = async () => { if (await call('POST', draft)) setDraft({ name: '', months: '' }); };
  const remove = async (f) => {
    const c = await Swal.fire({ icon: 'warning', title: `Delete "${f.name}"?`, text: f.used ? `${f.used} salary structure${f.used === 1 ? '' : 's'} use it.` : undefined, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626', focusCancel: true });
    if (c.isConfirmed) call('DELETE', null, `${API}/el-frequencies?id=${f.id}`);
  };

  return (
    <div className="ps-sub">
      <h4>EL frequencies</h4>
      <p className="ps-help">A named way of paying EL, for example Quarterly (every 3 months). Choose one for an employee in Payroll &gt; Salary Structures; it is used instead of the default above.</p>
      <div className="ps-fl">
        {list.length > 0 && <div className="ps-fl-head"><span>Name</span><span>Every (months)</span><span /><span /></div>}
        {list.map(f => (
          <div key={f.id} className={`ps-fl-row${f.is_active ? '' : ' off'}${rowChanged(f) ? ' changed' : ''}`}>
            <input className="ps-input" value={f.name} maxLength={60} disabled={disabled} onChange={e => edit(f.id, { name: e.target.value })} aria-label="Name" />
            <input className="ps-input" type="number" min="1" max="12" value={f.months} disabled={disabled} onChange={e => edit(f.id, { months: e.target.value })} aria-label="Every how many months" />
            <label className="ps-chk"><input type="checkbox" checked={!!f.is_active} disabled={disabled} onChange={e => edit(f.id, { is_active: e.target.checked })} /> Active{f.used > 0 && <em>{f.used} employee{f.used === 1 ? '' : 's'}</em>}</label>
            <span className="ps-fl-actions">
              <button type="button" className="um-b" disabled={disabled || busy || !rowChanged(f) || !rowOk(f)} onClick={() => call('PUT', { id: f.id, name: f.name, months: f.months, is_active: f.is_active })}>Save</button>
              <button type="button" className="um-b ps-del" disabled={disabled || busy} onClick={() => remove(f)}>Delete</button>
            </span>
          </div>
        ))}
        <div className="ps-fl-row add">
          <input className="ps-input" placeholder="New frequency, e.g. Every 2 months" value={draft.name} maxLength={60} disabled={disabled} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} aria-label="New frequency name" />
          <input className="ps-input" type="number" min="1" max="12" placeholder="Months" value={draft.months} disabled={disabled} onChange={e => setDraft(d => ({ ...d, months: e.target.value }))} aria-label="Months" />
          <span />
          <span className="ps-fl-actions"><button type="button" className="um-b" disabled={disabled || busy || !draft.name.trim() || !draft.months} onClick={add}>+ Add</button></span>
        </div>
      </div>
    </div>
  );
}

// when the next drafts are prepared, in words
function nextDraftRun(day, today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth(), d0 = new Date(y, m, today.getDate());
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (day === 'last') {
    let run = new Date(y, m + 1, 0), forM = new Date(y, m, 1);
    if (run < d0) { run = new Date(y, m + 2, 0); forM = new Date(y, m + 1, 1); }
    return `Next: ${fmt(run)}, for ${MONTHS[forM.getMonth()]} ${forM.getFullYear()}.`;
  }
  const n = Number(day) || 1;
  let run = new Date(y, m, n), forM = new Date(y, m - 1, 1);
  if (run < d0) { run = new Date(y, m + 1, n); forM = new Date(y, m, 1); }
  return `Next: ${fmt(run)}, for ${MONTHS[forM.getMonth()]} ${forM.getFullYear()}.`;
}
const everyText = (n) => {
  const k = Number(n);
  if (!Number.isInteger(k) || k < 1 || k > 12) return '';
  if (k === 1) return "Paid in every month's payslip.";
  const ms = Array.from({ length: 12 }, (_, i) => i + 1).filter(i => i % k === 0).map(i => MONTHS[i - 1]);
  return `Paid together every ${k} months, in ${ms.join(', ')}, as the monthly EL amount x ${k}. The payslips in between show 0.`;
};

export default function PayslipSettings({ saving, setSaving }) {
  const [form, setForm] = useState(DEFAULTS);
  const [orig, setOrig] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const editable = canManage();
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const load = () => fetch(`${API}/settings/payslip`, { headers: auth() })
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || 'These settings could not be loaded.'); return d; })
    .then(d => {
      const v = {
        prepared_by: d.prepared_by || '', authorised_by: d.authorised_by || '',
        prepared_signature: d.prepared_signature || '', authorised_signature: d.authorised_signature || '',
        ew_pay_multiplier: d.ew_pay_multiplier || '1',
        el_payout_interval_months: d.el_payout_interval_months || '1',
        salary_month_days_mode: d.salary_month_days_mode || 'actual',
        payslip_auto_draft: d.payslip_auto_draft === '0' ? '0' : '1',
        payslip_draft_day: d.payslip_draft_day || '1',
      };
      setForm(v); setOrig(v);
    })
    .catch(e => setErr(e.message))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const mult = Number(form.ew_pay_multiplier), interval = Number(form.el_payout_interval_months);
  const problems = {
    ew_pay_multiplier: form.ew_pay_multiplier === '' || !(mult >= 0 && mult <= 10) ? 'Enter a number from 0 to 10' : '',
    el_payout_interval_months: !(Number.isInteger(interval) && interval >= 1 && interval <= 12) ? 'Enter a whole number from 1 to 12' : '',
  };
  const bad = Object.values(problems).filter(Boolean).length;
  const changed = useMemo(() => Object.keys(DEFAULTS).filter(k => String(form[k]) !== String(orig[k])), [form, orig]);
  const dirty = changed.length > 0;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/payslip`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1300, showConfirmButton: false });
      setOrig(form);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setSaving(false); }
  };

  if (err) return <div className="p-4 text-center" style={{ color: '#64748b' }}>{err}</div>;
  if (loading) return <div className="p-4 text-center">Loading...</div>;
  const dis = !editable;
  const mark = (k) => (changed.includes(k) ? <i className="ps-dot" title="Changed, not saved yet" /> : null);

  return (
    <SettingsCard title="Payslip Settings" desc="Who signs the payslip, how the salary is worked out, how EL is paid, and when draft payslips are prepared.">
      <style>{CSS}</style>
      {dis && <div className="ps-note">You can look at these settings but not change them. Changing them needs the permission to manage salary structures.</div>}

      <section className="ps-card">
        <h3>Signatures on the payslip</h3>
        <p className="ps-help">Printed at the bottom of every payslip: the signature (if you add one), then the name in brackets.</p>
        <div className="ps-two">
          <Signatory title="Prepared By" name={form.prepared_by} signature={form.prepared_signature} onName={set('prepared_by')} onSignature={set('prepared_signature')} disabled={dis} />
          <Signatory title="Authorised By" name={form.authorised_by} signature={form.authorised_signature} onName={set('authorised_by')} onSignature={set('authorised_signature')} disabled={dis} />
        </div>
      </section>

      <section className="ps-card">
        <h3>Salary calculation</h3>
        <div className="ps-grid">
          <div className={`ps-field${problems.ew_pay_multiplier ? ' bad' : ''}`}>
            <label className="ps-label" htmlFor="ps-ew">Extra Work pay rate (x one day's pay){mark('ew_pay_multiplier')}</label>
            <input id="ps-ew" type="number" min="0" max="10" step="0.25" className="ps-input" value={form.ew_pay_multiplier} disabled={dis} onChange={e => set('ew_pay_multiplier')(e.target.value)} aria-invalid={!!problems.ew_pay_multiplier} />
            {problems.ew_pay_multiplier ? <span className="ps-err">{problems.ew_pay_multiplier}</span> : <small className="ps-help">Paid for each Extra Work (EW) day: monthly gross / days in the month x this rate. 1 is a normal day, 2 is double pay.</small>}
          </div>
          <div className="ps-field">
            <label className="ps-label" htmlFor="ps-days">Month days (for Paid Days and PerDay Salary){mark('salary_month_days_mode')}</label>
            <select id="ps-days" className="ps-input" value={form.salary_month_days_mode} disabled={dis} onChange={e => set('salary_month_days_mode')(e.target.value)}>
              <option value="actual">Actual days in the month (28 / 29 / 30 / 31)</option>
              <option value="30">Fixed 30 days every month</option>
            </select>
            <small className="ps-help">PerDay Salary = monthly salary / month days. Paid Days = month days - unpaid days (absent days + half of each half day).</small>
          </div>
        </div>
      </section>

      <section className="ps-card">
        <h3>EL encashment</h3>
        <div className="ps-grid">
          <div className={`ps-field${problems.el_payout_interval_months ? ' bad' : ''}`}>
            <label className="ps-label" htmlFor="ps-el">Paid every (months), for everyone{mark('el_payout_interval_months')}</label>
            <input id="ps-el" type="number" min="1" max="12" step="1" className="ps-input" value={form.el_payout_interval_months} disabled={dis} onChange={e => set('el_payout_interval_months')(e.target.value)} aria-invalid={!!problems.el_payout_interval_months} />
            {problems.el_payout_interval_months ? <span className="ps-err">{problems.el_payout_interval_months}</span> : <small className="ps-help">{everyText(form.el_payout_interval_months)}</small>}
          </div>
        </div>
        <ElFrequencies disabled={dis} />
      </section>

      <section className="ps-card">
        <h3>Monthly draft payslips</h3>
        <p className="ps-help">The server prepares DRAFT payslips for the month that has ended. Nothing is emailed and employees see nothing until you approve the payslips in Payroll &gt; Payslip History.</p>
        <label className="ps-toggle" htmlFor="ps-auto">
          <span className="ps-toggle-text"><b>Prepare drafts automatically{mark('payslip_auto_draft')}</b><small>{form.payslip_auto_draft === '1' ? 'On. Drafts are made for you every month.' : 'Off. You make the payslips yourself with Generate Payslips.'}</small></span>
          <input id="ps-auto" type="checkbox" checked={form.payslip_auto_draft === '1'} disabled={dis} onChange={e => set('payslip_auto_draft')(e.target.checked ? '1' : '0')} />
          <span className="ps-switch" aria-hidden="true" />
        </label>
        <div className="ps-grid" style={{ marginTop: 12, opacity: form.payslip_auto_draft === '1' ? 1 : 0.5 }}>
          <div className="ps-field">
            <label className="ps-label" htmlFor="ps-day">Prepare on{mark('payslip_draft_day')}</label>
            <select id="ps-day" className="ps-input" value={form.payslip_draft_day} disabled={dis || form.payslip_auto_draft !== '1'} onChange={e => set('payslip_draft_day')(e.target.value)}>
              <option value="last">Last day of the month, for that same month</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={String(d)}>Day {d} of the next month, for the month that ended</option>)}
            </select>
            {form.payslip_auto_draft === '1' && <small className="ps-help">{nextDraftRun(form.payslip_draft_day)}</small>}
          </div>
        </div>
      </section>

      {!dis && (
        <div className={`ps-bar${dirty ? ' on' : ''}`} role="status">
          <span>{dirty ? `${changed.length} change${changed.length === 1 ? '' : 's'} not saved` : 'All changes are saved'}{bad > 0 && <b className="ps-barerr"> &middot; {bad} value{bad === 1 ? '' : 's'} to correct</b>}</span>
          <span className="ps-bar-actions">
            <button type="button" className="btn-o" onClick={() => setForm(orig)} disabled={!dirty || saving}>Discard</button>
            <button type="button" className="btn-premium" onClick={save} disabled={!dirty || bad > 0 || saving}>{saving ? 'Saving...' : 'Save changes'}</button>
          </span>
        </div>
      )}
    </SettingsCard>
  );
}

const CSS = `
.ps-note { background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:10px; padding:9px 14px; font-size:.84rem; margin-bottom:14px; }
.ps-card { background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:14px 18px 18px; margin-bottom:14px; }
.ps-card h3 { margin:0 0 4px; font-size:.98rem; } .ps-help { font-size:.76rem; color:#64748b; line-height:1.5; margin:0 0 10px; }
.ps-card .ps-grid + .ps-sub, .ps-sub { margin-top:16px; padding-top:14px; border-top:1px solid #f1e8df; } .ps-sub h4 { margin:0 0 3px; font-size:.9rem; }
.ps-two { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; }
.ps-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px 22px; align-items:start; }
.ps-field { display:flex; flex-direction:column; gap:5px; }
.ps-label { font-size:.78rem; font-weight:700; color:#334155; display:flex; align-items:center; gap:6px; }
.ps-dot { width:7px; height:7px; border-radius:50%; background:#f59e0b; display:inline-block; }
.ps-input { width:100%; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:9px; padding:8px 11px; font-size:.88rem; font-family:inherit; background:#fff; color:#1e293b; }
.ps-input:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.ps-input:disabled { background:#f8fafc; color:#94a3b8; }
.ps-field.bad .ps-input { border-color:#dc2626; background:#fef2f2; } .ps-err { font-size:.74rem; color:#b91c1c; font-weight:600; }
.ps-field .ps-help { margin:0; }
.ps-sign { border:1px solid #e2e8f0; border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:7px; }
.ps-sign h4 { margin:0 0 2px; font-size:.9rem; }
.ps-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; } .ps-row small { font-size:.72rem; color:#94a3b8; }
.ps-slip { margin-top:4px; border:1px dashed #cbd5e1; border-radius:10px; padding:10px; text-align:center; background:#fcfcfd; }
.ps-slip-sig { height:50px; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-size:.75rem; } .ps-slip-sig img { max-height:46px; max-width:100%; }
.ps-slip-name { font-weight:700; font-size:.88rem; margin-top:2px; color:#1e293b; } .ps-slip-title { font-size:.72rem; color:#64748b; }
.um-b { height:28px; padding:0 11px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; font-family:inherit; white-space:nowrap; }
.um-b:hover:not(:disabled) { border-color:var(--brand-line); color:var(--brand-dark); background:var(--brand-soft); } .um-b:disabled { opacity:.45; cursor:default; }
.um-b.ps-del { color:#b91c1c; } .um-b.ps-del:hover:not(:disabled) { border-color:#fecaca; background:#fef2f2; color:#b91c1c; }
.ps-fl { display:flex; flex-direction:column; gap:7px; margin-top:8px; }
.ps-fl-head, .ps-fl-row { display:grid; grid-template-columns:minmax(130px,1.6fr) 110px minmax(130px,1fr) auto; gap:10px; align-items:center; }
.ps-fl-head span { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#94a3b8; }
.ps-fl-row.off .ps-input { opacity:.6; } .ps-fl-row.changed .ps-input { border-color:#f59e0b; }
.ps-chk { font-size:.8rem; display:flex; align-items:center; gap:6px; color:#334155; } .ps-chk em { font-style:normal; font-size:.7rem; color:#94a3b8; }
.ps-fl-actions { display:flex; gap:6px; }
.ps-toggle { display:flex; justify-content:space-between; align-items:center; gap:16px; cursor:pointer; position:relative; max-width:640px; }
.ps-toggle-text { display:flex; flex-direction:column; gap:2px; } .ps-toggle-text b { font-size:.86rem; color:#1e293b; display:flex; align-items:center; gap:6px; } .ps-toggle-text small { font-size:.76rem; color:#64748b; }
.ps-toggle input { position:absolute; opacity:0; pointer-events:none; }
.ps-switch { width:38px; height:22px; border-radius:20px; background:#cbd5e1; position:relative; flex-shrink:0; transition:background .15s; }
.ps-switch::after { content:''; position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.3); transition:transform .15s; }
.ps-toggle input:checked + .ps-switch { background:var(--brand); } .ps-toggle input:checked + .ps-switch::after { transform:translateX(16px); }
.ps-toggle input:focus-visible + .ps-switch { box-shadow:0 0 0 3px rgba(111,78,55,.25); }
.ps-bar { position:sticky; bottom:12px; z-index:20; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:10px 14px; box-shadow:0 10px 30px -14px rgba(78,54,38,.4); font-size:.84rem; color:#64748b; }
.ps-bar.on { border-color:#f59e0b; color:#92400e; background:#fffbeb; } .ps-barerr { color:#b91c1c; }
.ps-bar-actions { display:flex; gap:8px; } .ps-bar .btn-o, .ps-bar .btn-premium { height:32px; padding:0 16px; font-size:.82rem; } .ps-bar .btn-premium:disabled, .ps-bar .btn-o:disabled { opacity:.45; cursor:default; }
@media (max-width:700px) { .ps-fl-head { display:none; } .ps-fl-row { grid-template-columns:1fr 90px; } .ps-fl-row > :nth-child(3), .ps-fl-row > :nth-child(4) { grid-column:1 / -1; } }
`;
