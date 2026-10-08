import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField } from './shared';
import { loadStatusMaster, pillStyle } from '../shared/useStatusMaster';

const BEHAVIORS = [
  ['present', 'Present - person worked'],
  ['absent', 'Absent - did not come'],
  ['half_day', 'Half day'],
  ['week_off', 'Week off'],
  ['holiday', 'Holiday'],
  ['wfh', 'Work from home'],
  ['extra_work', 'Extra work (week off / holiday)'],
  ['other', 'Other'],
];
const behaviorLabel = (b) => (BEHAVIORS.find(x => x[0] === b) || [b, b || '-'])[1].split(' - ')[0];

const EMPTY = {
  id: null, group_key: 'attendance', code: '', label: '', color: '#6366f1', description: '', used_for: '',
  behavior: 'other', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: '',
  can_login: 0, is_working: 0, in_attendance: 0, is_active: 1, sort_order: 100, is_system: 0,
};

const styles = `
.sm-tabs { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
.sm-tab { padding:8px 18px; border-radius:10px; border:1.5px solid #e2e8f0; background:#fff; color:#475569; font-weight:700; font-size:.88rem; cursor:pointer; transition:all .15s; }
.sm-tab.on { border-color:#6366f1; background:#eef2ff; color:#4338ca; }
.sm-note { margin:0 0 14px; padding:10px 14px; border-radius:10px; background:#f8fafc; border:1px solid #eef2f7; font-size:.82rem; color:#64748b; line-height:1.5; }
.sm-wrap { overflow-x:auto; border:1.5px solid #e2e8f0; border-radius:14px; background:#fff; }
.sm-table { width:100%; border-collapse:collapse; min-width:980px; }
.sm-table th { text-align:left; padding:11px 12px; font-size:.7rem; text-transform:uppercase; letter-spacing:.6px; color:#64748b; background:#f8fafc; border-bottom:1.5px solid #e2e8f0; white-space:nowrap; }
.sm-table td { padding:13px 12px; border-bottom:1px solid #f1f5f9; vertical-align:top; font-size:.85rem; color:#475569; line-height:1.45; }
.sm-table tbody tr:last-child td { border-bottom:none; }
.sm-table tbody tr:hover { background:#fafbff; }
.sm-n { width:44px; color:#94a3b8; font-weight:700; }
.sm-code { font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:700; color:#0f172a; background:#f1f5f9; padding:2px 8px; border-radius:6px; font-size:.8rem; }
.sm-built { display:block; font-size:.68rem; color:#94a3b8; margin-top:5px; }
.sm-chip { display:inline-block; font-size:.72rem; font-weight:600; padding:2px 8px; border-radius:6px; margin:0 4px 4px 0; background:#f1f5f9; color:#64748b; white-space:nowrap; }
.sm-chip.on { background:#ecfdf5; color:#047857; }
.sm-chip.warn { background:#fef2f2; color:#b91c1c; }
.sm-src { font-size:.72rem; color:#94a3b8; margin-top:2px; }
.sm-act { white-space:nowrap; }
.sm-btn { border:none; border-radius:8px; padding:6px 12px; font-weight:600; font-size:.8rem; cursor:pointer; margin-right:6px; transition:filter .15s; }
.sm-btn:hover { filter:brightness(.95); }
.sm-edit { background:#ede9fe; color:#5b21b6; }
.sm-del { background:#fee2e2; color:#991b1b; }
.sm-sw { position:relative; display:inline-block; width:38px; height:22px; }
.sm-sw input { opacity:0; width:0; height:0; }
.sm-sw span { position:absolute; inset:0; background:#cbd5e1; border-radius:22px; transition:.2s; cursor:pointer; }
.sm-sw span::before { content:''; position:absolute; height:16px; width:16px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; }
.sm-sw input:checked + span { background:#10b981; }
.sm-sw input:checked + span::before { transform:translateX(16px); }
.sm-sw input:disabled + span { opacity:.5; cursor:not-allowed; }
.sm-ov { position:fixed; inset:0; background:rgba(15,23,42,.5); z-index:5000; display:flex; align-items:center; justify-content:center; padding:16px; }
.sm-modal { background:#fff; border-radius:18px; width:660px; max-width:100%; max-height:92vh; overflow-y:auto; box-shadow:0 25px 80px rgba(15,23,42,.3); }
.sm-mh { display:flex; justify-content:space-between; align-items:center; padding:18px 24px; border-bottom:1.5px solid #e2e8f0; position:sticky; top:0; background:#fff; z-index:1; }
.sm-mh h3 { margin:0; font-size:1.05rem; }
.sm-x { border:none; background:none; font-size:20px; color:#94a3b8; cursor:pointer; }
.sm-mb { padding:20px 24px; }
.sm-mf { display:flex; justify-content:flex-end; gap:10px; padding:14px 24px; border-top:1.5px solid #e2e8f0; background:#f8fafc; border-radius:0 0 18px 18px; position:sticky; bottom:0; }
.sm-sec { font-size:.72rem; text-transform:uppercase; letter-spacing:.6px; color:#94a3b8; font-weight:700; margin:16px 0 8px; }
.sm-checks { display:flex; flex-direction:column; gap:9px; font-size:.9rem; color:#334155; }
.sm-checks label { display:flex; align-items:center; gap:9px; cursor:pointer; }
`;

export default function StatusMaster() {
  const [tab, setTab] = useState('attendance');
  const [rows, setRows] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/status-master?all=1`, { headers: auth() })
      .then(r => r.json())
      .then(d => { setRows(d.statuses || []); setCanEdit(!!d.can_edit); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Opening the popup must not move or scroll the page behind it.
  useEffect(() => {
    if (!form) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [form]);

  const list = rows.filter(r => r.group_key === tab);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/status-master`, {
        method: form.id ? 'PUT' : 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      setForm(null);
      await loadStatusMaster(true); // refresh what other pages show
      load();
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1200, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Could not save', text: e.message }); }
    finally { setSaving(false); }
  };

  const remove = async (r) => {
    if (r.is_system) {
      Swal.fire({
        icon: 'info', title: 'Built-in status',
        html: `<b>${r.label}</b> is built in, so it cannot be deleted. The system uses it by code (for example when an employee is invited, approved or marked on a day).<br/><br/>You can switch it <b>off</b> (Active toggle) or rename and recolour it instead.`,
      });
      return;
    }
    const c = await Swal.fire({ icon: 'warning', title: `Delete "${r.label}"?`, text: 'This works only when nothing is using it.', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
    if (!c.isConfirmed) return;
    const res = await fetch(`${API}/status-master?id=${r.id}`, { method: 'DELETE', headers: auth() });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { Swal.fire({ icon: 'error', title: 'Could not delete', text: d.detail || 'Failed' }); return; }
    await loadStatusMaster(true); load();
    Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
  };

  const toggleActive = async (r) => {
    const res = await fetch(`${API}/status-master`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, is_active: r.is_active ? 0 : 1 }) });
    if (res.ok) { await loadStatusMaster(true); load(); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value }));
  const isAtt = form && form.group_key === 'attendance';

  const modal = form && createPortal(
    <div className="sm-ov" onClick={() => !saving && setForm(null)}>
      <div className="sm-modal" onClick={e => e.stopPropagation()}>
        <div className="sm-mh">
          <h3>{form.id ? 'Edit' : 'Add'} {isAtt ? 'attendance' : 'employee'} status</h3>
          <button className="sm-x" onClick={() => setForm(null)} aria-label="Close">✕</button>
        </div>
        <div className="sm-mb">
          <div className="sm-sec" style={{ marginTop: 0 }}>Basic details</div>
          <div className="settings-grid">
            <FormField label="Code (cannot be changed later)">
              <input className="settings-input" value={form.code} disabled={!!form.id} placeholder={isAtt ? 'e.g. CL' : 'e.g. on_notice'} onChange={set('code')} />
            </FormField>
            <FormField label="Label (shown on screens)">
              <input className="settings-input" value={form.label} onChange={set('label')} />
            </FormField>
            <FormField label="Colour">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="color" value={form.color} onChange={set('color')} style={{ width: 60, height: 38, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: 2, background: '#fff' }} />
                <span style={pillStyle(form.color)}>{form.label || 'Preview'}</span>
              </div>
            </FormField>
            <FormField label="Order in lists">
              <input type="number" className="settings-input" value={form.sort_order} onChange={set('sort_order')} />
            </FormField>
          </div>

          <div className="sm-sec">Explanation (shown to HR)</div>
          <FormField label="What it means" fullWidth>
            <textarea className="settings-input" rows={2} value={form.description} onChange={set('description')} />
          </FormField>
          <FormField label="What the system does with it" fullWidth>
            <textarea className="settings-input" rows={2} value={form.used_for} onChange={set('used_for')} />
          </FormField>

          {isAtt ? (
            <>
              <div className="sm-sec">How it counts</div>
              <div className="settings-grid">
                <FormField label="Behaviour">
                  <select className="settings-input" value={form.behavior} onChange={set('behavior')}>
                    {BEHAVIORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </FormField>
                <FormField label="TeamOffice codes (comma separated)">
                  <input className="settings-input" value={form.source_codes} placeholder="e.g. P, PRESENT" onChange={set('source_codes')} />
                </FormField>
                <FormField label="Counts as present (0 - 1)">
                  <input type="number" step="0.5" min="0" max="1" className="settings-input" value={form.present_weight} onChange={set('present_weight')} />
                </FormField>
                <FormField label="Unpaid part of the day (0 - 1)">
                  <input type="number" step="0.5" min="0" max="1" className="settings-input" value={form.unpaid_weight} onChange={set('unpaid_weight')} />
                </FormField>
              </div>
              <div className="sm-checks" style={{ marginTop: 10 }}>
                <label><input type="checkbox" checked={!!form.extra_pay} onChange={set('extra_pay')} /> Each such day earns extra-work pay</label>
              </div>
            </>
          ) : (
            <>
              <div className="sm-sec">What this status allows</div>
              <div className="sm-checks">
                <label><input type="checkbox" checked={!!form.can_login} onChange={set('can_login')} /> Can log in</label>
                <label><input type="checkbox" checked={!!form.is_working} onChange={set('is_working')} /> Working employee (payroll, dashboard counts, salary sheet)</label>
                <label><input type="checkbox" checked={!!form.in_attendance} onChange={set('in_attendance')} /> Show in attendance lists and summaries</label>
              </div>
            </>
          )}
        </div>
        <div className="sm-mf">
          <button className="btn-premium" style={{ background: '#64748b' }} onClick={() => setForm(null)} disabled={saving}>Cancel</button>
          <button className="btn-premium" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <SettingsCard
      title="Status Master"
      desc="Every employee status and attendance status lives here, with what it means and what the system does with it. Pages, filters, salary and attendance all read from this list."
      actions={canEdit && <button className="btn-premium" onClick={() => setForm({ ...EMPTY, group_key: tab })}>+ Add {tab === 'attendance' ? 'attendance' : 'employee'} status</button>}
    >
      <style>{styles}</style>

      <div className="sm-tabs">
        {[['attendance', 'Attendance Status'], ['employee', 'Employee Status']].map(([k, label]) => (
          <button key={k} className={`sm-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <p className="sm-note">
        {tab === 'attendance'
          ? 'Attendance statuses are saved against every day (Daily Attendance, TeamOffice sync, WFH, holidays). "Present" and "Unpaid part" decide how a day counts in attendance totals and in the salary sheet.'
          : 'Employee statuses decide who can log in, who is a working employee (payroll, dashboard) and who appears in attendance. Built-in statuses are assigned by the HR flow (invite, submit, approve, send back, drop), so they cannot be deleted - but you can rename them, recolour them and change what they allow.'}
      </p>

      <div className="sm-wrap">
        <table className="sm-table">
          <thead>
            <tr>
              <th>#</th><th>Code</th><th>Status</th><th>What it means</th><th>What it is used for</th>
              <th>{tab === 'attendance' ? 'How it counts' : 'Allows'}</th><th>Active</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 28 }}>Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 28 }}>No statuses yet.</td></tr>
            ) : list.map((r, i) => (
              <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.55 }}>
                <td className="sm-n">{i + 1}</td>
                <td><span className="sm-code">{r.code}</span></td>
                <td>
                  <span style={pillStyle(r.color)}>{r.label}</span>
                  {r.is_system ? <span className="sm-built">built-in</span> : null}
                </td>
                <td style={{ minWidth: 190 }}>{r.description || '-'}</td>
                <td style={{ minWidth: 230 }}>{r.used_for || '-'}</td>
                <td style={{ minWidth: 190 }}>
                  {tab === 'attendance' ? (
                    <>
                      <span className="sm-chip">{behaviorLabel(r.behavior)}</span>
                      <span className={`sm-chip ${Number(r.present_weight) > 0 ? 'on' : ''}`}>Present: {Number(r.present_weight)}</span>
                      <span className={`sm-chip ${Number(r.unpaid_weight) > 0 ? 'warn' : 'on'}`}>Unpaid: {Number(r.unpaid_weight)}</span>
                      {r.extra_pay ? <span className="sm-chip on">Extra pay</span> : null}
                      {r.source_codes ? <div className="sm-src">TeamOffice: {r.source_codes}</div> : null}
                    </>
                  ) : (
                    <>
                      <span className={`sm-chip ${r.can_login ? 'on' : ''}`}>Can log in</span>
                      <span className={`sm-chip ${r.is_working ? 'on' : ''}`}>Working</span>
                      <span className={`sm-chip ${r.in_attendance ? 'on' : ''}`}>In attendance</span>
                    </>
                  )}
                </td>
                <td>
                  <label className="sm-sw" title="Switch off to stop using it without deleting it">
                    <input type="checkbox" checked={!!r.is_active} disabled={!canEdit} onChange={() => toggleActive(r)} />
                    <span />
                  </label>
                </td>
                <td className="sm-act">
                  {canEdit ? (
                    <>
                      <button className="sm-btn sm-edit" onClick={() => setForm({ ...r })}>Edit</button>
                      <button className="sm-btn sm-del" onClick={() => remove(r)}>Delete</button>
                    </>
                  ) : <span style={{ color: '#cbd5e1' }}>-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal}
    </SettingsCard>
  );
}
