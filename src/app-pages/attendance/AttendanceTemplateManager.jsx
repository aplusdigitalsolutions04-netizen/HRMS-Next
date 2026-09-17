import React, { useState, useEffect, useRef } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const DEFAULT_COLUMNS = [
  { key: 'emp_code', label: 'EmpCode', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'department', label: 'Department', required: false },
  { key: 'date', label: 'Date', required: true },
  { key: 'day', label: 'Day', required: false },
  { key: 'shift', label: 'Shift', required: false },
  { key: 'in_time', label: 'IN', required: true },
  { key: 'out_time', label: 'OUT', required: true },
  { key: 'work_ot', label: 'Work+OT', required: false },
  { key: 'ot', label: 'OT', required: false },
  { key: 'less_hrs', label: 'Less Hrs', required: false },
  { key: 'status', label: 'Status', required: true },
  { key: 'remark', label: 'Remark', required: false },
];

const Chip = ({ label, required }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: '#f1f5f9', fontSize: 12, color: '#334155' }}>
    {label}{required ? <span style={{ color: '#ef4444', fontSize: 10 }}>*</span> : null}
  </span>
);

export default function AttendanceTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchTemplates = () => {
    setLoading(true);
    fetch(`${API}/attendance/templates`, { headers: auth() })
      .then(r => r.json())
      .then(d => { setTemplates(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setTemplates([]); setLoading(false); });
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/attendance/templates/upload`, { method: 'POST', headers: auth(), body: fd });
      if (!res.ok) { let m = 'Upload failed'; try { const d = await res.clone().json(); m = d.detail || m; } catch(_) {} throw new Error(m); }
      await fetchTemplates();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleActivate = (id) => {
    fetch(`${API}/attendance/templates/${id}/activate`, { method: 'POST', headers: auth() })
      .then(r => r.json()).then(() => fetchTemplates()).catch(() => alert('Failed to activate'));
  };

  const handleDelete = (tpl) => {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
    fetch(`${API}/attendance/templates/${tpl.id}`, { method: 'DELETE', headers: auth() })
      .then(r => r.json()).then(() => fetchTemplates()).catch(() => alert('Failed to delete'));
  };

  const s = {
    btn: { padding: '8px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnP: { padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    card: { background: '#fff', borderRadius: 16, border: '1px solid #f1f0ff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' },
    badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  };

  return (
    <div style={{ padding: '0 28px', maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        .atm-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
        .atm-ac{display:flex;gap:6px}
        .atm-ac button{padding:5px 12px;border-radius:7px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;font-size:12px;font-weight:600;cursor:pointer}
        .atm-ac button:hover{border-color:#6366f1;color:#6366f1}
        .atm-ac .del:hover{border-color:#ef4444;color:#ef4444;background:#fef2f2}
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Attendance Upload Templates</h4>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>Configure Excel column layout for attendance uploads.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button style={s.btn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ verticalAlign: 'middle', marginRight: 6 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? 'Uploading...' : 'Upload Excel'}
          </button>
          <button style={s.btnP} onClick={() => { setEditing({ name: '', columns: [...DEFAULT_COLUMNS] }); setShowForm(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ verticalAlign: 'middle', marginRight: 6 }}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Template
          </button>
        </div>
      </div>

      {loading ? (
        <div style={s.card}>
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'atmSpin .6s linear infinite', marginBottom: 8 }} />
            <div>Loading templates...</div>
          </div>
        </div>
      ) : templates.length === 0 ? (
        <div style={{ ...s.card, padding: 60, textAlign: 'center' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 12 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <h5 style={{ margin: '0 0 4px', fontWeight: 600, color: '#64748b', fontSize: 15 }}>No Templates Yet</h5>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>Create your first attendance upload template to define the Excel column layout.</p>
        </div>
      ) : (
        <div className="atm-g">
          {templates.map(tpl => (
            <div key={tpl.id} style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{tpl.name}</h5>
                <span style={{ ...s.badge, background: tpl.is_active ? '#dcfce7' : '#f1f5f9', color: tpl.is_active ? '#15803d' : '#64748b' }}>
                  {tpl.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {(tpl.columns || []).map(c => <Chip key={c.key} label={c.label} required={c.required} />)}
                </div>
                <div className="atm-ac">
                  <button onClick={() => { setEditing({ ...tpl }); setShowForm(true); }}>Edit</button>
                  {!tpl.is_active && (
                    <button style={{ borderColor: '#6366f1', color: '#6366f1' }} onClick={() => handleActivate(tpl.id)}>Activate</button>
                  )}
                  <button className="del" onClick={() => handleDelete(tpl)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && editing && (
        <TemplateForm
          template={editing}
          onSave={() => { setShowForm(false); setEditing(null); fetchTemplates(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function TemplateForm({ template, onSave, onCancel }) {
  const [name, setName] = useState(template.name || '');
  const [columns, setColumns] = useState(template.columns || []);
  const [saving, setSaving] = useState(false);

  const handleLabelChange = (idx, val) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], label: val };
    setColumns(updated);
  };

  const handleRequiredToggle = (idx) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], required: !updated[idx].required };
    setColumns(updated);
  };

  const moveCol = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= columns.length) return;
    const updated = [...columns];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    setColumns(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) { alert('Template name is required'); return; }
    setSaving(true);
    try {
      const isNew = !template.id;
      const url = isNew ? `${API}/attendance/templates` : `${API}/attendance/templates/${template.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), columns }) });
      if (!res.ok) throw new Error('Failed to save');
      onSave();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }} onClick={onCancel} />
      <div style={{ position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 20, padding: 28, width: '90%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', zIndex: 1001, boxShadow: '0 25px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h4 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>
            {template.id ? 'Edit Template' : 'New Template'}
          </h4>
          <button onClick={onCancel} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#64748b' }}>&times;</button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>Template Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Essl Format"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Column Definitions</label>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Use arrows to reorder</span>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 100px 50px', gap: 0, background: '#f8fafc', padding: '9px 14px', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              <span>Order</span><span>Key</span><span>Label</span><span>Req</span>
            </div>
            {columns.map((col, i) => (
              <div key={col.key} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 100px 50px', gap: 0, alignItems: 'center', padding: '7px 14px', borderBottom: i < columns.length - 1 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <div style={{ display: 'flex', gap: 1 }}>
                  <button onClick={() => moveCol(i, -1)} disabled={i === 0}
                    style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#e2e8f0' : '#94a3b8', fontSize: 14, padding: '1px 3px', lineHeight: 1 }}>&#9650;</button>
                  <button onClick={() => moveCol(i, 1)} disabled={i === columns.length - 1}
                    style={{ border: 'none', background: 'none', cursor: i === columns.length - 1 ? 'default' : 'pointer', color: i === columns.length - 1 ? '#e2e8f0' : '#94a3b8', fontSize: 14, padding: '1px 3px', lineHeight: 1 }}>&#9660;</button>
                </div>
                <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>{col.key}</span>
                <input value={col.label} onChange={e => handleLabelChange(i, e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, width: '100%' }} />
                <input type="checkbox" checked={col.required} onChange={() => handleRequiredToggle(i)}
                  style={{ justifySelf: 'center', cursor: 'pointer', width: 16, height: 16 }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
          <button onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? '#a5b4fc' : '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </>
  );
}
