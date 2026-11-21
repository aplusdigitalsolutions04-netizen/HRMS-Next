import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import useLiveRefresh from '@/lib/live';
import Pagination from '../shared/Pagination';
import { appLocale } from '@/lib/app-config-client';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const when = (v) => { try { return new Date(v).toLocaleString(appLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return v; } };
const STATUS_COLOR = { Open: ['var(--brand-soft)', 'var(--brand-dark)'], 'In Progress': ['#fffbeb', '#b45309'], Resolved: ['#f0fdf4', '#15803d'], Closed: ['#f1f5f9', '#475569'] };

const Badge = ({ s }) => {
  const c = STATUS_COLOR[s] || STATUS_COLOR.Closed;
  return <span style={{ background: c[0], color: c[1], padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{s}</span>;
};

// Help Desk. An employee asks HR a question and follows the answers; HR sees every question, answers it and changes its status.
export default function HelpDesk() {
  const isHr = sessionStorage.getItem('role') !== 'USER';
  const [list, setList] = useState({ tickets: [], total: 0, counts: {}, categories: [], statuses: [], mail_on: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);          // the "new question" form
  const [saving, setSaving] = useState(false);
  const ready = useRef(false);

  const load = useCallback((p = page, o = {}, quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    const q = { status, search, perPage: pageSize, ...o };
    const params = new URLSearchParams({ page: p, per_page: q.perPage });
    if (q.status) params.set('status', q.status);
    if (q.search) params.set('search', q.search);
    fetch(`${API}/helpdesk?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setList(d); setPage(d.page || 1); })
      .catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [page, status, search, pageSize]);

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [search]);
  useLiveRefresh(() => { if (!openId && !form) load(page, {}, true); });

  const setFilter = (s) => { setStatus(s); load(1, { status: s }); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/helpdesk`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not send');
      setForm(null);
      Swal.fire({ icon: 'success', title: 'Sent to HR', text: `Your ticket number is ${d.ticket_no}. You will be told when HR answers.`, timer: 2600, showConfirmButton: false });
      setStatus('active'); load(1, { status: 'active' });
    } catch (err) { Swal.fire({ icon: 'error', title: 'Not sent', text: err.message }); }
    finally { setSaving(false); }
  };

  const toggleMail = async () => {
    const next = list.mail_on ? '0' : '1';
    try {
      const res = await fetch(`${API}/settings/system`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify([{ setting_key: 'helpdesk_mail', setting_value: next }]) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      setList(l => ({ ...l, mail_on: next === '1' }));
    } catch (err) { Swal.fire({ icon: 'error', title: 'Not saved', text: err.message }); }
  };

  if (openId) return <Thread id={openId} isHr={isHr} statuses={list.statuses} onBack={() => { setOpenId(null); load(page, {}, true); }} />;

  const chip = (key, label) => {
    const n = key === 'active' ? (list.counts.Open || 0) + (list.counts['In Progress'] || 0) : key === '' ? Object.values(list.counts).reduce((a, b) => a + b, 0) : (list.counts[key] || 0);
    const on = status === key;
    return <button key={key || 'all'} onClick={() => setFilter(key)} style={{ border: '1px solid ' + (on ? 'var(--brand)' : '#e2e8f0'), background: on ? 'var(--brand)' : '#fff', color: on ? '#fff' : '#475569', padding: '6px 14px', borderRadius: 20, fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' }}>{label} <span style={{ opacity: .8 }}>({n})</span></button>;
  };

  return (
    <div>
      <style>{`
        .hd-row { cursor: pointer; } .hd-row:hover td { background: #f8fafc; }
        .hd-input { width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; font-family: inherit; outline: none; background: #fff; }
        .hd-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(111,78,55,.12); }
      `}</style>
      <div className="ph">
        <div>
          <h1>{isHr ? 'Help Desk' : 'Help Desk - ask HR'}</h1>
          <p>{isHr ? 'Questions from employees. Answer them here; the employee is told in the portal and by mail.' : 'Ask HR a question about your salary, leave, attendance, documents or anything else, and follow the answer here.'}</p>
        </div>
        <div className="ph-actions">
          {!isHr && <button className="btn-premium" onClick={() => setForm({ category: 'Other', subject: '', message: '' })}>+ New question</button>}
        </div>
      </div>

      {form && (
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>New question for HR</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>About</label>
              <select className="hd-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {(list.categories.length ? list.categories : ['Other']).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Subject</label>
              <input className="hd-input" maxLength={150} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="In a few words" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Your question</label>
            <textarea className="hd-input" rows={5} maxLength={5000} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Write what you need. Give dates, amounts or names if they help." />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-premium" disabled={saving}>{saving ? 'Sending...' : 'Send to HR'}</button>
            <button type="button" className="btn-premium" style={{ background: '#64748b' }} onClick={() => setForm(null)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {chip('active', 'Active')}{chip('Resolved', 'Resolved')}{chip('Closed', 'Closed')}{chip('', 'All')}
        {isHr && <input className="hd-input" style={{ flex: '1 1 220px', maxWidth: 340 }} placeholder="Search by ticket, subject or employee..." value={search} onChange={e => setSearch(e.target.value)} />}
        {isHr && <label style={{ marginLeft: 'auto', fontSize: '.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={!!list.mail_on} onChange={toggleMail} /> Email alerts</label>}
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}

      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: '9px 12px' }}>Ticket</th>
              {isHr && <th style={{ padding: '9px 12px' }}>Employee</th>}
              <th style={{ padding: '9px 12px' }}>Subject</th>
              <th style={{ padding: '9px 12px' }}>About</th>
              <th style={{ padding: '9px 12px' }}>Status</th>
              <th style={{ padding: '9px 12px' }}>Updated</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={isHr ? 6 : 5} style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : list.tickets.length === 0 ? <tr><td colSpan={isHr ? 6 : 5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>{isHr ? 'No tickets here.' : 'You have not asked anything yet. Press "New question" to write to HR.'}</td></tr>
                : list.tickets.map(t => (
                  <tr key={t.id} className="hd-row" onClick={() => setOpenId(t.id)} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.ticket_no}</td>
                    {isHr && <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{t.full_name} <span style={{ color: '#94a3b8' }}>({t.emp_code})</span></td>}
                    <td style={{ padding: '9px 12px', maxWidth: 360, wordBreak: 'break-word' }}>{t.subject}{t.last_from === (isHr ? 'employee' : 'hr') && t.status !== 'Closed' ? <span style={{ marginLeft: 8, background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '1px 8px', fontSize: 10.5, fontWeight: 700 }}>New reply</span> : null}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{t.category}</td>
                    <td style={{ padding: '9px 12px' }}><Badge s={t.status} /></td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>{when(t.updated_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={list.total} pageSize={pageSize} itemLabel="tickets" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>
    </div>
  );
}

function Thread({ id, isHr, statuses, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef(null);

  const load = useCallback(() => {
    fetch(`${API}/helpdesk/${id}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(setData).catch(e => setError(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(() => { if (!text) load(); });
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'nearest' }); }, [data && data.messages.length]);

  const call = async (method, body, url = `${API}/helpdesk/${id}`) => {
    const res = await fetch(url, { method, headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || 'Could not save');
    return d;
  };
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try { await call('POST', { message: text }); setText(''); load(); }
    catch (err) { Swal.fire({ icon: 'error', title: 'Not sent', text: err.message }); }
    finally { setSending(false); }
  };
  const change = async (body) => {
    try { await call('PUT', body); load(); }
    catch (err) { Swal.fire({ icon: 'error', title: 'Not saved', text: err.message }); }
  };
  const close = async () => {
    const c = await Swal.fire({ icon: 'question', title: 'Close this ticket?', text: 'You can still open a new ticket later.', showCancelButton: true, confirmButtonText: 'Close it' });
    if (c.isConfirmed) change({ status: 'Closed' });
  };

  if (error) return <div><button className="btn-premium" onClick={onBack}>&larr; Back</button><div style={{ color: '#b91c1c', marginTop: 12 }}>{error}</div></div>;
  if (!data) return <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;
  const { ticket: t, messages } = data;

  return (
    <div>
      <div className="ph">
        <div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 6 }}>&larr; All tickets</button>
          <h1 style={{ wordBreak: 'break-word' }}>{t.ticket_no} &middot; {t.subject}</h1>
          <p>{t.category}{isHr ? <> &middot; {t.full_name} ({t.emp_code}){t.designation ? ', ' + t.designation : ''}</> : null} &middot; opened {when(t.created_at)}</p>
        </div>
        <div className="ph-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge s={t.status} />
          {isHr && (
            <select className="hd-input" style={{ width: 'auto' }} value={t.status} onChange={e => change({ status: e.target.value })}>
              {(statuses.length ? statuses : ['Open', 'In Progress', 'Resolved', 'Closed']).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {isHr && <button className="btn-premium" onClick={() => change({ assign: !t.assigned_to })}>{t.assigned_to ? `Taken by ${String(t.assigned_to).split('@')[0]} (release)` : 'Take this ticket'}</button>}
          {!isHr && t.status !== 'Closed' && <button className="btn-premium" style={{ background: '#64748b' }} onClick={close}>Close ticket</button>}
        </div>
      </div>

      <style>{`.hd-input { padding: 8px 10px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .85rem; font-family: inherit; outline: none; background: #fff; } .hd-input:focus { border-color: var(--brand); }`}</style>
      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'grid', gap: 10, maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
          {messages.map(m => {
            const mine = isHr ? m.author_type === 'hr' : m.author_type === 'employee';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%', background: mine ? 'var(--brand-soft)' : '#f8fafc', border: '1px solid ' + (mine ? 'var(--brand-line)' : '#e2e8f0'), borderRadius: 12, padding: '8px 12px' }}>
                  <div style={{ fontSize: '.72rem', color: '#64748b', fontWeight: 700, marginBottom: 3 }}>{m.author_type === 'hr' ? `HR - ${m.author_name || 'HR team'}` : m.author_name || 'Employee'} &middot; {when(m.created_at)}</div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '.88rem' }}>{m.message}</div>
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>
        {t.status === 'Closed' ? (
          <div style={{ marginTop: 12, color: '#64748b', fontSize: '.85rem' }}>This ticket is closed.{isHr ? ' Change its status above to open it again.' : ' Please open a new ticket if you need more help.'}</div>
        ) : (
          <form onSubmit={send} style={{ marginTop: 12 }}>
            <textarea className="hd-input" style={{ width: '100%' }} rows={3} maxLength={5000} value={text} onChange={e => setText(e.target.value)} placeholder={isHr ? 'Write your answer...' : 'Write a reply...'} />
            <div style={{ marginTop: 8 }}><button type="submit" className="btn-premium" disabled={sending || !text.trim()}>{sending ? 'Sending...' : isHr ? 'Send answer' : 'Send reply'}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
