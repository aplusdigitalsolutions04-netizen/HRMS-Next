import React, { useState, useEffect } from 'react';
import { fmt, parseVars, CHIP_COLORS } from './helpers';
import Pagination, { paginate } from '../../shared/Pagination';

const PAGE_SIZE = 10;

export default function SavedTemplatesTable({ templates, loadingList, expandedId, setExpandedId, deleteTemplate, fetchTemplates, editTemplate }) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    useEffect(() => { setPage(1); }, [templates.length]);
    const pageItems = paginate(templates, page, pageSize);

    return (
        <div style={{ marginTop: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div className="section-title">
                    <span className="step-num" style={{ background: 'linear-gradient(135deg,#0284c7,#6366f1)' }}>3</span>
                    Saved Templates
                    {!loadingList && (
                        <span style={{
                            background: '#dbeafe', color: '#1d4ed8',
                            borderRadius: '50px', padding: '3px 12px',
                            fontSize: '.78rem', fontWeight: 800
                        }}>
                            {templates.length} total
                        </span>
                    )}
                </div>
                <button
                    onClick={fetchTemplates}
                    style={{
                        background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                        padding: '7px 16px', fontSize: '.82rem', cursor: 'pointer', fontWeight: 600,
                        color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px',
                        fontFamily: "'Outfit', sans-serif", transition: 'all .2s',
                        boxShadow: 'none'
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#4338ca'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                    🔄 Refresh
                </button>
            </div>

            <div className="tpl-table-wrapper">
                <table className="tpl-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Template Name</th>
                            <th>Type</th>
                            <th>Email Subject</th>
                            <th>Variables</th>
                            <th>Created On</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingList ? (
                            <tr className="loading-row">
                                <td colSpan={7}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
                                        {[1, 2, 3].map(n => <div key={n} className="skeleton" style={{ height: 14, opacity: 1 - n * 0.2 }} />)}
                                    </div>
                                </td>
                            </tr>
                        ) : templates.length === 0 ? (
                            <tr>
                                <td colSpan={7}>
                                    <div className="empty-state">
                                        <div className="icon">📭</div>
                                        <p><strong>No templates saved yet.</strong></p>
                                        <p style={{ marginTop: '6px', fontSize: '.88rem' }}>Upload a file above and let AI extract the email structure.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            pageItems.map((t, i) => (
                                <React.Fragment key={t.id}>
                                    <tr>
                                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>{(page - 1) * pageSize + i + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{t.name}</div>
                                        </td>
                                        <td>
                                            <span style={{
                                                display: 'inline-block', padding: '3px 10px', borderRadius: '50px',
                                                fontSize: '.72rem', fontWeight: 700,
                                                background: t.template_type === 'Interview' ? '#dbeafe' : '#f1f5f9',
                                                color: t.template_type === 'Interview' ? '#1d4ed8' : '#475569',
                                            }}>
                                                {t.template_type || 'General'}
                                            </span>
                                        </td>
                                        <td style={{ color: '#475569', maxWidth: '260px' }}>
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {t.subject}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="vars-wrap">
                                                {parseVars(t.variables).slice(0, 3).map((v, i) => {
                                                    const c = CHIP_COLORS[i % CHIP_COLORS.length];
                                                    return (
                                                        <span key={i} className="var-chip" style={{ background: c.bg, color: c.color, fontSize: '.7rem', padding: '2px 9px' }}>
                                                            {'{{'}{v}{'}}'}
                                                        </span>
                                                    );
                                                })}
                                                {parseVars(t.variables).length > 3 && (
                                                    <span style={{ color: '#94a3b8', fontSize: '.75rem', alignSelf: 'center' }}>
                                                        +{parseVars(t.variables).length - 3} more
                                                    </span>
                                                )}
                                                {parseVars(t.variables).length === 0 && <span style={{ color: '#cbd5e1', fontSize: '.8rem' }}>—</span>}
                                            </div>
                                        </td>
                                        <td style={{ color: '#64748b', fontSize: '.85rem' }}>
                                            {fmt(t.created_on)}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    className="tbl-action tbl-view"
                                                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                                                >
                                                    {expandedId === t.id ? '🔼 Hide' : '👁️ View'}
                                                </button>
                                                <button
                                                    className="tbl-action tbl-view"
                                                    onClick={() => editTemplate(t)}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    className="tbl-action tbl-del"
                                                    onClick={() => deleteTemplate(t.id, t.name)}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Preview Row */}
                                    {expandedId === t.id && (
                                        <tr className="expand-row">
                                            <td colSpan={7}>
                                                <div className="expand-inner">
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                                        <div className="expand-field">
                                                            <div className="expand-label">📌 Template Name</div>
                                                            <div className="expand-value">{t.name}</div>
                                                        </div>
                                                        <div className="expand-field">
                                                            <div className="expand-label">📨 Email Subject</div>
                                                            <div className="expand-value">{t.subject}</div>
                                                        </div>
                                                    </div>
                                                    <div className="expand-field">
                                                        <div className="expand-label">📝 Email Body</div>
                                                        <div className="expand-value">{t.body}</div>
                                                    </div>
                                                    {parseVars(t.variables).length > 0 && (
                                                        <div className="expand-field" style={{ marginBottom: 0 }}>
                                                            <div className="expand-label" style={{ marginBottom: '8px' }}>🔧 All Variables</div>
                                                            <div className="vars-wrap">
                                                                {parseVars(t.variables).map((v, i) => {
                                                                    const c = CHIP_COLORS[i % CHIP_COLORS.length];
                                                                    return (
                                                                        <span key={i} className="var-chip" style={{ background: c.bg, color: c.color, border: `1.5px solid ${c.color}30` }}>
                                                                            {'{{'}{v}{'}}'}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
                {!loadingList && (
                    <Pagination page={page} totalItems={templates.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="templates" />
                )}
            </div>
        </div>
    );
}
