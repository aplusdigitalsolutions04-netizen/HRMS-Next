import React, { useState, useEffect } from 'react';
import Pagination, { paginate } from '../../shared/Pagination';

const PAGE_SIZE = 10;

const BADGE_MAP = {
    no_email: { bg: '#f1f5f9', c: '#64748b', label: 'No Email' },
    draft_saved: { bg: '#dbeafe', c: '#1d4ed8', label: 'Draft Saved' },
    reminder_active: { bg: '#fef3c7', c: '#92400e', label: 'Reminder Active' },
    overdue: { bg: '#fee2e2', c: '#991b1b', label: 'Overdue' },
    email_sent: { bg: '#dcfce7', c: '#166534', label: 'Email Sent' },
};

const CandidateTable = ({
    candidates, emailStatuses, loadingCandidates, fetchError, formatDate,
    onRefresh, onAdd, onEdit, onView, onEmailAction, onDelete,
}) => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    useEffect(() => { setPage(1); }, [candidates.length]);
    const pageItems = paginate(candidates, page, pageSize);

    return (
    <div className="candidate-card">
        <div className="header">
            <h2>📁 Candidate Pool {!loadingCandidates && !fetchError && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', marginLeft: 6 }}>({candidates.length} records)</span>}</h2>
            <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onRefresh} title="Refresh" style={{ background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '.82rem', fontWeight: 600, color: '#64748b' }}>🔄 Refresh</button>
                <button className="btn" onClick={onAdd}>➕ Add Candidate</button>
            </div>
        </div>

        <div style={{ width: '100%', overflow: 'hidden' }}>
            <table style={{ width: '100%', tableLayout: 'auto' }}>
                <colgroup>
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '13%' }} /><col style={{ width: '10%' }} /><col style={{ width: '13%' }} />
                    <col style={{ width: '11%' }} /><col style={{ width: '7%' }} /><col style={{ width: '9%' }} />
                    <col style={{ width: '7%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} />
                    <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Name</th><th>Mobile</th><th>Email</th>
                        <th>Apply Post</th><th>Round</th><th>Date</th>
                        <th>Mode</th><th>Status</th>
                        <th>Email Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {pageItems.map((c, idx) => {
                        const es = emailStatuses[c.id] || {};
                        const emailStatus = es.status || 'no_email';
                        const badge = BADGE_MAP[emailStatus] || BADGE_MAP.no_email;
                        return (
                            <tr key={c.id}>
                                <td style={{ color: '#94a3b8', fontSize: '.82rem' }}>{(page - 1) * pageSize + idx + 1}</td>
                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>{c.candidate_name}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{c.contact_number}</td>
                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>{c.email_id}</td>
                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>{c.apply_post}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{c.interview_round}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(c.interview_date)}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{c.interview_mode}</td>
                                <td>
                                    <span className={`status-badge ${c.status?.toLowerCase().replace(' ', '-')}`} style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                        {c.status}
                                    </span>
                                </td>
                                <td>
                                    <span style={{ background: badge.bg, color: badge.c, padding: '2px 8px', borderRadius: 50, fontWeight: 700, fontSize: '.7rem', display: 'inline-block', whiteSpace: 'nowrap' }}>{badge.label}</span>
                                </td>
                                <td>
                                    <div className="action-buttons" style={{ gap: '4px', flexWrap: 'nowrap' }}>
                                        <button className="btn" onClick={() => onEdit(c.id)} style={{ padding: '5px 8px', fontSize: '.72rem', gap: '3px' }}>✏️</button>
                                        <button className="btn" onClick={() => onView(c.id)} style={{ padding: '5px 8px', fontSize: '.72rem', gap: '3px' }}>👁️</button>
                                        <button className="btn" onClick={() => onEmailAction(c, es)} style={{ padding: '5px 8px', fontSize: '.72rem', gap: '3px', background: emailStatus === 'overdue' ? 'linear-gradient(135deg,#dc2626,#ef4444)' : undefined }}>📧</button>
                                        <button className="btn" onClick={() => onDelete(c.id)} style={{ padding: '5px 8px', fontSize: '.72rem', gap: '3px' }}>🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {loadingCandidates && (
                        <tr><td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                <div style={{ width: 22, height: 22, border: '3px solid #e0e7ff', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                <span style={{ fontWeight: 600 }}>Loading candidates…</span>
                            </div>
                        </td></tr>
                    )}
                    {!loadingCandidates && fetchError && (
                        <tr><td colSpan={11}>
                            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                                <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>⚠️</div>
                                <div style={{ color: '#991b1b', fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>Failed to load candidates</div>
                                <div style={{ color: '#64748b', fontSize: '.88rem', marginBottom: '20px', maxWidth: 480, margin: '0 auto 20px' }}>{fetchError}</div>
                                <button onClick={onRefresh} style={{ background: 'linear-gradient(135deg,#4338ca,#7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 26px', fontWeight: 700, cursor: 'pointer', fontSize: '.9rem' }}>🔄 Retry</button>
                            </div>
                        </td></tr>
                    )}
                    {!loadingCandidates && !fetchError && candidates.length === 0 && (
                        <tr><td colSpan={11}>
                            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                                <div style={{ fontSize: '2.8rem', marginBottom: '10px' }}>📬</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#475569' }}>No candidates found.</div>
                                <div style={{ fontSize: '.85rem', marginTop: '6px' }}>Add a new candidate using the button above.</div>
                            </div>
                        </td></tr>
                    )}
                </tbody>
            </table>
        </div>
        {!loadingCandidates && !fetchError && (
            <Pagination page={page} totalItems={candidates.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="candidates" />
        )}
    </div>
    );
};

export default CandidateTable;
