import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { API, auth } from './shared';

// Settings > Rules & Limits: every number, list and name the program reads instead of having it written into it.
// The form is built from the fields the server sends, so a new rule appears here without changing this page.

// the value of a field as the form holds it: a list is one item per line, a switch is true or false, the rest is text
const asForm = (f, x) => (f.type === 'list' ? (Array.isArray(x) ? x : []).join('\n') : f.type === 'bool' ? !!x : String(x ?? ''));
const same = (f, a, b) => (f.type === 'list'
  ? String(a || '').split('\n').map(s => s.trim()).filter(Boolean).join('\n') === String(b || '').split('\n').map(s => s.trim()).filter(Boolean).join('\n')
  : f.type === 'bool' ? !!a === !!b : String(a ?? '').trim() === String(b ?? '').trim());
const items = (v) => String(v || '').split('\n').map(s => s.trim()).filter(Boolean).length;

// what is wrong with a typed value, or '' when it is fine
function problem(f, x) {
  if (f.type !== 'number') return '';
  const t = String(x ?? '').trim();
  if (t === '') return 'Enter a number';
  const n = Number(t);
  if (!Number.isFinite(n)) return 'Enter a number';
  if (f.min != null && n < f.min) return `At least ${f.min}`;
  if (f.max != null && n > f.max) return `At most ${f.max}`;
  return '';
}

export default function RulesLimits() {
  const [meta, setMeta] = useState(null);
  const [orig, setOrig] = useState({});
  const [vals, setVals] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = () => fetch(`${API}/settings/app-config`, { headers: auth() })
    .then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
    .then(({ ok, d }) => {
      if (!ok) { setErr(d.detail || d.message || 'These settings could not be loaded.'); return; }
      const v = {};
      d.fields.forEach(f => { v[f.key] = asForm(f, d.values[f.key]); });
      setMeta(d); setOrig(v); setVals(v);
    })
    .catch(() => setErr('These settings could not be loaded.'));
  useEffect(() => { load(); }, []);

  const changed = useMemo(() => (meta ? meta.fields.filter(f => !same(f, vals[f.key], orig[f.key])).map(f => f.key) : []), [meta, vals, orig]);
  const bad = useMemo(() => (meta ? meta.fields.filter(f => problem(f, vals[f.key])).map(f => f.key) : []), [meta, vals]);

  // the words in the search box are looked for in the name, the help text and the key of each setting
  const shown = (f) => { const t = q.trim().toLowerCase(); return !t || `${f.label} ${f.help || ''} ${f.key} ${f.group}`.toLowerCase().includes(t); };

  const set = (key, v) => setVals(x => ({ ...x, [key]: v }));
  const save = async () => {
    const body = {};
    meta.fields.forEach(f => {
      const x = vals[f.key];
      body[f.key] = f.type === 'list' ? String(x || '').split('\n').map(s => s.trim()).filter(Boolean) : x;
    });
    setSaving(true);
    try {
      const r = await fetch(`${API}/settings/app-config`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.message || 'Could not save.');
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1200, showConfirmButton: false });
      await load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    setSaving(false);
  };
  const discard = () => setVals(orig);
  const jump = (g) => { const el = document.getElementById('rl-' + g.replace(/\W+/g, '-')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  if (err) return <div className="p-4 text-center" style={{ color: '#64748b' }}>{err}</div>;
  if (!meta) return <div className="p-4 text-center">Loading...</div>;

  const groups = meta.groups.map(g => [g, meta.fields.filter(f => f.group === g && shown(f))]).filter(([, fs]) => fs.length);

  const field = (f) => {
    const v = vals[f.key], p = problem(f, v), isChanged = changed.includes(f.key);
    const isDefault = same(f, v, asForm(f, f.default));
    const id = 'rl-f-' + f.key;
    return (
      <div key={f.key} className={`rl-field${f.type === 'list' ? ' wide' : ''}${f.type === 'bool' ? ' bool' : ''}${isChanged ? ' changed' : ''}${p ? ' bad' : ''}`}>
        {f.type === 'bool' ? (
          <label className="rl-toggle" htmlFor={id}>
            <span className="rl-toggle-text"><b>{f.label}</b>{f.help && <small>{f.help}</small>}</span>
            <input id={id} type="checkbox" checked={!!v} onChange={e => set(f.key, e.target.checked)} />
            <span className="rl-switch" aria-hidden="true" />
          </label>
        ) : (
          <>
            <label className="rl-label" htmlFor={id}>{f.label}{isChanged && <i className="rl-dot" title="Changed, not saved yet" />}</label>
            {f.type === 'list' ? (
              <textarea id={id} className="rl-input" rows={Math.min(10, Math.max(3, items(v) + 1))} value={v} onChange={e => set(f.key, e.target.value)} />
            ) : (
              <input id={id} className="rl-input" type={f.type === 'number' ? 'number' : 'text'} step="any" min={f.min} max={f.max} value={v} onChange={e => set(f.key, e.target.value)} aria-invalid={!!p} />
            )}
            <div className="rl-meta">
              {p ? <span className="rl-err">{p}{p === 'Enter a number' && f.min != null && f.max != null ? ` (${f.min} to ${f.max})` : ''}</span>
                : <span>{f.type === 'list' ? `One per line. ${items(v)} item${items(v) === 1 ? '' : 's'}.` : f.type === 'number' && f.min != null && f.max != null ? `${f.min} to ${f.max}` : ''}</span>}
              {!isDefault && <button type="button" className="rl-reset" onClick={() => set(f.key, asForm(f, f.default))} title="Put back the value the program starts with">Reset to default</button>}
            </div>
            {f.help && <small className="rl-help">{f.help}</small>}
          </>
        )}
        {f.type === 'bool' && !isDefault && <button type="button" className="rl-reset" onClick={() => set(f.key, asForm(f, f.default))}>Reset to default</button>}
      </div>
    );
  };

  return (
    <div className="rl-page">
      <style>{CSS}</style>
      <div className="rl-head">
        <div>
          <h2>Rules &amp; Limits</h2>
          <p>The numbers, limits and wording the program uses. Change them here; nothing needs a developer.</p>
        </div>
        <div className="rl-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a setting..." aria-label="Search a setting" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search">&#10005;</button>}
        </div>
      </div>

      {groups.length > 1 && (
        <div className="rl-chips" role="navigation" aria-label="Groups">
          {groups.map(([g, fs]) => <button key={g} type="button" onClick={() => jump(g)}>{g}<span>{fs.length}</span></button>)}
        </div>
      )}

      {groups.length === 0 && <div className="rl-none">No setting matches &quot;{q}&quot;.</div>}
      {groups.map(([g, fs]) => (
        <section key={g} id={'rl-' + g.replace(/\W+/g, '-')} className="rl-card">
          <h3>{g}</h3>
          <div className="rl-grid">{fs.map(field)}</div>
        </section>
      ))}

      <div className={`rl-bar${changed.length ? ' on' : ''}`} role="status">
        <span>{changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'} not saved` : 'All changes are saved'}{bad.length > 0 && <b className="rl-barerr"> &middot; {bad.length} value{bad.length === 1 ? '' : 's'} to correct</b>}</span>
        <span className="rl-bar-actions">
          <button type="button" className="btn-o" onClick={discard} disabled={!changed.length || saving}>Discard</button>
          <button type="button" className="btn-premium" onClick={save} disabled={!changed.length || bad.length > 0 || saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </span>
      </div>
    </div>
  );
}

const CSS = `
.rl-page { display:flex; flex-direction:column; gap:14px; }
.rl-head { display:flex; justify-content:space-between; align-items:flex-end; gap:14px; flex-wrap:wrap; }
.rl-head h2 { margin:0; font-size:1.25rem; } .rl-head p { margin:3px 0 0; font-size:.84rem; color:#64748b; }
.rl-search { position:relative; width:280px; max-width:100%; }
.rl-search svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:#94a3b8; }
.rl-search input { width:100%; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:10px; padding:8px 30px 8px 32px; font-size:.86rem; font-family:inherit; background:#fff; }
.rl-search input:focus, .rl-input:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.rl-search button { position:absolute; right:6px; top:50%; transform:translateY(-50%); border:none; background:none; color:#94a3b8; cursor:pointer; font-size:.8rem; padding:4px; }
.rl-chips { display:flex; gap:6px; flex-wrap:wrap; }
.rl-chips button { border:1px solid #e2e8f0; background:#fff; border-radius:20px; padding:4px 12px; font-size:.76rem; font-weight:600; color:#475569; cursor:pointer; font-family:inherit; display:inline-flex; gap:6px; align-items:center; }
.rl-chips button span { background:var(--brand-soft-2,#f4ede7); color:var(--brand-dark); border-radius:20px; padding:0 7px; font-size:.68rem; }
.rl-chips button:hover { border-color:var(--brand-line); background:var(--brand-soft); color:var(--brand-dark); }
.rl-none { text-align:center; color:#94a3b8; padding:30px; }
.rl-card { background:#fff; border:1px solid #eadfd5; border-radius:14px; padding:14px 18px 18px; scroll-margin-top:12px; }
.rl-card h3 { margin:0 0 12px; font-size:.95rem; }
.rl-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px 18px; align-items:start; }
.rl-field { display:flex; flex-direction:column; gap:4px; min-width:0; padding-left:0; position:relative; }
.rl-field.wide { grid-column:1 / -1; }
.rl-label { font-size:.78rem; font-weight:700; color:#334155; display:flex; align-items:center; gap:6px; }
.rl-dot { width:7px; height:7px; border-radius:50%; background:#f59e0b; display:inline-block; }
.rl-input { width:100%; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:9px; padding:8px 11px; font-size:.88rem; font-family:inherit; background:#fff; color:#1e293b; }
textarea.rl-input { line-height:1.5; resize:vertical; }
.rl-field.bad .rl-input { border-color:#dc2626; background:#fef2f2; }
.rl-field.changed .rl-input { border-color:#f59e0b; }
.rl-meta { display:flex; justify-content:space-between; gap:8px; font-size:.7rem; color:#94a3b8; min-height:14px; }
.rl-err { color:#b91c1c; font-weight:600; }
.rl-help { font-size:.74rem; color:#64748b; line-height:1.45; }
.rl-reset { border:none; background:none; color:var(--brand); font-size:.7rem; font-weight:600; cursor:pointer; padding:0; font-family:inherit; text-align:left; align-self:flex-start; }
.rl-reset:hover { text-decoration:underline; }
.rl-field.bool { grid-column:1 / -1; border-top:1px solid #f1e8df; padding-top:10px; }
.rl-field.bool:first-child { border-top:none; padding-top:0; }
.rl-toggle { display:flex; justify-content:space-between; align-items:center; gap:16px; cursor:pointer; }
.rl-toggle-text { display:flex; flex-direction:column; gap:2px; } .rl-toggle-text b { font-size:.86rem; color:#1e293b; } .rl-toggle-text small { font-size:.74rem; color:#64748b; line-height:1.45; }
.rl-toggle input { position:absolute; opacity:0; pointer-events:none; }
.rl-switch { width:38px; height:22px; border-radius:20px; background:#cbd5e1; position:relative; flex-shrink:0; transition:background .15s; }
.rl-switch::after { content:''; position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.3); transition:transform .15s; }
.rl-toggle input:checked + .rl-switch { background:var(--brand); } .rl-toggle input:checked + .rl-switch::after { transform:translateX(16px); }
.rl-toggle input:focus-visible + .rl-switch { box-shadow:0 0 0 3px rgba(111,78,55,.25); }
.rl-bar { position:sticky; bottom:12px; z-index:20; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:10px 14px; box-shadow:0 10px 30px -14px rgba(78,54,38,.4); font-size:.84rem; color:#64748b; }
.rl-bar.on { border-color:#f59e0b; color:#92400e; background:#fffbeb; }
.rl-barerr { color:#b91c1c; }
.rl-bar-actions { display:flex; gap:8px; }
.rl-bar .btn-o, .rl-bar .btn-premium { height:32px; padding:0 16px; font-size:.82rem; }
.rl-bar .btn-premium:disabled, .rl-bar .btn-o:disabled { opacity:.45; cursor:default; }
@media (max-width:600px) { .rl-grid { grid-template-columns:1fr; } .rl-search { width:100%; } }
`;
