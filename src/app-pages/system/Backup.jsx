import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { appLocale } from '@/lib/app-config-client';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const when = (v) => { if (!v) return 'Never'; try { return new Date(v).toLocaleString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return v; } };

// One-click backup (administrator only). The .sql file restores everything; the Excel file is for reading.
export default function Backup() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showTables, setShowTables] = useState(false);
  const [sched, setSched] = useState(null);
  const [files, setFiles] = useState([]);
  const [testing, setTesting] = useState('');
  const [report, setReport] = useState(null);
  const JH = { ...auth(), 'Content-Type': 'application/json' };

  const load = () => {
    fetch(`${API}/backup/status`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(setInfo).catch(e => setError(e.message));
  };
  const loadAuto = () => {
    fetch(`${API}/backup/schedule`, { headers: auth() }).then(r => r.json()).then(d => { if (d && d.frequency) setSched(d); }).catch(() => { });
    fetch(`${API}/backup/files`, { headers: auth() }).then(r => r.json()).then(d => setFiles(d.files || [])).catch(() => { });
  };
  useEffect(() => { load(); loadAuto(); }, []);

  const saveSched = async (patch) => {
    const next = { ...sched, ...patch }; setSched(next);
    const r = await fetch(`${API}/backup/schedule`, { method: 'PUT', headers: JH, body: JSON.stringify(patch) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { Swal.fire({ icon: 'error', title: d.detail || 'Could not save' }); loadAuto(); return; }
    setSched(d);
  };
  const act = async (body, busyKey) => {
    setTesting(busyKey);
    try {
      const r = await fetch(`${API}/backup/files`, { method: 'POST', headers: JH, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Failed');
      return d;
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); return null; }
    finally { setTesting(''); }
  };
  const runNow = async () => { const d = await act({ action: 'run' }, 'run'); if (d) { Swal.fire({ icon: 'success', title: 'Backup saved', text: d.name, timer: 1800, showConfirmButton: false }); loadAuto(); load(); } };
  const testFile = async (name) => { setReport(null); const d = await act({ action: 'verify', name }, 'test:' + name); if (d) setReport(d); };
  const removeFile = async (name) => {
    const x = await Swal.fire({ icon: 'warning', title: 'Delete this backup?', text: name, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
    if (!x.isConfirmed) return;
    if (await act({ action: 'delete', name }, 'del:' + name)) { if (report && report.name === name) setReport(null); loadAuto(); }
  };
  const downloadFile = async (name) => {
    const res = await fetch(`${API}/backup/files?download=${encodeURIComponent(name)}`, { headers: auth() });
    if (!res.ok) { Swal.fire({ icon: 'error', title: 'Download failed' }); return; }
    const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  const size = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const download = async (kind, ext) => {
    setBusy(kind);
    try {
      const res = await fetch(`${API}/backup/${kind}`, { headers: auth() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Download failed'); }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = m ? m[1] : `hrms-backup.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      Swal.fire({ icon: 'success', title: 'Downloaded', text: 'Keep this file somewhere safe.', timer: 1800, showConfirmButton: false });
      load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setBusy(''); }
  };

  const totalRows = info ? info.tables.reduce((t, x) => t + x.rows, 0) : 0;
  const card = { background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 };

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Backup &amp; Export</h1>
          <p>Download a copy of your data in one click. Only the administrator can do this.</p>
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Full backup (.sql)</h3>
          <p style={{ margin: 0, fontSize: '.84rem', color: '#64748b' }}>Every table, ready to restore on this or another server. This is the file to keep for safety.</p>
          <ul style={{ margin: '4px 0 8px 18px', padding: 0, fontSize: '.8rem', color: '#64748b' }}>
            <li>Includes employees, attendance, leave, payroll, settings and the audit log.</li>
            <li>Contains password hashes - store it securely, do not email it.</li>
            <li>Uploaded documents live in Google Drive / the uploads folder and are not inside this file.</li>
          </ul>
          <button className="btn-p" style={{ alignSelf: 'flex-start' }} disabled={!!busy} onClick={() => download('sql', 'sql')}>{busy === 'sql' ? 'Preparing...' : 'Download full backup'}</button>
        </div>
        <div style={card}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Export data (Excel)</h3>
          <p style={{ margin: 0, fontSize: '.84rem', color: '#64748b' }}>Your day-to-day data in one workbook, one sheet per area (employees, attendance, leave, payslips, assets...). For reading and reporting.</p>
          <ul style={{ margin: '4px 0 8px 18px', padding: 0, fontSize: '.8rem', color: '#64748b' }}>
            <li>Passwords and profile photos are left out.</li>
            <li>Cannot be used to restore the system - use the .sql file for that.</li>
          </ul>
          <button className="btn-o" style={{ alignSelf: 'flex-start' }} disabled={!!busy} onClick={() => download('excel', 'xlsx')}>{busy === 'excel' ? 'Preparing...' : 'Download Excel'}</button>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', marginRight: 'auto' }}>Automatic backups</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem', fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!(sched && sched.on)} disabled={!sched} onChange={e => saveSched({ on: e.target.checked })} /> {sched && sched.on ? 'On' : 'Off'}
          </label>
          <button className="btn-p" disabled={!!testing} onClick={runNow}>{testing === 'run' ? 'Saving...' : 'Back up now'}</button>
        </div>
        <p style={{ margin: 0, fontSize: '.82rem', color: '#64748b' }}>A full compressed backup is saved on the server by itself, and the oldest automatic ones are removed. Download a copy now and then and keep it somewhere other than this server.</p>
        {sched && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', opacity: sched.on ? 1 : .55 }}>
            <label style={{ fontSize: '.74rem', fontWeight: 600, color: '#64748b' }}>How often<br />
              <select className="settings-input" style={{ height: 34 }} value={sched.frequency} onChange={e => saveSched({ frequency: e.target.value })}><option value="daily">Every day</option><option value="weekly">Every week</option></select></label>
            {sched.frequency === 'weekly' && <label style={{ fontSize: '.74rem', fontWeight: 600, color: '#64748b' }}>On<br />
              <select className="settings-input" style={{ height: 34 }} value={sched.weekday} onChange={e => saveSched({ weekday: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>}
            <label style={{ fontSize: '.74rem', fontWeight: 600, color: '#64748b' }}>At (server time)<br />
              <select className="settings-input" style={{ height: 34 }} value={sched.hour} onChange={e => saveSched({ hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
            <label style={{ fontSize: '.74rem', fontWeight: 600, color: '#64748b' }}>Keep the last<br />
              <input type="number" min="1" max="60" className="settings-input" style={{ height: 34, width: 80 }} defaultValue={sched.keep} key={sched.keep} onBlur={e => { const v = Number(e.target.value); if (v >= 1 && v <= 60 && v !== sched.keep) saveSched({ keep: v }); }} /></label>
          </div>
        )}
        {sched && sched.last_status && <div style={{ fontSize: '.78rem', color: sched.last_status.startsWith('FAILED') ? '#b91c1c' : '#15803d' }}>Last automatic run: {when(sched.last_at)} - {sched.last_status}</div>}

        <div style={{ overflowX: 'auto', marginTop: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
            <thead><tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}><th style={{ padding: '6px 8px' }}>File</th><th style={{ padding: '6px 8px' }}>Saved</th><th style={{ padding: '6px 8px' }}>Size</th><th /></tr></thead>
            <tbody>
              {files.length === 0 && <tr><td colSpan={4} style={{ padding: 14, textAlign: 'center', color: '#94a3b8' }}>No backup saved on the server yet.</td></tr>}
              {files.map(f => (
                <tr key={f.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 8px' }}>{f.name} <span style={{ fontSize: 11, color: '#94a3b8' }}>{f.kind === 'auto' ? 'automatic' : 'manual'}</span></td>
                  <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{when(f.created)}</td>
                  <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{size(f.size)}</td>
                  <td style={{ padding: '7px 8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn-o" style={{ height: 28, padding: '0 10px', fontSize: 12 }} disabled={!!testing} onClick={() => testFile(f.name)}>{testing === 'test:' + f.name ? 'Testing...' : 'Test restore'}</button>{' '}
                    <button className="btn-o" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => downloadFile(f.name)}>Download</button>{' '}
                    <button onClick={() => removeFile(f.name)} style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 6, height: 28, padding: '0 10px', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {report && (
          <div style={{ border: '1px solid ' + (report.ok ? '#bbf7d0' : '#fecaca'), background: report.ok ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: '10px 14px', fontSize: '.82rem', color: '#334155' }}>
            <div style={{ fontWeight: 700, color: report.ok ? '#15803d' : '#b91c1c', marginBottom: 4 }}>{report.ok ? 'This backup can be restored' : 'This backup has a problem'} <span style={{ fontWeight: 500, color: '#64748b' }}>{report.name}</span></div>
            <div>File check: {report.complete ? 'complete' : 'incomplete'}, {report.tables} tables, {report.rows.toLocaleString(appLocale())} rows.</div>
            <div>Restore test: {report.deep.note}</div>
            {report.notes.map((n, i) => <div key={i} style={{ color: '#b45309' }}>{n}</div>)}
            <details style={{ marginTop: 4 }}><summary style={{ cursor: 'pointer', color: '#64748b' }}>Rows in the backup against the live tables</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2px 18px', marginTop: 4 }}>
                {report.compare.map(c => <div key={c.table} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{c.table}</span><span><b>{c.backup}</b> / {c.now}</span></div>)}
              </div>
              <div style={{ color: '#94a3b8', marginTop: 4 }}>Tables that changed after the backup was taken will show different numbers.</div>
            </details>
          </div>
        )}
      </div>

      <div style={{ ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '.74rem', color: '#64748b', fontWeight: 600 }}>LAST DOWNLOAD</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{info ? when(info.last.at) : '...'} <span style={{ fontWeight: 500, color: '#64748b', fontSize: '.82rem' }}>{info && info.last.kind ? '- ' + info.last.kind : ''}</span></div>
          {info && !info.last.at && <div style={{ fontSize: '.78rem', color: '#b45309', marginTop: 2 }}>No backup has been taken from here yet.</div>}
        </div>
        <button className="btn-o" onClick={() => setShowTables(s => !s)}>{showTables ? 'Hide' : 'Show'} what is stored ({info ? info.tables.length : 0} tables, {totalRows.toLocaleString(appLocale())} rows)</button>
      </div>

      {showTables && info && (
        <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
            {info.tables.map(t => (
              <div key={t.table} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f4f6fa', fontSize: '.8rem' }}>
                <span style={{ color: '#334155' }}>{t.table}</span><b>{t.rows.toLocaleString(appLocale())}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', fontSize: '.82rem', color: '#78350f' }}>
        <b>To restore:</b> create an empty database and run <code>mysql -u USER -p DATABASE &lt; hrms-backup-....sql</code> (for a saved .sql.gz file: <code>gunzip -c FILE.sql.gz | mysql -u USER -p DATABASE</code>). Restoring replaces the tables in that database with the saved data, so test it on a spare database first.
      </div>
    </div>
  );
}
