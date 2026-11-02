import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard } from './shared';

export default function GoogleDriveSettings() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null); // { connected, folderName?, message? }

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/settings/google-drive/test`, { headers: auth() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Test failed');
      setResult(data);
    } catch (e) {
      setResult({ connected: false, message: e.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const [connecting, setConnecting] = useState(false);

  // The redirect to Google's consent screen has to be a real browser
  // navigation, but getting *there* is a normal authenticated POST (with the
  // usual Authorization header) that hands back the one-time Google URL -
  // the session token never appears in a URL/query string.
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${API}/google-drive/authorize`, { method: 'POST', headers: auth() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to start Google authorization');
      window.location.href = data.url;
    } catch (e) {
      setResult({ connected: false, message: e.message || 'Failed to start Google authorization' });
      setConnecting(false);
    }
  };

  // employee folders that were made more than once (an older bug): look at them, then merge into one folder each
  const [dupGroups, setDupGroups] = useState(null);
  const [dupBusy, setDupBusy] = useState(false);
  const checkDuplicates = async () => {
    setDupBusy(true);
    try {
      const res = await fetch(`${API}/settings/google-drive/duplicates`, { headers: auth() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Could not check the folders');
      setDupGroups(d.groups || []);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not checked', text: e.message }); }
    finally { setDupBusy(false); }
  };
  const mergeDuplicates = async (key) => {
    const ok = await Swal.fire({
      icon: 'question', showCancelButton: true, confirmButtonText: 'Merge',
      title: key ? `Merge the folders of ${key}?` : 'Merge all duplicate folders?',
      text: 'The files are moved into one folder per employee. The emptied extra folders go to the Google Drive trash, where they can be restored.',
    });
    if (!ok.isConfirmed) return;
    setDupBusy(true);
    try {
      const res = await fetch(`${API}/settings/google-drive/duplicates`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(key ? { key } : {}) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Could not merge');
      await Swal.fire({ icon: 'success', title: 'Done', text: d.message });
      const again = await fetch(`${API}/settings/google-drive/duplicates`, { headers: auth() }).then(r => r.json()).catch(() => ({}));
      setDupGroups(again.groups || []);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not merged', text: e.message }); }
    finally { setDupBusy(false); }
  };

  return (
    <SettingsCard title="Google Drive" desc="Employee documents are stored in Google Drive when configured. Test the connection here anytime to confirm it's still working.">
      <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: '.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.02em' }}>Connection Status</h4>
            <p style={{ margin: 0, fontSize: '.85rem', color: '#64748b', maxWidth: 480 }}>
              Checks that the configured Google account/service account is reachable and the configured Drive folder still exists.
            </p>
          </div>
          <button className="btn-premium" onClick={handleTest} disabled={testing} style={{ flexShrink: 0 }}>
            {testing ? <><span className="spinner-sm" /> Testing...</> : '🔌 Test Connection'}
          </button>
        </div>

        {result && (
          <div style={{
            marginTop: 20, borderRadius: 14, padding: 16,
            background: result.connected ? '#ecfdf5' : '#fef2f2',
            border: `1.5px solid ${result.connected ? '#a7f3d0' : '#fecaca'}`,
          }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '.88rem', color: result.connected ? '#047857' : '#b91c1c' }}>
              {result.connected ? '✅ Connected' : '❌ Not connected'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '.85rem', color: result.connected ? '#059669' : '#dc2626' }}>
              {result.connected
                ? `Uploads are saving to the "${result.folderName}" Drive folder.`
                : (result.message || 'Could not reach Google Drive.')}
            </p>
            {!result.connected && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="btn-premium"
                style={{ marginTop: 12, background: '#dc2626' }}
              >
                {connecting ? 'Redirecting...' : '🔐 Connect Google Account'}
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 24, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: '.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.02em' }}>Duplicate Folders</h4>
            <p style={{ margin: 0, fontSize: '.85rem', color: '#64748b', maxWidth: 520 }}>
              Finds employees who have more than one folder in Drive and puts their files together in one folder. Nothing is deleted: emptied folders go to the Drive trash.
            </p>
          </div>
          <button className="btn-premium" onClick={checkDuplicates} disabled={dupBusy} style={{ flexShrink: 0 }}>
            {dupBusy ? <><span className="spinner-sm" /> Working...</> : '🗂 Check Folders'}
          </button>
        </div>
        {dupGroups && (
          dupGroups.length === 0
            ? <p style={{ margin: '16px 0 0', fontSize: '.88rem', fontWeight: 600, color: '#047857' }}>✅ No employee has more than one folder.</p>
            : (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: '.85rem', color: '#b45309', fontWeight: 600 }}>{dupGroups.length} employee{dupGroups.length === 1 ? '' : 's'} with more than one folder</span>
                  <button className="btn-premium" onClick={() => mergeDuplicates('')} disabled={dupBusy}>Merge all</button>
                </div>
                {dupGroups.map(g => (
                  <div key={g.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #e2e8f0', fontSize: '.84rem' }}>
                    <span><b>{g.key}</b> &middot; {g.folders.length} folders &middot; files in each: {g.folders.map(f => f.files).join(', ')}</span>
                    <button className="btn-premium" style={{ padding: '4px 12px', fontSize: '.75rem' }} onClick={() => mergeDuplicates(g.key)} disabled={dupBusy}>Merge</button>
                  </div>
                ))}
              </div>
            )
        )}
      </div>
    </SettingsCard>
  );
}
