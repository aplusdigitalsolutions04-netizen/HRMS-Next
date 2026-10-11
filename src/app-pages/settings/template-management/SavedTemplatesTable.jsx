import React, { useState, useEffect } from 'react';
import { fmt, parseVars, CHIP_COLORS } from './helpers';
import { Link } from 'react-router-dom';
import Pagination, { paginate } from '../../shared/Pagination';

const PAGE_SIZE = 10;
const PILL = [['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'], ['#fef3c7', '#b45309'], ['#ede9fe', '#6d28d9'], ['#fee2e2', '#b91c1c'], ['#cffafe', '#0e7490'], ['#fce7f3', '#be185d']];

export default function SavedTemplatesTable({ templates: allTemplates, categories = [], loadingList, expandedId, setExpandedId, deleteTemplate, fetchTemplates, editTemplate }) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [cat, setCat] = useState('');
    const names = categories.map(c => c.name);
    const catOf = (t) => t.template_type || 'General';
    const templates = cat ? allTemplates.filter(t => catOf(t) === cat) : allTemplates;
    const pill = (name) => PILL[Math.max(0, names.indexOf(name)) % PILL.length];
    useEffect(() => { setPage(1); }, [templates.length, cat]);
    const pageItems = paginate(templates, page, pageSize);
    const countOf = (n) => allTemplates.filter(t => catOf(t) === n).length;

    return (
        <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div className="section-title">
                    Saved Templates
                    {!loadingList && (
                        <span style={{
                            background: '#dbeafe', color: '#1d4ed8',
                            borderRadius: '50px', padding: '3px 12px',
                            fontSize: '.78rem', fontWeight: 700
                        }}>
                            {templates.length} {cat ? `in ${cat}` : 'total'}
                        </span>
                    )}
                </div>
            </div>

            <div className="cat-chips">
                <button className={`cat-chip${cat === '' ? ' on' : ''}`} onClick={() => setCat('')}>All<small>{allTemplates.length}</small></button>
                {names.map(n => <button key={n} className={`cat-chip${cat === n ? ' on' : ''}`} onClick={() => setCat(n)}>{n}<small>{countOf(n)}</small></button>)}
                <Link to="/masters/template-categories" className="cat-link">Manage categories</Link>
            </div>

            <div className="tpl-table-wrapper">
                <table className="tpl-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Template Name</th>
                            <th>Category</th>
                            <th>Email Subject</th>
                            <th>Variables</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingList ? (
                            <tr className="loading-row">
                                <td colSpan={6}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
                                        {[1, 2, 3].map(n => <div key={n} className="skeleton" style={{ height: 14, opacity: 1 - n * 0.2 }} />)}
                                    </div>
                                </td>
                            </tr>
                        ) : templates.length === 0 ? (
                            <tr>
                                <td colSpan={6}>
                                    <div className="empty-state">
                                        <div className="icon">📭</div>
                                        <p><strong>{cat ? `No templates in ${cat} yet.` : 'No templates saved yet.'}</strong></p>
                                        <p style={{ marginTop: '6px', fontSize: '.88rem' }}>Click + Add Template, write the mail and pick the category it is for.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            pageItems.map((t, i) => (
                                <React.Fragment key={t.id}>
                                    <tr>
                                        <td style={{ color: '#94a3b8', fontWeight: 600, width: 40 }}>{(page - 1) * pageSize + i + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>{t.name}</div>
                                            <div style={{ fontSize: '.7rem', color: '#94a3b8', marginTop: 2 }}>{fmt(t.created_on)}</div>
                                        </td>
                                        <td>
                                            <span style={{
                                                display: 'inline-block', padding: '3px 10px', borderRadius: '50px', whiteSpace: 'nowrap',
                                                fontSize: '.72rem', fontWeight: 700,
                                                background: pill(catOf(t))[0],
                                                color: pill(catOf(t))[1],
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
                                                {parseVars(t.variables).slice(0, 2).map((v, i) => {
                                                    const c = CHIP_COLORS[i % CHIP_COLORS.length];
                                                    return (
                                                        <span key={i} className="var-chip" style={{ background: c.bg, color: c.color, fontSize: '.7rem', padding: '2px 9px' }}>
                                                            {'{{'}{v}{'}}'}
                                                        </span>
                                                    );
                                                })}
                                                {parseVars(t.variables).length > 2 && (
                                                    <span style={{ color: '#94a3b8', fontSize: '.75rem', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                                                        +{parseVars(t.variables).length - 2}
                                                    </span>
                                                )}
                                                {parseVars(t.variables).length === 0 && <span style={{ color: '#cbd5e1', fontSize: '.8rem' }}>—</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                                                <button
                                                    className="tbl-action tbl-view"
                                                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                                                >
                                                    {expandedId === t.id ? 'Hide' : 'View'}
                                                </button>
                                                <button
                                                    className="tbl-action tbl-view"
                                                    onClick={() => editTemplate(t)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="tbl-action tbl-del"
                                                    onClick={() => deleteTemplate(t.id, t.name)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Preview Row */}
                                    {expandedId === t.id && (
                                        <tr className="expand-row">
                                            <td colSpan={6}>
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
