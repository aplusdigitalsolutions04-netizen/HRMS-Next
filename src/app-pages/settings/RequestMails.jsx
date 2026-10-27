import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';
import { API, auth, SettingsCard, SaveButton } from './shared';

// Pick which Email Template (made in Settings > Email Templates) is used for each request mail.
// A step left on "Built-in mail" sends a plain default mail. The employee's reason is in every mail.
export default function RequestMails({ saving, setSaving }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [map, setMap] = useState({});

  useEffect(() => {
    fetch(`${API}/settings/request-mails`, { headers: auth() })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.kinds) throw new Error(d.detail || (r.status === 401 ? 'Your session has ended. Please log in again.' : 'Could not load this page (error ' + r.status + ').')); return d; })
      .then(d => { setData(d); setMap(d.map || {}); })
      .catch(e => setLoadErr(e.message || 'Could not load this page.'));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/request-mails`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ map }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1300, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setSaving(false); }
  };

  if (loadErr) return <div style={{ padding: 20, color: '#b91c1c', background: '#fef2f2', borderRadius: 10, fontSize: 14 }}><b>Could not load Request Mails.</b><div style={{ marginTop: 6 }}>{loadErr}</div></div>;
  if (!data) return <div className="p-4 text-center">Loading...</div>;
  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e8edf6' };
  const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13, verticalAlign: 'middle' };

  return (
    <SettingsCard title="Request Mails" desc="Leave, Work From Home, Missed punch and Late coming. The employee sends the request, the reporting manager approves first, then HR, then the employee gets the final mail.">
      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr><th style={th}>Request</th><th style={th}>Mail</th><th style={th}>Email Template</th></tr></thead>
          <tbody>
            {Object.entries(data.kinds).flatMap(([kind, kindLabel]) => Object.entries(data.events).map(([ev, evLabel], i) => (
              <tr key={kind + ev}>
                <td style={{ ...td, fontWeight: 700, color: '#0f172a' }}>{i === 0 ? kindLabel : ''}</td>
                <td style={td}>{evLabel}</td>
                <td style={td}>
                  <select className="settings-input" style={{ minWidth: 200 }} value={map[`${kind}.${ev}`] || ''} onChange={e => setMap(m => ({ ...m, [`${kind}.${ev}`]: e.target.value }))}>
                    <option value="">Built-in mail</option>
                    {(data.byKind[kind] || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {(data.byKind[kind] || []).length === 0 && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>No template yet in the "{data.categoryOf[kind] || kindLabel}" category.</div>}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e8edf6', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Words you can use in a template</div>
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#64748b' }}>Write them in the subject or the body, for example <code>{'{employee_name}'}</code>. They are replaced when the mail is sent.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '4px 16px', fontSize: 12.5 }}>
          {data.variables.map(([k, d]) => <div key={k}><code style={{ color: '#1d4ed8' }}>{`{${k}}`}</code> <span style={{ color: '#64748b' }}>{d}</span></div>)}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#64748b' }}>Each request lists only the templates whose category is meant for it (for example the Leave category for leave). Create the template in Settings &gt; Email Templates and pick that category. Categories are managed in <Link to="/masters/template-categories" style={{ color: '#2563eb', fontWeight: 600 }}>Masters &gt; Template Categories</Link>.</p>
      </div>

      <div className="settings-actions"><SaveButton onClick={save} saving={saving} /></div>
    </SettingsCard>
  );
}
