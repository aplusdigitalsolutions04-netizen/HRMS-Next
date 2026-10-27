import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';
import Pagination, { paginate } from '../shared/Pagination';
import useLiveRefresh from '@/lib/live';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const fmt = (d) => { if (!d) return '-'; const x = new Date(d); return isNaN(x.getTime()) ? '-' : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
const daysSince = (d) => { if (!d) return 0; const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return n < 0 ? 0 : n; };

// Candidates who did not answer the interview call or mail. They leave the Candidate Pool for this list; "Responded"
// puts a candidate back in the Pool with the whole interview history. "Follow-up mail" sends a reminder and counts it.
export default function NoResponse() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ pool: 0, no_response: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState('');
  const first = useRef(true);

  const load = useCallback((silent) => {
    if (silent !== true) setLoading(true);
    const q = new URLSearchParams({ view: 'no_response', per_page: 100 });
    if (search.trim()) q.set('search', search.trim());
    fetch(`${API}/candidate/data?${q}`, { headers: auth() })
      .then(r => r.json())
      .then(d => { setRows(d.data || []); setCounts(d.counts || { pool: 0, no_response: 0 }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    if (first.current) { first.current = false; load(); return; }
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line
  useLiveRefresh(() => load(true));

  const call = async (id, path, body, ok) => {
    setBusy(id);
    try {
      const res = await fetch(`${API}/candidate/${id}/${path}`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      Swal.fire({ icon: 'success', title: ok || d.message, timer: 1500, showConfirmButton: false });
      load(true);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setBusy(''); }
  };

  const responded = async (c) => {
    const x = await Swal.fire({ icon: 'question', title: `${c.candidate_name} responded?`, text: 'They will go back to the Candidate Pool with their interview history.', showCancelButton: true, confirmButtonText: 'Yes, move back' });
    if (x.isConfirmed) call(c.id, 'no-response', { action: 'responded' }, 'Moved back to the Candidate Pool');
  };

  const followUp = async (c) => {
    if (!c.email_id) { Swal.fire({ icon: 'warning', title: 'No email', text: 'This candidate has no email address. Call them instead.' }); return; }
    const post = c.apply_post ? ` for the ${c.apply_post} position` : '';
    const when = c.interview_date ? ` (${c.interview_round || 'interview'} on ${fmt(c.interview_date)})` : '';
    const x = await Swal.fire({
      title: `Follow-up mail to ${c.candidate_name}`, width: 640, showCancelButton: true, confirmButtonText: 'Send mail', focusConfirm: false,
      html: `<div style="text-align:left"><label style="font-size:12px;font-weight:700">Subject</label><input id="fu-sub" class="swal2-input" style="margin:4px 0 12px;width:100%;box-sizing:border-box" value="Reminder: your interview${post.replace(/"/g, '')}">
        <label style="font-size:12px;font-weight:700">Message</label><textarea id="fu-msg" class="swal2-textarea" style="margin:4px 0;width:100%;box-sizing:border-box;height:170px">Dear ${c.candidate_name},\n\nWe tried to reach you regarding your interview${post}${when}, but could not connect with you.\nPlease reply to this mail or call us to confirm a suitable time.\n\nRegards,\nHR Team</textarea></div>`,
      preConfirm: () => { const s = document.getElementById('fu-sub').value.trim(), m = document.getElementById('fu-msg').value.trim(); if (!s || !m) { Swal.showValidationMessage('Write the subject and the message'); return false; } return { subject: s, message: m }; },
    });
    if (x.isConfirmed) call(c.id, 'follow-up', x.value, 'Follow-up mail sent');
  };

  const th = { textAlign: 'left', padding: '9px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e8edf6', whiteSpace: 'nowrap' };
  const td = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f4f6fa', verticalAlign: 'middle' };
  const items = paginate(rows, page, pageSize);

  return (
    <div style={{ width: '100%' }}>
      <div className="ph" style={{ marginBottom: 12 }}>
        <div>
          <h1>No Response</h1>
          <p>Candidates who did not answer the interview call or mail. When one answers, press Responded and they go back to the Candidate Pool.</p>
        </div>
        <div className="ph-actions"><Link to="/candidates/data" className="btn-o">&larr; Candidate Pool ({counts.pool})</Link></div>
      </div>

      <div className="filters" style={{ marginBottom: 10 }}>
        <div className="f-search" style={{ flex: 1, minWidth: 220 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by name, email or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{counts.no_response} waiting</span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr><th style={{ ...th, width: 40 }}>#</th><th style={th}>Candidate</th><th style={th}>Last round</th><th style={th}>No response since</th><th style={th}>Follow-ups</th><th style={th}>Note</th><th style={th}>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" style={{ ...td, textAlign: 'center', padding: 28, color: '#94a3b8' }}>Loading...</td></tr>
                : rows.length === 0 ? <tr><td colSpan="7" style={{ ...td, textAlign: 'center', padding: 30, color: '#94a3b8' }}>{search ? 'No candidate matches your search.' : 'Nobody is waiting. Candidates who do not respond are moved here from the Candidate Pool (the 🔕 button).'}</td></tr>
                : items.map((c, i) => {
                  const d = daysSince(c.no_response_on);
                  return (
                    <tr key={c.id}>
                      <td style={{ ...td, color: '#94a3b8' }}>{(page - 1) * pageSize + i + 1}</td>
                      <td style={td}><b style={{ color: '#0f172a' }}>{c.candidate_name}</b><div style={{ fontSize: 12, color: '#64748b' }}>{c.contact_number}{c.email_id ? ' · ' + c.email_id : ''}</div></td>
                      <td style={td}>{c.interview_round || '-'}<div style={{ fontSize: 12, color: '#94a3b8' }}>{c.apply_post || ''}{c.interview_date ? ' · ' + fmt(c.interview_date) : ''}</div></td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmt(c.no_response_on)} <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: d >= 7 ? '#fee2e2' : d >= 3 ? '#fef3c7' : '#f1f5f9', color: d >= 7 ? '#b91c1c' : d >= 3 ? '#b45309' : '#475569' }}>{d === 0 ? 'today' : `${d} day${d > 1 ? 's' : ''}`}</span></td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.follow_up_count || 0}<div style={{ fontSize: 11.5, color: '#94a3b8' }}>{c.last_follow_up_on ? 'last ' + fmt(c.last_follow_up_on) : 'none yet'}</div></td>
                      <td style={{ ...td, maxWidth: 220, color: '#475569' }}>{c.no_response_note || '-'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button className="btn-o" style={{ height: 30, padding: '0 11px', fontSize: 12.5, marginRight: 6 }} disabled={busy === c.id} onClick={() => followUp(c)}>Follow-up mail</button>
                        <button className="btn-p" style={{ height: 30, padding: '0 12px', fontSize: 12.5 }} disabled={busy === c.id} onClick={() => responded(c)}>Responded</button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <div style={{ padding: '0 14px 10px' }}>
            <Pagination page={page} totalItems={rows.length} pageSize={pageSize} itemLabel="candidates" onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} />
          </div>
        )}
      </div>
    </div>
  );
}
