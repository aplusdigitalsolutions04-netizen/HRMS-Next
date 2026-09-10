import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField, SaveButton } from './shared';
import Pagination, { paginate } from '../shared/Pagination';

const REMINDERS_PAGE_SIZE = 10;

export default function CommunicationSettings({ saving, setSaving }) {
  const [settings, setSettings] = useState({
    default_reminder_delay: '30',
    reminder_recipient_email: 'hr@aplusdigitalsolutions.com',
    enable_reminder_emails: 'true',
    enable_draft_creation: 'true',
  });
  const [isCustom, setIsCustom] = useState(false);
  const [customHours, setCustomHours] = useState('');

  useEffect(() => {
    fetch(`${API}/settings/system`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        const val = d.default_reminder_delay || '30';
        const known = ['15', '30', '60', '120', '240', '1440', '2880'];
        const custom = !known.includes(val);
        setIsCustom(custom);
        if (custom && val) setCustomHours(String(parseInt(val) / 60));
        setSettings(prev => ({
          ...prev,
          default_reminder_delay: custom ? 'custom' : val,
          reminder_recipient_email: d.reminder_recipient_email || 'hr@aplusdigitalsolutions.com',
          enable_reminder_emails: d.enable_reminder_emails || 'true',
          enable_draft_creation: d.enable_draft_creation || 'true',
        }));
      })
      .catch(() => {});
  }, []);

  const getDelayValue = () => {
    if (settings.default_reminder_delay === 'custom') {
      const h = parseInt(customHours);
      return String(h * 60);
    }
    return settings.default_reminder_delay;
  };

  const save = () => {
    setSaving(true);
    const payload = [
      { setting_key: 'default_reminder_delay', setting_value: getDelayValue() },
      { setting_key: 'reminder_recipient_email', setting_value: settings.reminder_recipient_email },
      { setting_key: 'enable_reminder_emails', setting_value: settings.enable_reminder_emails },
      { setting_key: 'enable_draft_creation', setting_value: settings.enable_draft_creation },
    ];
    fetch(`${API}/settings/system`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async r => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        setSaving(false);
        if (ok) {
          Swal.fire({ icon: 'success', title: 'Saved!', text: data.message || 'Communication settings updated.', timer: 1500, showConfirmButton: false });
        } else {
          Swal.fire({ icon: 'error', title: 'Error', text: data.detail || 'Failed to save settings.' });
        }
      })
      .catch(() => {
        setSaving(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save settings.' });
      });
  };

  return (
    <>
    <SettingsCard title="Communication Settings" desc="Configure email reminders and draft preferences">
      <div className="settings-grid">
        <FormField label="Default Reminder Delay" fullWidth>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="settings-input" value={settings.default_reminder_delay} onChange={e => { const v = e.target.value; setIsCustom(v === 'custom'); setSettings(s => ({ ...s, default_reminder_delay: v })); }}>
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="60">1 Hour</option>
              <option value="120">2 Hours</option>
              <option value="240">4 Hours</option>
              <option value="1440">24 Hours</option>
              <option value="2880">48 Hours (2 Days)</option>
              <option value="custom">Custom</option>
            </select>
            {isCustom && (
              <input className="settings-input" type="number" min="1" placeholder="Hours" value={customHours} onChange={e => setCustomHours(e.target.value)} style={{ width: 100 }} />
            )}
          </div>
        </FormField>

        <FormField label="Reminder Recipient Email" fullWidth>
          <input className="settings-input" type="email" value={settings.reminder_recipient_email} onChange={e => setSettings(s => ({ ...s, reminder_recipient_email: e.target.value }))} />
        </FormField>

        <FormField label="Enable Reminder Emails">
          <select className="settings-input" value={settings.enable_reminder_emails} onChange={e => setSettings(s => ({ ...s, enable_reminder_emails: e.target.value }))}>
            <option value="true">ON</option>
            <option value="false">OFF</option>
          </select>
        </FormField>

        <FormField label="Enable Draft Creation">
          <select className="settings-input" value={settings.enable_draft_creation} onChange={e => setSettings(s => ({ ...s, enable_draft_creation: e.target.value }))}>
            <option value="true">ON</option>
            <option value="false">OFF</option>
          </select>
        </FormField>
      </div>

      <div className="settings-actions">
        <SaveButton onClick={save} saving={saving} />
      </div>
    </SettingsCard>
    <CandidateReminderManagement saving={saving} setSaving={setSaving} />
    </>
  );
}

/* ════════════════════════════════════════
   Candidate Reminder Management
   ════════════════════════════════════════ */
const COMMUNICATION_TYPES = [
  'Interview Invitation', 'Interview Reminder', 'Offer Letter',
  'Joining Letter', 'Rejection Email', 'Custom Email',
];

const DELAY_OPTIONS = [
  { value: 15, label: '15 Minutes' },
  { value: 30, label: '30 Minutes' },
  { value: 60, label: '1 Hour' },
  { value: 120, label: '2 Hours' },
  { value: 240, label: '4 Hours' },
  { value: 1440, label: '24 Hours' },
];

function CandidateReminderManagement({ saving, setSaving }) {
  const [reminders, setReminders] = useState([]);
  const [dashboard, setDashboard] = useState({ active_count:0, paused_count:0, overdue_count:0, completed_today:0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [editDelay, setEditDelay] = useState(30);
  const [delayIsCustom, setDelayIsCustom] = useState(false);
  const [customDelayMins, setCustomDelayMins] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(REMINDERS_PAGE_SIZE);
  const pageItems = paginate(reminders, page, pageSize);

  const fetchReminders = useCallback(() => {
    setLoading(true);
    let url = `${API}/reminders?`;
    const params = [];
    if (filterStatus) params.push(`status=${filterStatus}`);
    if (filterType) params.push(`communication_type=${encodeURIComponent(filterType)}`);
    if (search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
    fetch(url + params.join('&'), { headers: auth() })
      .then(r => r.json())
      .then(d => setReminders(Array.isArray(d) ? d : []))
      .catch(() => setReminders([]))
      .finally(() => setLoading(false));
  }, [filterStatus, filterType, search]);

  const fetchDashboard = useCallback(() => {
    fetch(`${API}/reminders/dashboard`, { headers: auth() })
      .then(r => r.json())
      .then(d => setDashboard(d || { active_count:0, paused_count:0, overdue_count:0, completed_today:0 }))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchReminders(); fetchDashboard(); }, [fetchReminders, fetchDashboard]);
  useEffect(() => { setPage(1); }, [filterStatus, filterType, search]);

  const formatDT = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };

  const formatDelay = (minutes) => {
    if (!minutes) return '—';
    if (minutes >= 1440) return `${minutes/1440}d`;
    if (minutes >= 60) return `${minutes/60}h`;
    return `${minutes}m`;
  };

  const openEdit = (r) => {
    setEditing(r);
    const delay = r.custom_delay || r.default_delay || 30;
    const known = DELAY_OPTIONS.find(o => o.value === delay);
    setDelayIsCustom(!known);
    setEditDelay(known ? delay : 30);
    setCustomDelayMins(known ? '' : String(delay));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {};
    if (delayIsCustom) {
      const mins = parseInt(customDelayMins);
      if (isNaN(mins) || mins < 1) { Swal.fire({ icon:'warning', title:'Invalid', text:'Enter valid minutes' }); setSaving(false); return; }
      payload.custom_delay = mins;
      payload.reminder_time = new Date(Date.now() + mins * 60000).toISOString();
    } else if (editDelay !== (editing.custom_delay || editing.default_delay)) {
      payload.custom_delay = editDelay;
      payload.reminder_time = new Date(Date.now() + editDelay * 60000).toISOString();
    }
    try {
      const res = await fetch(`${API}/reminders/${editing.id}`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      Swal.fire({ icon:'success', title:'Updated!', timer:1500, showConfirmButton:false });
      setEditing(null);
      fetchReminders();
      fetchDashboard();
    } catch (e) {
      Swal.fire({ icon:'error', title:'Error', text:e.message });
    }
    setSaving(false);
  };

  const updateStatus = async (r, newStatus, msg) => {
    Swal.fire({
      title: `${newStatus} Reminder?`,
      text: msg,
      icon: 'question', showCancelButton: true, confirmButtonText: newStatus,
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const r2 = await fetch(`${API}/reminders/${r.id}`, {
          method: 'PUT',
          headers: { ...auth(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        const d = await r2.json();
        if (!r2.ok) throw new Error(d.detail || 'Failed');
        Swal.fire({ icon:'success', title:`${newStatus}!`, timer:1500, showConfirmButton:false });
        fetchReminders();
        fetchDashboard();
      } catch (e) {
        Swal.fire({ icon:'error', title:'Error', text:e.message });
      }
    });
  };

  const deleteReminder = (r) => {
    Swal.fire({
      title: 'Delete Reminder?', text: `Remove reminder for ${r.candidate_name}?`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete',
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const r2 = await fetch(`${API}/reminders/${r.id}`, { method: 'DELETE', headers: auth() });
        const d = await r2.json();
        if (!r2.ok) throw new Error(d.detail || 'Failed');
        Swal.fire({ icon:'success', title:'Deleted!', timer:1500, showConfirmButton:false });
        fetchReminders();
        fetchDashboard();
      } catch (e) {
        Swal.fire({ icon:'error', title:'Error', text:e.message });
      }
    });
  };

  const statusBadge = (s) => {
    const map = {
      ACTIVE: { bg:'#dcfce7', c:'#166534', label:'Active' },
      PAUSED: { bg:'#fef3c7', c:'#92400e', label:'Paused' },
      COMPLETED: { bg:'#e0e7ff', c:'#3730a3', label:'Completed' },
      OVERDUE: { bg:'#fee2e2', c:'#991b1b', label:'Overdue' },
      CANCELLED: { bg:'#f1f5f9', c:'#64748b', label:'Cancelled' },
    };
    const m = map[s] || { bg:'#f1f5f9', c:'#64748b', label:s };
    return <span style={{ background:m.bg, color:m.c, padding:'3px 10px', borderRadius:50, fontWeight:700, fontSize:'.76rem', display:'inline-block' }}>{m.label}</span>;
  };

  return (
    <SettingsCard title="Candidate Reminder Management" desc="Manage reminder schedules for all candidates">
      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:22 }}>
        {[
          { key:'active_count', label:'Active Reminders', color:'#10b981', bg:'#ecfdf5', border:'#10b981', icon:'⏰' },
          { key:'paused_count', label:'Paused Reminders', color:'#d97706', bg:'#fffbeb', border:'#f59e0b', icon:'⏸' },
          { key:'overdue_count', label:'Overdue Reminders', color:'#dc2626', bg:'#fef2f2', border:'#ef4444', icon:'⚠️' },
          { key:'completed_today', label:'Completed Today', color:'#4f46e5', bg:'#eef2ff', border:'#6366f1', icon:'✅' },
        ].map(c => (
          <div key={c.key} style={{ background:c.bg, borderRadius:14, padding:'14px 18px', border:`1.5px solid ${c.border}20`, boxShadow:'0 2px 8px rgba(0,0,0,.04)', display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px' }}>{c.icon} {c.label}</div>
            <div style={{ fontSize:'1.8rem', fontWeight:800, fontFamily:'Outfit,sans-serif', lineHeight:1.2, color:c.color }}>{dashboard[c.key] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center', marginBottom:18 }}>
        <input
          placeholder="Search candidate, email, role..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:180, padding:'9px 14px', border:'1.5px solid var(--border)', borderRadius:10, fontSize:'.88rem', outline:'none', background:'#f8fafc', color:'var(--text-main)', fontFamily:'Inter,sans-serif' }}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:10, fontSize:'.85rem', outline:'none', background:'#f8fafc', color:'var(--text-main)', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="OVERDUE">Overdue</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:10, fontSize:'.85rem', outline:'none', background:'#f8fafc', color:'var(--text-main)', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
          <option value="">All Types</option>
          {COMMUNICATION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button className="btn-premium" onClick={() => { fetchReminders(); fetchDashboard(); }}
          style={{ padding:'9px 18px', fontSize:'.85rem', whiteSpace:'nowrap' }}>🔄 Refresh</button>
      </div>

      {/* Table */}
      <div style={{ overflow: 'hidden', borderRadius: 16, border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:56 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', border:'3px solid #e2e8f0', borderTopColor:'var(--primary)', animation:'spin .7s linear infinite' }} />
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:10, opacity:.6 }}>📬</div>
            <div style={{ fontWeight:600, fontSize:'1rem', marginBottom:4, color:'#64748b' }}>No reminders found</div>
            <div style={{ fontSize:'.85rem' }}>Select <strong>"Remind Me Later"</strong> from Candidate Pool to create reminders.</div>
          </div>
        ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.85rem', minWidth:900, tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:'4%' }} />
              <col style={{ width:'12%' }} /><col style={{ width:'15%' }} /><col style={{ width:'9%' }} />
              <col style={{ width:'13%' }} /><col style={{ width:'7%' }} /><col style={{ width:'10%' }} />
              <col style={{ width:'9%' }} /><col style={{ width:'auto', minWidth:130 }} />
            </colgroup>
            <thead>
              <tr style={{ background:'linear-gradient(135deg,#1e293b,#334155)' }}>
                {['#','Candidate','Email','Role','Comm. Type','Delay','Due At','Status','Actions'].map(h => (
                  <th key={h} style={{ padding:'12px 14px', color:'#e2e8f0', fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r, i) => (
                <tr key={r.id} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#fafbfc', transition:'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5ff'}
                  onMouseLeave={e => e.currentTarget.style.background = i%2===0?'#fff':'#fafbfc'}>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle', color:'#94a3b8', fontSize:'.8rem' }}>{(page - 1) * pageSize + i + 1}</td>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,var(--primary),var(--accent))', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.7rem', fontWeight:700, flexShrink:0 }}>
                        {(r.candidate_name||'?')[0].toUpperCase()}
                      </div>
                      <div style={{ fontWeight:600, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.candidate_name}>{r.candidate_name || '—'}</div>
                    </div>
                  </td>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle', color:'#4338ca', fontSize:'.82rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.candidate_email}>{r.candidate_email || '—'}</td>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle', fontSize:'.82rem', color:'#475569' }}>{r.job_role || '—'}</td>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle' }}>
                    <span style={{ background:'#ede9fe', color:'#5b21b6', padding:'2px 10px', borderRadius:50, fontWeight:600, fontSize:'.72rem', display:'inline-block', whiteSpace:'nowrap', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis' }} title={r.communication_type}>{r.communication_type || '—'}</span>
                  </td>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle', fontSize:'.82rem', color:'#64748b' }}>{formatDelay(r.custom_delay || r.default_delay)}</td>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle', fontSize:'.78rem', color:'#64748b', whiteSpace:'nowrap' }}>{formatDT(r.reminder_time)}</td>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle' }}>{statusBadge(r.status)}</td>
                  <td style={{ padding:'10px 14px', verticalAlign:'middle' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      {[
                        { icon:'👁', title:'View', onClick:() => setViewing(r) },
                        { icon:'✏️', title:'Edit', onClick:() => openEdit(r) },
                        ...(r.status === 'ACTIVE' ? [{ icon:'⏸️', title:'Pause', onClick:() => updateStatus(r,'PAUSED',`Pause reminder for ${r.candidate_name}?`) }] : []),
                        ...(r.status === 'PAUSED' ? [{ icon:'▶️', title:'Resume', onClick:() => updateStatus(r,'ACTIVE',`Resume reminder for ${r.candidate_name}?`) }] : []),
                        ...(!['COMPLETED','CANCELLED'].includes(r.status) ? [{ icon:'🗑️', title:'Delete', onClick:() => deleteReminder(r), danger:true }] : []),
                      ].map((btn, bi) => (
                        <button key={bi} onClick={btn.onClick} title={btn.title}
                          style={{ width:30, height:30, borderRadius:8, border:'1.5px solid #e2e8f0', background:'#fff', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'.8rem', transition:'all .15s', color:btn.danger?'#ef4444':'#64748b' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = btn.danger?'#ef4444':'var(--primary)'; e.currentTarget.style.background = btn.danger?'#fef2f2':'#eef2ff'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}>
                          {btn.icon}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && reminders.length > 0 && (
          <Pagination page={page} totalItems={reminders.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="reminders" />
        )}
      </div>

      {/* ── Edit Reminder Modal ── */}
      {editing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, animation:'fadeIn .2s ease' }} onClick={() => setEditing(null)}>
          <div style={{ background:'#fff', borderRadius:16, width:'92%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.15)', maxHeight:'90vh', overflowY:'auto', animation:'modalSlide .25s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ borderBottom:'1.5px solid #f1f5f9', padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0, fontFamily:"'Outfit',sans-serif", fontSize:'1.05rem', color:'#1e293b' }}>Edit Reminder</h3>
              <button onClick={() => setEditing(null)} style={{ width:30, height:30, borderRadius:8, border:'none', background:'#f1f5f9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#64748b' }}>✕</button>
            </div>
            <div style={{ padding:'20px 22px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <FormField label="Candidate">
                  <div style={{ fontWeight:600, fontSize:'.9rem', padding:'8px 0', color:'#1e293b' }}>{editing.candidate_name}</div>
                </FormField>
                <FormField label="Communication Type">
                  <select className="settings-input" value={editing.communication_type} onChange={e => setEditing({...editing, communication_type:e.target.value})}>
                    {COMMUNICATION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Current Delay">
                  <div style={{ fontSize:'.88rem', color:'#64748b', padding:'8px 0' }}>{formatDelay(editing.custom_delay || editing.default_delay)}</div>
                </FormField>
                <FormField label="Email">
                  <div style={{ fontSize:'.82rem', color:'#4338ca', padding:'8px 0' }}>{editing.candidate_email}</div>
                </FormField>
                <FormField label="New Reminder Delay" fullWidth>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <select className="settings-input" value={delayIsCustom ? 'custom' : editDelay} onChange={e => { if (e.target.value === 'custom') setDelayIsCustom(true); else { setDelayIsCustom(false); setEditDelay(parseInt(e.target.value)); } }}>
                      {DELAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      <option value="custom">Custom Time</option>
                    </select>
                    {delayIsCustom && (
                      <input className="settings-input" type="number" min="1" placeholder="Minutes" value={customDelayMins} onChange={e => setCustomDelayMins(e.target.value)} style={{ width:110 }} />
                    )}
                  </div>
                </FormField>
              </div>
            </div>
            <div style={{ borderTop:'1.5px solid #f1f5f9', padding:'14px 22px', display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn-premium-outline" onClick={() => setEditing(null)} style={{ padding:'8px 18px', fontSize:'.88rem' }}>Cancel</button>
              <button className="btn-premium" onClick={saveEdit} disabled={saving} style={{ padding:'8px 18px', fontSize:'.88rem' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Reminder Modal ── */}
      {viewing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, animation:'fadeIn .2s ease' }} onClick={() => setViewing(null)}>
          <div style={{ background:'#fff', borderRadius:16, width:'92%', maxWidth:500, boxShadow:'0 20px 60px rgba(0,0,0,.15)', maxHeight:'90vh', overflowY:'auto', animation:'modalSlide .25s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ background:'linear-gradient(135deg,#4338ca,#7c3aed)', color:'#fff', padding:'16px 22px 14px', borderTopLeftRadius:16, borderTopRightRadius:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0, fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:'1rem' }}>Reminder Details</h3>
              <button onClick={() => setViewing(null)} style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.2)', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>✕</button>
            </div>
            <div style={{ padding:'18px 22px' }}>
              {[
                ['Candidate', viewing.candidate_name],
                ['Email', viewing.candidate_email],
                ['Job Role', viewing.job_role],
                ['Communication Type', viewing.communication_type],
                ['Delay', formatDelay(viewing.custom_delay || viewing.default_delay)],
                ['Status', ''],
                ['Created', formatDT(viewing.created_at)],
                ['Due At', formatDT(viewing.reminder_time)],
                ['Updated', formatDT(viewing.updated_at)],
              ].filter(([,v]) => v).map(([l,v]) => (
                <div key={l} style={{ display:'flex', padding:'8px 0', borderBottom:'1px solid #f8fafc' }}>
                  <div style={{ width:130, fontSize:'.73rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.4px', flexShrink:0 }}>{l}</div>
                  <div style={{ flex:1, fontSize:'.86rem', color:'#1e293b' }}>{l === 'Status' ? statusBadge(viewing.status) : (v || '—')}</div>
                </div>
              ))}
              {viewing.email_sent && (
                <div style={{ display:'flex', padding:'8px 0' }}>
                  <div style={{ width:130, fontSize:'.73rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.4px', flexShrink:0 }}>Email Sent</div>
                  <div style={{ flex:1, fontSize:'.86rem', color:'#10b981', fontWeight:600 }}>Yes</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
