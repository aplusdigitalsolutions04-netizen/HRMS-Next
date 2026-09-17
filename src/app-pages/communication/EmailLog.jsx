import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import Swal from 'sweetalert2';
import { emailLogStyles } from './email-log/styles';
import { formatDT, formatDate } from './email-log/helpers';
import StatusBadge from './email-log/StatusBadge';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;

const DetailView = lazy(() => import('./email-log/DetailView'));

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const StatCard = ({ icon, value, label, color }) => (
    <div className="el-card">
        <div className="el-card-icon" style={{ color }}>{icon}</div>
        <div className="el-card-body">
            <div className="el-card-value">{value}</div>
            <div className="el-card-label">{label}</div>
        </div>
    </div>
);

const EmailLog = () => {
    const [logs, setLogs]           = useState([]);
    const [filtered, setFiltered]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [statusFilter, setStatus] = useState('all');
    const [dateFrom, setDateFrom]   = useState('');
    const [dateTo, setDateTo]       = useState('');
    const [viewing, setViewing]     = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const menuRef = useRef(null);

    useEffect(() => { fetchLogs(); }, []);

    useEffect(() => {
        const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const fetchLogs = () => {
        setLoading(true);
        fetch(`${API}/email/logs`, { headers: auth() })
            .then(r => {
                if (r.status === 401) { sessionStorage.removeItem('token'); window.location.href = '/login'; }
                return r.json();
            })
            .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false); })
            .catch(() => { setLogs([]); setLoading(false); });
    };

    useEffect(() => {
        let result = [...logs];
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(l =>
                (l.candidate_name || '').toLowerCase().includes(q) ||
                (l.to_email || '').toLowerCase().includes(q) ||
                (l.subject || '').toLowerCase().includes(q) ||
                (l.job_role || '').toLowerCase().includes(q) ||
                (l.template_name || '').toLowerCase().includes(q)
            );
        }
        if (statusFilter !== 'all') result = result.filter(l => l.status === statusFilter);
        if (dateFrom) { const f = new Date(dateFrom); result = result.filter(l => l.sent_at && new Date(l.sent_at) >= f); }
        if (dateTo) { const t = new Date(dateTo); t.setHours(23,59,59); result = result.filter(l => l.sent_at && new Date(l.sent_at) <= t); }
        setFiltered(result);
        setPage(1);
    }, [logs, search, statusFilter, dateFrom, dateTo]);

    const pageItems = paginate(filtered, page, pageSize);

    const exportCSV = () => {
        const headers = ['Sent At','Candidate Name','To Email','Subject','Job Role','Round','Interview Date','Template','Sent By','Status','Error'];
        const rows = filtered.map(l => [
            formatDT(l.sent_at), l.candidate_name||'', (l.to_email||'').replace(/,/g,';'),
            (l.subject||'').replace(/,/g,';'), l.job_role||'', l.interview_round||'',
            formatDate(l.interview_date), l.template_name||'', l.sent_by||'', l.status||'',
            (l.error_message||'').replace(/,/g,';'),
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type:'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `email_log_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    const sentCount   = logs.filter(l => l.status === 'sent').length;
    const failedCount = logs.filter(l => l.status === 'failed').length;
    const successRate = logs.length > 0 ? Math.round((sentCount / logs.length) * 100) : 0;

    const resendEmail = (log) => {
        setOpenMenuId(null);
        Swal.fire({
            title: 'Resend Email?',
            text: `Resend to ${log.to_email}?`,
            icon: 'question', showCancelButton: true, confirmButtonText: 'Resend',
        }).then(r => {
            if (!r.isConfirmed) return;
            fetch(`${API}/email/resend/${log.id}`, { method:'POST', headers:{...auth(),'Content-Type':'application/json'} })
                .then(async r => ({ ok: r.ok, data: await r.json() }))
                .then(({ ok, data }) => {
                    Swal.fire({ icon:ok?'success':'error', title:ok?'Sent!':'Failed', text:(ok?data.message:data.detail)||'', timer:1500, showConfirmButton:false });
                    if (ok) fetchLogs();
                })
                .catch(() => Swal.fire({ icon:'error', title:'Error', text:'Could not resend email.' }));
        });
    };

    const deleteLog = (log) => {
        setOpenMenuId(null);
        Swal.fire({
            title: 'Delete Email Log?',
            text: `Delete log for "${log.subject || 'No subject'}"?`,
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#ef4444',
        }).then(r => {
            if (!r.isConfirmed) return;
            fetch(`${API}/email/log/${log.id}`, { method:'DELETE', headers: auth() })
                .then(async r => ({ ok: r.ok, data: await r.json() }))
                .then(({ ok, data }) => {
                    Swal.fire({ icon:ok?'success':'error', title:ok?'Deleted!':'Failed', text:(ok?data.message:data.detail)||'', timer:1500, showConfirmButton:false });
                    if (ok) fetchLogs();
                })
                .catch(() => Swal.fire({ icon:'error', title:'Error', text:'Could not delete log.' }));
        });
    };

    const downloadLog = (log) => {
        setOpenMenuId(null);
        const content = [
            `Subject: ${log.subject || 'N/A'}`,
            `To: ${log.to_email}`,
            `Candidate: ${log.candidate_name || 'N/A'}`,
            `Job Role: ${log.job_role || 'N/A'}`,
            `Template: ${log.template_name || 'Custom'}`,
            `Status: ${log.status}`,
            `Sent At: ${formatDT(log.sent_at)}`,
            `Interview: ${formatDate(log.interview_date)}`,
            `Sent By: ${log.sent_by || 'N/A'}`,
            '',
            '--- Body ---',
            log.body || '(No body)',
        ].join('\n');
        const blob = new Blob([content], { type:'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `email_${log.id.slice(0,8)}.txt`;
        a.click(); URL.revokeObjectURL(url);
    };

    return (
        <>
            <style>{emailLogStyles}</style>

            <div className="el-page">
                {/* ── Page Header ── */}
                {viewing ? (
                    <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
                        <DetailView viewing={viewing} setViewing={setViewing} />
                    </Suspense>
                ) : (
                    <>
                <div className="el-header">
                    <div className="el-header-left">
                        <h2>Email Log</h2>
                        <p>Complete history of all emails sent to candidates via SMTP</p>
                    </div>
                    <div className="el-header-right">
                        <button className="el-btn-refresh" onClick={fetchLogs}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {/* ── Statistics Cards ── */}
                <div className="el-stats">
                    <StatCard
                        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
                        value={logs.length}
                        label="Total Emails"
                        color="#6366f1"
                    />
                    <StatCard
                        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                        value={sentCount}
                        label="Delivered"
                        color="#10b981"
                    />
                    <StatCard
                        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
                        value={failedCount}
                        label="Failed"
                        color="#ef4444"
                    />
                    <StatCard
                        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>}
                        value={`${successRate}%`}
                        label="Success Rate"
                        color="#f59e0b"
                    />
                </div>

                {/* ── Filter Toolbar ── */}
                <div className="el-toolbar">
                    <input className="el-search" placeholder="Search by candidate, email, subject, job role, template…" value={search} onChange={e => setSearch(e.target.value)} />
                    <select className="el-filter-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                    </select>
                    <input type="date" className="el-date-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
                    <input type="date" className="el-date-input" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
                    <button className="el-btn-export" onClick={exportCSV} disabled={filtered.length === 0}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export
                    </button>
                </div>

                {/* ── Table ── */}
                <div className="el-table-wrap">
                    {loading ? (
                        <div className="el-loading"><div className="el-spinner" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="el-empty">
                            <span className="el-empty-icon">📧</span>
                            <div className="el-empty-title">No Emails Found</div>
                            <div className="el-empty-desc">
                                {logs.length === 0
                                    ? 'No emails have been sent yet. Send an email from Candidate Pool to see logs here.'
                                    : 'No email logs match the selected filters.'}
                            </div>
                            {logs.length > 0 && (
                                <button className="el-empty-btn" onClick={() => { setSearch(''); setStatus('all'); setDateFrom(''); setDateTo(''); }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <table className="el-table">
                                <colgroup>
                                    <col style={{width:40}} />
                                    <col className="el-col-date" />
                                    <col className="el-col-candidate" />
                                    <col className="el-col-subject" />
                                    <col className="el-col-status" />
                                    <col className="el-col-template" />
                                    <col className="el-col-interview" />
                                    <col className="el-col-actions" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th style={{color:'#94a3b8', fontWeight:600}}>#</th>
                                        <th>Date</th>
                                        <th>Candidate</th>
                                        <th>Subject</th>
                                        <th>Status</th>
                                        <th>Template</th>
                                        <th>Interview Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageItems.map((log, idx) => (
                                        <tr key={log.id}>
                                            <td style={{color:'#64748b', fontSize:'.85rem'}}>{(page - 1) * pageSize + idx + 1}</td>
                                            <td><span className="el-date-text">{formatDT(log.sent_at)}</span></td>
                                            <td>
                                                <div className="el-cell-text el-candidate-name" title={log.candidate_name}>
                                                    {log.candidate_name || '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="el-cell-text el-subject-text" title={log.subject}>
                                                    {log.subject || '—'}
                                                </div>
                                            </td>
                                            <td><StatusBadge status={log.status} /></td>
                                            <td>
                                                <span className="el-tpl-chip" title={log.template_name}>{log.template_name || 'Custom'}</span>
                                            </td>
                                            <td><span className="el-date-text">{formatDate(log.interview_date)}</span></td>
                                            <td>
                                                <div className="el-actions">
                                                    <button className="el-btn-view" onClick={() => setViewing(log)} title="View Details">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    </button>
                                                    <div className="el-btn-more" onClick={() => setOpenMenuId(openMenuId === log.id ? null : log.id)}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                                                        {openMenuId === log.id && (
                                                            <div className="el-dropdown" ref={menuRef} onClick={e => e.stopPropagation()}>
                                                                <button className="el-dropdown-item" onClick={() => { setViewing(log); setOpenMenuId(null); }}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                                    View Email
                                                                </button>
                                                                <button className="el-dropdown-item" onClick={() => downloadLog(log)}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                                    Download
                                                                </button>
                                                                <button className="el-dropdown-item" onClick={() => resendEmail(log)}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                                                    Resend
                                                                </button>
                                                                <button className="el-dropdown-item danger" onClick={() => deleteLog(log)}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="el-result-count">
                                Showing <strong>{filtered.length}</strong> of <strong>{logs.length}</strong> records
                                {filtered.length !== logs.length && ' (filtered)'}
                            </div>
                            <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="logs" />
                        </>
                    )}
                </div>
                    </>
                )}
            </div>
        </>
    );
};

export default EmailLog;
