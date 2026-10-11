import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import Pagination from '../shared/Pagination';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const PRESETS = [
  { key: 'gmail', label: 'Gmail', smtp_host: 'smtp.gmail.com', smtp_port: 587, encryption: 'TLS', imap_host: 'imap.gmail.com', imap_port: 993, hint: 'Gmail needs an app password: Google Account → Security → 2-Step Verification → App passwords.' },
  { key: 'outlook', label: 'Outlook / Office 365', smtp_host: 'smtp.office365.com', smtp_port: 587, encryption: 'TLS', imap_host: 'outlook.office365.com', imap_port: 993, hint: 'If sign-in fails, your admin may need to allow SMTP/IMAP, or you need an app password.' },
  { key: 'yahoo', label: 'Yahoo', smtp_host: 'smtp.mail.yahoo.com', smtp_port: 465, encryption: 'SSL', imap_host: 'imap.mail.yahoo.com', imap_port: 993, hint: 'Yahoo needs an app password from Account Security.' },
  { key: 'hostinger', label: 'Hostinger', smtp_host: 'smtp.hostinger.com', smtp_port: 465, encryption: 'SSL', imap_host: 'imap.hostinger.com', imap_port: 993, hint: 'Use your full email address and its mailbox password.' },
  { key: 'other', label: 'Other / Webmail', smtp_host: '', smtp_port: 465, encryption: 'SSL', imap_host: '', imap_port: 993, hint: 'For company webmail the servers are usually mail.yourdomain.com. Ask your IT team if unsure.' },
];

const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d); if (isNaN(x.getTime())) return '';
  const t = new Date();
  return x.toDateString() === t.toDateString() ? x.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: x.getFullYear() === t.getFullYear() ? undefined : 'numeric' });
};
const who = (p) => (p && (p.name || p.address)) || '';
const sizeText = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

const inp = { width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
const lab = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' };
const card = { background: '#fff', border: '1px solid #e8edf6', borderRadius: 12 };

/* ───────── connect your email ───────── */
function Setup({ account, onDone, onCancel }) {
  const start = account ? PRESETS.find(p => p.smtp_host === account.smtp_host) || PRESETS[4] : PRESETS[0];
  const [preset, setPreset] = useState(start.key);
  const [f, setF] = useState(account ? { ...account, app_password: '' } : { sender_name: '', sender_email: '', app_password: '', smtp_host: start.smtp_host, smtp_port: start.smtp_port, encryption: start.encryption, imap_host: start.imap_host, imap_port: start.imap_port });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hint = (PRESETS.find(p => p.key === preset) || {}).hint;

  const pick = (p) => {
    setPreset(p.key);
    setF(prev => {
      const dom = (prev.sender_email.split('@')[1] || '').trim();
      const guess = p.key === 'other' && dom ? { smtp_host: 'mail.' + dom, imap_host: 'mail.' + dom } : { smtp_host: p.smtp_host, imap_host: p.imap_host };
      return { ...prev, ...guess, smtp_port: p.smtp_port, encryption: p.encryption, imap_port: p.imap_port };
    });
  };
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const res = await fetch(`${API}/mail/account`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not connect');
      await Swal.fire({ icon: 'success', title: 'Email connected', timer: 1400, showConfirmButton: false });
      onDone();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ ...card, padding: 20, width: '100%', boxSizing: 'border-box' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{account ? 'Email account' : 'Connect your email'}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>Mail you send from here goes out from your own address, and your Inbox and Sent box show up on this page. We check the details with your mail server before saving.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {PRESETS.map(p => (
          <button key={p.key} type="button" onClick={() => pick(p)} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid ' + (preset === p.key ? '#2563eb' : '#e2e8f0'), background: preset === p.key ? '#2563eb' : '#fff', color: preset === p.key ? '#fff' : '#475569', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{p.label}</button>
        ))}
      </div>
      {hint && <div style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '7px 11px', fontSize: 12.5, marginBottom: 12 }}>{hint}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <div><label style={lab}>Your name (shown to people)</label><input style={inp} value={f.sender_name} onChange={set('sender_name')} placeholder="e.g. Rahul Sharma" /></div>
        <div><label style={lab}>Email address *</label><input style={inp} type="email" required value={f.sender_email} onChange={set('sender_email')} placeholder="you@company.com" /></div>
        <div><label style={lab}>Password {account ? '(leave empty to keep)' : '*'}</label><input style={inp} type="password" required={!account} autoComplete="new-password" value={f.app_password} onChange={set('app_password')} placeholder={account ? '••••••••' : 'Mailbox or app password'} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
        <div style={{ ...card, padding: 12, background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Sending (SMTP)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
            <div><label style={lab}>Server</label><input style={inp} required value={f.smtp_host} onChange={set('smtp_host')} placeholder="smtp.example.com" /></div>
            <div><label style={lab}>Port</label><input style={inp} type="number" required value={f.smtp_port} onChange={set('smtp_port')} /></div>
          </div>
          <label style={lab}>Security</label>
          <select style={inp} value={f.encryption} onChange={set('encryption')}><option value="SSL">SSL (port 465)</option><option value="TLS">TLS / STARTTLS (port 587)</option></select>
        </div>
        <div style={{ ...card, padding: 12, background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Receiving (IMAP)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
            <div><label style={lab}>Server</label><input style={inp} required value={f.imap_host} onChange={set('imap_host')} placeholder="imap.example.com" /></div>
            <div><label style={lab}>Port</label><input style={inp} type="number" required value={f.imap_port} onChange={set('imap_port')} /></div>
          </div>
        </div>
      </div>

      {err && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        {onCancel && <button type="button" className="btn-o" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn-p" disabled={busy}>{busy ? 'Checking with your mail server...' : account ? 'Check & save' : 'Connect'}</button>
      </div>
    </form>
  );
}

/* ───────── the connected emails ───────── */
function Accounts({ accounts, onAdd, onEdit, onDefault, onRemove, onBack }) {
  return (
    <div style={{ ...card, padding: 18, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Your connected emails</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>When you send a leave or WFH request, or compose a mail, you pick which one to send from. The default one is chosen first.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-o" onClick={onBack}>&larr; Back</button>
          {accounts.length < 5 && <button className="btn-p" onClick={onAdd}>+ Add another email</button>}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {accounts.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 14px', border: '1px solid ' + (a.is_default ? '#bbf7d0' : '#e2e8f0'), background: a.is_default ? '#f0fdf4' : '#fff', borderRadius: 10 }}>
            <div style={{ minWidth: 0 }}>
              <b style={{ color: '#0f172a', fontSize: 14 }}>{a.sender_email}</b>
              {a.is_default && <span style={{ marginLeft: 8, fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>Default</span>}
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.sender_name || 'No name set'} &middot; {a.smtp_host}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!a.is_default && <button className="btn-o" style={{ height: 30, padding: '0 11px', fontSize: 12.5 }} onClick={() => onDefault(a)}>Make default</button>}
              <button className="btn-o" style={{ height: 30, padding: '0 11px', fontSize: 12.5 }} onClick={() => onEdit(a)}>Edit</button>
              <button className="btn-o" style={{ height: 30, padding: '0 11px', fontSize: 12.5, color: '#b91c1c' }} onClick={() => onRemove(a)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── write a mail ───────── */
function Compose({ account, accounts, initial, onClose, onSent }) {
  const [fromId, setFromId] = useState(account.id);
  const from = accounts.find(a => a.id === fromId) || account;
  const [f, setF] = useState({ to: '', cc: '', bcc: '', subject: '', body: '', in_reply_to: '', references: '', ...initial });
  const [files, setFiles] = useState([]);
  const [more, setMore] = useState(!!(initial && (initial.cc || initial.bcc)));
  const [sending, setSending] = useState(false);
  const fileRef = useRef();
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const send = async (e) => {
    e.preventDefault(); setSending(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v || ''));
      fd.append('account_id', fromId);
      files.forEach(x => fd.append('files', x));
      const res = await fetch(`${API}/mail/send`, { method: 'POST', headers: auth(), body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not send');
      await Swal.fire({ icon: 'success', title: 'Mail sent', timer: 1300, showConfirmButton: false });
      onSent();
    } catch (x) { Swal.fire({ icon: 'error', title: 'Not sent', text: x.message }); } finally { setSending(false); }
  };

  return (
    <form onSubmit={send} style={{ ...card, padding: 18, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>New mail</h3>
        <button type="button" className="btn-o" onClick={onClose}>&larr; Back</button>
      </div>
      <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        From:
        {accounts.length > 1 ? (
          <select value={fromId} onChange={e => setFromId(e.target.value)} style={{ ...inp, width: 'auto', fontWeight: 600 }}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.sender_name ? `${a.sender_name} <${a.sender_email}>` : a.sender_email}{a.is_default ? ' (default)' : ''}</option>)}
          </select>
        ) : <b style={{ color: '#0f172a' }}>{from.sender_name ? `${from.sender_name} <${from.sender_email}>` : from.sender_email}</b>}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div><label style={lab}>To *</label><input style={inp} value={f.to} onChange={set('to')} placeholder="name@example.com, another@example.com" required /></div>
        {more ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            <div><label style={lab}>Cc</label><input style={inp} value={f.cc} onChange={set('cc')} /></div>
            <div><label style={lab}>Bcc</label><input style={inp} value={f.bcc} onChange={set('bcc')} /></div>
          </div>
        ) : <button type="button" onClick={() => setMore(true)} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}>+ Cc / Bcc</button>}
        <div><label style={lab}>Subject</label><input style={inp} value={f.subject} onChange={set('subject')} /></div>
        <div><label style={lab}>Message</label><textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.6, minHeight: 220 }} rows={12} value={f.body} onChange={set('body')} /></div>
        <div>
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => { setFiles(p => [...p, ...Array.from(e.target.files)]); e.target.value = ''; }} />
          <button type="button" className="btn-o" onClick={() => fileRef.current.click()}>Attach files</button>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>Up to 10 MB each</span>
          {files.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{files.map((x, i) => <span key={i} style={{ background: '#f1f5f9', borderRadius: 16, padding: '3px 10px', fontSize: 12 }}>{x.name} <span style={{ color: '#94a3b8' }}>({sizeText(x.size)})</span> <button type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button></span>)}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button type="button" className="btn-o" onClick={onClose}>Discard</button>
        <button type="submit" className="btn-p" disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
      </div>
    </form>
  );
}

/* ───────── read a mail ───────── */
function Reader({ folder, uid, accountId, onBack, onReply, onForward }) {
  const [m, setM] = useState(null);
  const [err, setErr] = useState('');
  const [images, setImages] = useState(false);

  useEffect(() => {
    setM(null); setErr(''); setImages(false);
    fetch(`${API}/mail/message?folder=${folder}&uid=${uid}&account_id=${accountId}`, { headers: auth() })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not open the mail'); return d; })
      .then(setM).catch(e => setErr(e.message));
  }, [folder, uid, accountId]);

  const download = async (a) => {
    try {
      const res = await fetch(`${API}/mail/attachment?folder=${folder}&uid=${uid}&index=${a.index}&account_id=${accountId}`, { headers: auth() });
      if (!res.ok) throw new Error((await res.json()).detail || 'Download failed');
      const url = URL.createObjectURL(await res.blob());
      const el = document.createElement('a'); el.href = url; el.download = a.filename; el.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
  };

  if (err) return <div style={{ ...card, padding: 20 }}><button className="btn-o" onClick={onBack}>&larr; Back</button><div style={{ color: '#b91c1c', marginTop: 12 }}>{err}</div></div>;
  if (!m) return <div style={{ ...card, padding: 30, textAlign: 'center', color: '#94a3b8' }}>Opening...</div>;

  // The body is shown in a locked box: no scripts, no outside pictures unless the person allows them.
  const csp = `default-src 'none'; img-src data: ${images ? 'https: http:' : ''}; style-src 'unsafe-inline'`;
  const base = 'body{font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.55;margin:0;word-wrap:break-word}img{max-width:100%;height:auto}a{color:#2563eb}pre{white-space:pre-wrap}';
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const content = m.html || `<pre>${esc(m.text)}</pre>`;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>${base}</style></head><body>${content}</body></html>`;
  const hasRemote = /<img[^>]+src=["']https?:/i.test(m.html || '');

  return (
    <div style={{ ...card, padding: 18, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn-o" onClick={onBack}>&larr; Back</button>
        <button className="btn-p" onClick={() => onReply(m)}>Reply</button>
        <button className="btn-o" onClick={() => onForward(m)}>Forward</button>
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>{m.subject}</h3>
      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, paddingBottom: 10, borderBottom: '1px solid #eef2f7', marginBottom: 12 }}>
        <div><b style={{ color: '#0f172a' }}>{who(m.from)}</b> <span style={{ color: '#94a3b8' }}>&lt;{m.from.address}&gt;</span></div>
        <div>To: {m.to.map(x => who(x)).join(', ') || '-'}{m.cc.length > 0 && <> &middot; Cc: {m.cc.map(x => who(x)).join(', ')}</>}</div>
        <div style={{ color: '#94a3b8' }}>{m.date ? new Date(m.date).toLocaleString('en-IN') : ''}</div>
      </div>
      {hasRemote && !images && <div style={{ background: '#fffbeb', color: '#92400e', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, marginBottom: 10 }}>Pictures from the internet are blocked. <button onClick={() => setImages(true)} style={{ border: 'none', background: 'none', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}>Show pictures</button></div>}
      <iframe title="mail" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} style={{ width: '100%', minHeight: 420, border: '1px solid #eef2f7', borderRadius: 8, background: '#fff' }}
        onLoad={e => { try { const h = e.target.contentDocument.documentElement.scrollHeight; e.target.style.height = Math.min(Math.max(h + 20, 300), 1600) + 'px'; } catch { /* locked */ } }} />
      {m.attachments.filter(a => !a.inline).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Attachments</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {m.attachments.filter(a => !a.inline).map(a => <button key={a.index} className="btn-o" onClick={() => download(a)}>{a.filename} <span style={{ color: '#94a3b8', marginLeft: 4 }}>{sizeText(a.size)}</span></button>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── the page ───────── */
export default function MyMail() {
  const [accounts, setAccounts] = useState(undefined); // undefined = loading, [] = none connected
  const [accountId, setAccountId] = useState('');
  const account = accounts === undefined ? undefined : (accounts.find(a => a.id === accountId) || accounts[0] || null);
  const [folder, setFolder] = useState('inbox');
  const [list, setList] = useState({ messages: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [view, setView] = useState({ name: 'list' }); // list | read | compose | account
  const searchTimer = useRef();

  const loadAccount = useCallback(() => {
    fetch(`${API}/mail/account`, { headers: auth() }).then(r => r.json()).then(d => {
      const l = d.accounts || [];
      setAccounts(l);
      setAccountId(prev => (l.some(a => a.id === prev) ? prev : ((l.find(a => a.is_default) || l[0] || {}).id || '')));
    }).catch(() => setAccounts([]));
  }, []);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const load = useCallback((o = {}) => {
    const fo = o.folder || folder, p = o.page || page, q = o.search !== undefined ? o.search : search, ps = o.pageSize || pageSize;
    setLoading(true); setErr('');
    const params = new URLSearchParams({ folder: fo, page: p, per_page: ps });
    if (accountId) params.set('account_id', accountId);
    if (q.trim()) params.set('search', q.trim());
    fetch(`${API}/mail/messages?${params}`, { headers: auth() })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load the mail'); return d; })
      .then(d => setList({ messages: d.messages || [], total: d.total || 0 }))
      .catch(e => { setList({ messages: [], total: 0 }); setErr(e.message); })
      .finally(() => setLoading(false));
  }, [folder, page, search, pageSize, accountId]);

  useEffect(() => { if (account) load(); }, [account, folder]); // eslint-disable-line
  const switchAccount = (id) => { setAccountId(id); setPage(1); setSearch(''); setList({ messages: [], total: 0 }); setView({ name: 'list' }); };

  const switchFolder = (f) => { setFolder(f); setPage(1); setView({ name: 'list' }); };
  const onSearch = (v) => { setSearch(v); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => { setPage(1); load({ search: v, page: 1 }); }, 450); };

  const disconnect = async (a) => {
    const x = await Swal.fire({ icon: 'warning', title: `Remove ${a.sender_email}?`, text: 'Your mails stay in your mailbox. Only the connection from this app is removed.', showCancelButton: true, confirmButtonText: 'Disconnect', confirmButtonColor: '#dc2626' });
    if (!x.isConfirmed) return;
    await fetch(`${API}/mail/account?id=${a.id}`, { method: 'DELETE', headers: auth() });
    setList({ messages: [], total: 0 });
    setView({ name: 'accounts' });
    loadAccount();
  };

  const makeDefault = async (a) => {
    await fetch(`${API}/mail/account`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) });
    loadAccount();
  };

  const quote = (m) => `\n\n--- On ${m.date ? new Date(m.date).toLocaleString('en-IN') : ''}, ${who(m.from)} <${m.from.address}> wrote ---\n` + String(m.text || '').split('\n').map(l => '> ' + l).join('\n');
  const reply = (m) => setView({ name: 'compose', initial: { to: m.from.address, subject: /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject, body: quote(m), in_reply_to: m.messageId || '', references: [...(m.references || []), m.messageId].filter(Boolean).join(' ') } });
  const forward = (m) => setView({ name: 'compose', initial: { subject: /^fwd?:/i.test(m.subject) ? m.subject : 'Fwd: ' + m.subject, body: `\n\n--- Forwarded mail ---\nFrom: ${who(m.from)} <${m.from.address}>\nSubject: ${m.subject}\n\n${m.text || ''}` } });

  if (account === undefined) return <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;

  const head = (
    <div className="ph" style={{ marginBottom: 12 }}>
      <div><h1>My Mail</h1><p>{account ? (accounts.length > 1 ? `${accounts.length} emails connected. Showing ${account.sender_email}` : `Connected as ${account.sender_email}`) : 'Connect your own email to send mail from it and see your Inbox and Sent box here.'}</p></div>
      {account && !['accounts', 'setup'].includes(view.name) && (
        <div className="ph-actions">
          <button className="btn-o" onClick={() => setView({ name: 'accounts' })}>{accounts.length > 1 ? 'Accounts' : 'Account'}</button>
        </div>
      )}
    </div>
  );

  if (!account) return (
    <div style={{ width: '100%' }}>{head}
      <div style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 10, padding: '9px 14px', fontSize: 13, marginBottom: 12 }}>After you connect your email you can <b>Compose</b> new mail, read your <b>Inbox</b> and see your <b>Sent</b> box on this page.</div>
      <Setup onDone={loadAccount} />
    </div>
  );
  if (view.name === 'accounts') return (
    <div style={{ width: '100%' }}>{head}
      <Accounts accounts={accounts} onBack={() => setView({ name: 'list' })} onAdd={() => setView({ name: 'setup', editing: null })} onEdit={a => setView({ name: 'setup', editing: a })} onDefault={makeDefault} onRemove={disconnect} />
    </div>
  );
  if (view.name === 'setup') return (
    <div style={{ width: '100%' }}>{head}
      <Setup key={view.editing ? view.editing.id : 'new'} account={view.editing} onDone={() => { loadAccount(); setView({ name: 'accounts' }); }} onCancel={() => setView({ name: 'accounts' })} />
    </div>
  );
  if (view.name === 'compose') return <div style={{ width: '100%' }}>{head}<Compose key={account.id} account={account} accounts={accounts} initial={view.initial} onClose={() => setView({ name: 'list' })} onSent={() => { setView({ name: 'list' }); load(); }} /></div>;
  if (view.name === 'read') return <div style={{ width: '100%' }}>{head}<Reader folder={folder} uid={view.uid} accountId={account.id} onBack={() => { setView({ name: 'list' }); load(); }} onReply={reply} onForward={forward} /></div>;

  return (
    <div style={{ width: '100%' }}>
      {head}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button className="btn-p" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setView({ name: 'compose', initial: {} })}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          Compose
        </button>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
          {[['inbox', 'Inbox'], ['sent', 'Sent']].map(([k, l]) => (
            <button key={k} onClick={() => switchFolder(k)} style={{ padding: '6px 18px', borderRadius: 8, border: 'none', background: folder === k ? '#fff' : 'transparent', boxShadow: folder === k ? '0 1px 3px rgba(0,0,0,.1)' : 'none', color: folder === k ? '#1d4ed8' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        {accounts.length > 1 && (
          <select value={account.id} onChange={e => switchAccount(e.target.value)} style={{ ...inp, width: 'auto', maxWidth: 260, fontWeight: 600 }} aria-label="Mailbox">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.sender_email}</option>)}
          </select>
        )}
        <input style={{ ...inp, maxWidth: 320 }} placeholder="Search subject, sender or recipient..." value={search} onChange={e => onSearch(e.target.value)} />
        <button className="btn-o" onClick={() => load()} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {err ? <div style={{ padding: 24, color: '#b91c1c', fontSize: 13.5 }}>{err}</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {loading && list.messages.length === 0 ? <tr><td style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>Loading your mail...</td></tr>
                  : list.messages.length === 0 ? <tr><td style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>{search ? 'No mail matches your search.' : folder === 'inbox' ? 'Your inbox is empty.' : 'Nothing sent yet.'}</td></tr>
                  : list.messages.map(m => (
                    <tr key={m.uid} onClick={() => setView({ name: 'read', uid: m.uid })} style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: !m.seen && folder === 'inbox' ? '#f8fbff' : '#fff' }}>
                      <td style={{ padding: '10px 14px', width: 220, maxWidth: 220, fontSize: 13, fontWeight: !m.seen && folder === 'inbox' ? 700 : 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {folder === 'sent' ? 'To: ' + (m.to.map(who).join(', ') || '-') : who(m.from) || '-'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#334155', fontWeight: !m.seen && folder === 'inbox' ? 700 : 400, maxWidth: 480, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.subject}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', textAlign: 'right' }}>{fmtDate(m.date)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {!err && list.total > 0 && (
          <div style={{ padding: '0 14px 10px' }}>
            <Pagination page={page} totalItems={list.total} pageSize={pageSize} itemLabel="mails" onPageChange={p => { setPage(p); load({ page: p }); }} onPageSizeChange={n => { setPageSize(n); setPage(1); load({ page: 1, pageSize: n }); }} />
          </div>
        )}
      </div>
    </div>
  );
}
