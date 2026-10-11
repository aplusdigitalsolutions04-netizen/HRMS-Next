import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const when = (v) => { if (!v) return 'Never'; try { return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return v; } };

// One-click backup (administrator only). The .sql file restores everything; the Excel file is for reading.
export default function Backup() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showTables, setShowTables] = useState(false);

  const load = () => {
    fetch(`${API}/backup/status`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(setInfo).catch(e => setError(e.message));
  };
  useEffect(() => { load(); }, []);

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
  const card = { background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 };

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

      <div style={{ ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '.74rem', color: '#64748b', fontWeight: 600 }}>LAST DOWNLOAD</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{info ? when(info.last.at) : '...'} <span style={{ fontWeight: 500, color: '#64748b', fontSize: '.82rem' }}>{info && info.last.kind ? '- ' + info.last.kind : ''}</span></div>
          {info && !info.last.at && <div style={{ fontSize: '.78rem', color: '#b45309', marginTop: 2 }}>No backup has been taken from here yet.</div>}
        </div>
        <button className="btn-o" onClick={() => setShowTables(s => !s)}>{showTables ? 'Hide' : 'Show'} what is stored ({info ? info.tables.length : 0} tables, {totalRows.toLocaleString('en-IN')} rows)</button>
      </div>

      {showTables && info && (
        <div style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
            {info.tables.map(t => (
              <div key={t.table} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f4f6fa', fontSize: '.8rem' }}>
                <span style={{ color: '#334155' }}>{t.table}</span><b>{t.rows.toLocaleString('en-IN')}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', fontSize: '.82rem', color: '#78350f' }}>
        <b>To restore:</b> create an empty database and run <code>mysql -u USER -p DATABASE &lt; hrms-backup-....sql</code>. Restoring replaces the tables in that database with the saved data, so test it on a spare database first.
      </div>
    </div>
  );
}
