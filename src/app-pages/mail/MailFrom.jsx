import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

// One line that tells the person which address a request mail will go out from:
// their own connected email (My Mail), or the company mail account when they have not connected one.
export default function MailFrom({ onInfo, onPick }) {
  const [info, setInfo] = useState(null);
  const [picked, setPicked] = useState('');
  useEffect(() => {
    fetch('/api/mail/account', { headers: auth() }).then(r => r.json()).then(d => {
      setInfo(d);
      const def = (d.accounts || []).find(a => a.is_default) || (d.accounts || [])[0];
      setPicked(def ? def.id : '');
      if (onInfo) onInfo(!!def);
      if (onPick) onPick(def ? def.id : '');
    }).catch(() => {});
  }, []);
  if (!info) return null;
  const accounts = info.accounts || [];
  const own = info.account && info.account.sender_email;
  // several connected emails: the person chooses which one this mail goes out from
  if (accounts.length > 1) {
    return (
      <div style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 12px', padding: '8px 11px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>Send this mail from:</span>
        <select value={picked} onChange={e => { setPicked(e.target.value); if (onPick) onPick(e.target.value); }} style={{ padding: '5px 8px', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 13, background: '#fff', color: '#0f172a', fontWeight: 600 }}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.sender_email}{a.is_default ? ' (default)' : ''}</option>)}
        </select>
      </div>
    );
  }
  if (!own && sessionStorage.getItem('role') === 'USER') {
    return (
      <div style={{ fontSize: 12.5, color: '#92400e', margin: '0 0 12px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
        <b>No email will be sent.</b> Your own email is not connected, and mails are never sent from the company (HR) address in your name. Your request is still submitted and your manager sees it in the app. To send this mail from your own address, connect your email in <b>My Mail</b> first.
      </div>
    );
  }
  return (
    <div style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 12px', padding: '7px 11px', background: own ? '#f0fdf4' : '#f8fafc', border: '1px solid ' + (own ? '#bbf7d0' : '#e2e8f0'), borderRadius: 8 }}>
      This mail goes out from: <b style={{ color: '#0f172a' }}>{own || info.company_sender || 'the company mail account'}</b>
      {own ? ' (your connected email)' : ' (company mail). Replies are sent to your own email.'}
      {!own && <> To send from your own address, connect it in <b>My Mail</b>.</>}
    </div>
  );
}
