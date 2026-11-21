import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { Link, useNavigate } from 'react-router-dom';
import { API, auth, SettingsCard } from './shared';

// Settings > Request Mails: which Email Template is used for each mail of each request (leave, work from home, missed punch,
// late coming). A step left on "Standard mail" sends the built-in wording. The employee's reason is in every mail.
// Templates are made in Template Management; "+ New" below opens the editor with the category chosen and the standard wording to start from.
export default function RequestMails({ saving, setSaving }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [map, setMap] = useState({});
  const [saved, setSaved] = useState({});

  const load = () => fetch(`${API}/settings/request-mails`, { headers: auth() })
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.kinds) throw new Error(d.detail || (r.status === 401 ? 'Your session has ended. Please log in again.' : 'Could not load this page (error ' + r.status + ').')); return d; })
    .then(d => { setData(d); setMap(d.map || {}); setSaved(d.map || {}); })
    .catch(e => setLoadErr(e.message || 'Could not load this page.'));
  useEffect(() => { load(); }, []); // eslint-disable-line

  // a choice that points to a template that was deleted counts as "Standard mail"
  const known = useMemo(() => new Set(data ? Object.values(data.byKind).flat().map(t => t.id) : []), [data]);
  const clean = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v && known.has(v)));
  const dirty = data && JSON.stringify(clean(map)) !== JSON.stringify(clean(saved));
  const changed = data ? Object.keys({ ...clean(map), ...clean(saved) }).filter(k => clean(map)[k] !== clean(saved)[k]).length : 0;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/request-mails`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ map: clean(map) }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1300, showConfirmButton: false });
      await load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setSaving(false); }
  };

  // leaving this page for the editor with unsaved choices asks first
  const leave = async (go) => {
    if (dirty) { const c = await Swal.fire({ icon: 'question', title: 'Leave without saving?', text: 'The templates you picked here are not saved yet.', showCancelButton: true, confirmButtonText: 'Leave' }); if (!c.isConfirmed) return; }
    go();
  };
  const category = (kind, label) => data.categoryOf[kind] || label;
  const editTemplate = (t) => leave(() => { sessionStorage.removeItem('tpl_draft'); navigate(`/settings/template-editor?id=${t.id}&from=request-mails`); });
  // a new template starts from the standard wording of that step, in the request's category
  const newTemplate = (kind, label, ev) => leave(() => {
    sessionStorage.removeItem('tpl_draft');
    const st = ev ? data.starters?.[`${kind}.${ev}`] : null;
    if (st) sessionStorage.setItem('tpl_draft', JSON.stringify({ name: st.name + ' (new)', subject: st.subject, body: st.body, variables: st.variables, template_type: category(kind, label), cc_emails: '', bcc_emails: '', manual: true }));
    navigate(`/settings/template-editor?category=${encodeURIComponent(category(kind, label))}&from=request-mails`);
  });

  if (loadErr) return <div style={{ padding: 20, color: '#b91c1c', background: '#fef2f2', borderRadius: 10, fontSize: 14 }}><b>Could not load Request Mails.</b><div style={{ marginTop: 6 }}>{loadErr}</div></div>;
  if (!data) return <div className="p-4 text-center">Loading...</div>;

  return (
    <SettingsCard title="Request Mails" desc="Leave, Work From Home, Missed punch and Late coming. The employee sends the request, the reporting manager approves first, then HR, then the employee gets the final mail.">
      <style>{CSS}</style>

      <div className="rq-how">
        <b>How it works</b>
        <p>Each mail can use the <b>standard mail</b> (the built-in wording) or a <b>template</b> you choose. To change the wording, pick a template, or press <b>+ New</b> to start one from the standard wording. Templates live in <Link to="/settings/templates">Template Management</Link>, in the category of the request (Leave, Work From Home...).</p>
      </div>

      {Object.entries(data.kinds).sort(([x], [y]) => { const o = ['leave', 'wfh', 'missed_punch', 'late_coming']; const r = (k) => (o.includes(k) ? o.indexOf(k) : 99); return r(x) - r(y); }).map(([kind, kindLabel]) => {
        const list = data.byKind[kind] || [];
        return (
          <section key={kind} className="rq-card">
            <div className="rq-head">
              <div>
                <h3>{kindLabel}</h3>
                <small>{list.length ? `${list.length} template${list.length === 1 ? '' : 's'} in the "${category(kind, kindLabel)}" category` : `No template yet in the "${category(kind, kindLabel)}" category`}</small>
              </div>
              <button type="button" className="um-b" onClick={() => newTemplate(kind, kindLabel, null)}>+ New template</button>
            </div>
            <div className="rq-rows">
              {Object.entries(data.events).map(([ev, evLabel]) => {
                const key = `${kind}.${ev}`, val = known.has(map[key]) ? map[key] : '';
                const chosen = list.find(t => t.id === val);
                const isChanged = (clean(map)[key] || '') !== (clean(saved)[key] || '');
                return (
                  <div key={ev} className={`rq-row${isChanged ? ' changed' : ''}`}>
                    <div className="rq-ev">{evLabel}{isChanged && <i className="rq-dot" title="Changed, not saved yet" />}</div>
                    <div className="rq-pick">
                      <select className="rq-sel" value={val} onChange={e => setMap(m => ({ ...m, [key]: e.target.value }))} aria-label={`${kindLabel}: ${evLabel}`}>
                        <option value="">Standard mail (built in)</option>
                        {list.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      {chosen && <button type="button" className="um-b" onClick={() => editTemplate(chosen)} title="Change the wording of this template">Edit</button>}
                      <button type="button" className="um-b" onClick={() => newTemplate(kind, kindLabel, ev)} title="Make a new template from the standard wording of this mail">+ New</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <details className="rq-vars">
        <summary>Words you can use in a template</summary>
        <p>Write them in the subject or the body, for example <code>{'{employee_name}'}</code>. They are replaced when the mail is sent.</p>
        <div className="rq-grid">
          {data.variables.map(([k, d]) => <div key={k}><code>{`{${k}}`}</code> <span>{d}</span></div>)}
        </div>
        <p>Categories are managed in <Link to="/masters/template-categories">Masters &gt; Template Categories</Link>.</p>
      </details>

      <div className={`rq-bar${dirty ? ' on' : ''}`} role="status">
        <span>{dirty ? `${changed} change${changed === 1 ? '' : 's'} not saved` : 'All changes are saved'}</span>
        <span className="rq-bar-actions">
          <button type="button" className="btn-o" onClick={() => setMap(saved)} disabled={!dirty || saving}>Discard</button>
          <button type="button" className="btn-premium" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </span>
      </div>
    </SettingsCard>
  );
}

const CSS = `
.rq-how { background:var(--brand-soft,#f4ede7); border:1px solid var(--brand-line,#d9c5b3); border-radius:10px; padding:11px 14px; margin-bottom:14px; font-size:.84rem; color:#475569; line-height:1.55; }
.rq-how > b { display:block; font-size:.72rem; text-transform:uppercase; letter-spacing:.4px; color:var(--brand-dark); margin-bottom:3px; } .rq-how p { margin:0; }
.rq-how a, .rq-vars a { color:var(--brand); font-weight:600; }
.rq-card { background:#fff; border:1px solid #eadfd5; border-radius:12px; margin-bottom:12px; overflow:hidden; }
.rq-head { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:11px 16px; background:#fbf8f5; border-bottom:1px solid #f1e8df; }
.rq-head h3 { margin:0; font-size:.95rem; } .rq-head small { font-size:.74rem; color:#94a3b8; }
.rq-rows { padding:2px 16px; }
.rq-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.3fr); gap:14px; align-items:center; padding:10px 0; border-bottom:1px solid #f4f0ec; }
.rq-row:last-child { border-bottom:none; }
.rq-ev { font-size:.84rem; color:#334155; display:flex; align-items:center; gap:7px; line-height:1.4; }
.rq-dot { width:7px; height:7px; border-radius:50%; background:#f59e0b; display:inline-block; flex-shrink:0; }
.rq-pick { display:flex; gap:6px; align-items:center; min-width:0; }
.rq-sel { flex:1; min-width:0; border:1px solid #e2e8f0; border-radius:9px; padding:7px 10px; font-size:.84rem; font-family:inherit; background:#fff; color:#1e293b; }
.rq-sel:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.rq-row.changed .rq-sel { border-color:#f59e0b; }
.um-b { height:30px; padding:0 11px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; font-family:inherit; white-space:nowrap; }
.um-b:hover { border-color:var(--brand-line); color:var(--brand-dark); background:var(--brand-soft); }
.rq-vars { background:#f8fafc; border:1px solid #eadfd5; border-radius:10px; padding:10px 14px; margin:4px 0 14px; font-size:.82rem; color:#64748b; }
.rq-vars summary { cursor:pointer; font-weight:700; color:#334155; font-size:.84rem; } .rq-vars p { margin:8px 0; }
.rq-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:4px 16px; } .rq-grid code { color:var(--brand-dark); }
.rq-bar { position:sticky; bottom:12px; z-index:20; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:10px 14px; box-shadow:0 10px 30px -14px rgba(78,54,38,.4); font-size:.84rem; color:#64748b; }
.rq-bar.on { border-color:#f59e0b; color:#92400e; background:#fffbeb; }
.rq-bar-actions { display:flex; gap:8px; } .rq-bar .btn-o, .rq-bar .btn-premium { height:32px; padding:0 16px; font-size:.82rem; } .rq-bar .btn-premium:disabled, .rq-bar .btn-o:disabled { opacity:.45; cursor:default; }
@media (max-width:760px) { .rq-row { grid-template-columns:1fr; gap:6px; } .rq-pick { flex-wrap:wrap; } }
`;
