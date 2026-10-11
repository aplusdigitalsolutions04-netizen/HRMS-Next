import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';
import { CHIP_COLORS } from './helpers';

const REQUEST_WORDS = ['employee_name', 'emp_code', 'leave_type', 'request_type', 'from_date', 'to_date', 'duration', 'date', 'in_time', 'out_time', 'reason', 'message', 'manager_name', 'remarks', 'status', 'review_link', 'company_name'];

export default function PreviewSection({ preview, setPreview, saving, saveTemplate, resetUpload, bodyRef, onInsertVar }) {
    // the categories come from Masters > Template Categories
    const [cats, setCats] = useState([{ name: 'General' }, { name: 'Interview' }]);
    const H = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token'), 'Content-Type': 'application/json' });
    const loadCats = () => fetch('/api/template-categories', { headers: H() })
        .then(r => r.json()).then(d => { if (Array.isArray(d.categories) && d.categories.length) setCats(d.categories); })
        .catch(() => {});
    useEffect(() => { loadCats(); }, []);
    const categories = cats.map(c => c.name);
    const current = cats.find(c => c.name === (preview && preview.template_type)) || null;

    // add a category without leaving the editor
    const addCategory = async () => {
        const x = await Swal.fire({ title: 'New category', input: 'text', inputPlaceholder: 'e.g. Offer Letter', showCancelButton: true, confirmButtonText: 'Add', inputValidator: v => (!v || !v.trim() ? 'Enter a name' : null) });
        if (!x.isConfirmed) return;
        try {
            const res = await fetch('/api/template-categories', { method: 'POST', headers: H(), body: JSON.stringify({ name: x.value }) });
            const d = await res.json();
            if (!res.ok) throw new Error(d.detail || 'Could not add the category');
            await loadCats();
            setPreview(p => ({ ...p, template_type: x.value.trim() }));
        } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    };
    if (!preview) return null;
    return (
        <div className="preview-card">
            <div className="preview-header">
                <div className="section-title">
                    {preview.id ? 'Template details' : preview.manual ? 'Template details' : 'Review & edit what AI read'}
                </div>
                {!preview.id && !preview.manual && <span className="ai-badge">🤖 AI Extracted</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="pfield">
                    <div className="field-label">Template Name</div>
                    <input
                        className="pinput"
                        value={preview.name}
                        onChange={e => setPreview(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Interview Call Letter"
                    />
                </div>
                {/* Subject */}
                <div className="pfield">
                    <div className="field-label">Email Subject</div>
                    <input
                        className="pinput"
                        value={preview.subject}
                        onChange={e => setPreview(p => ({ ...p, subject: e.target.value }))}
                        placeholder="Email subject line…"
                    />
                </div>
                <div className="pfield">
                    <div className="field-label">Category (what is this template for?)</div>
                    <select
                        className="pinput"
                        value={preview.template_type || 'General'}
                        onChange={e => { if (e.target.value === '__new') addCategory(); else setPreview(p => ({ ...p, template_type: e.target.value })); }}
                    >
                        {[...new Set([...categories, preview.template_type || 'General'])].map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__new">+ New category...</option>
                    </select>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                        {current && current.request_kind
                            ? <>This template can be chosen in <Link to="/settings/request-mails" style={{ color: '#2563eb', fontWeight: 600 }}>Settings &gt; Request Mails</Link> for the {current.name} mails.</>
                            : <>To use a template for leave, WFH, missed punch or late coming mails, pick the matching category.</>}
                        {' '}<Link to="/masters/template-categories" style={{ color: '#2563eb', fontWeight: 600 }}>Manage categories</Link>
                        {current && current.request_kind === 'leave' && <> &middot; Leave types (Annual, Sick, ...) are added in <Link to="/masters/leave-types" style={{ color: '#2563eb', fontWeight: 600 }}>Masters &gt; Leave Types</Link>.</>}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="pfield">
                <div className="field-label">Email Body</div>
                <textarea
                    ref={bodyRef}
                    className="ptextarea"
                    value={preview.body}
                    onChange={e => setPreview(p => ({ ...p, body: e.target.value }))}
                    placeholder="Email body with {{variables}}…"
                    rows={10}
                />
                <div style={{ fontSize: '.78rem', color: '#94a3b8', marginTop: '5px' }}>
                    💡 Use <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{'{CANDIDATE_NAME}'}</code> or <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{'{{variable_name}}'}</code> for dynamic placeholders
                </div>
            </div>

            {current && current.request_kind && onInsertVar && (
                <div className="pfield">
                    <div className="field-label" style={{ marginBottom: 8 }}>Words for {current.name} mails <span style={{ color: '#94a3b8', fontWeight: 500 }}>(click to put in the body)</span></div>
                    <div className="vars-wrap">
                        {REQUEST_WORDS.map(w => <button key={w} type="button" className="var-chip" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #bfdbfe', cursor: 'pointer' }} onClick={() => onInsertVar('{{' + w + '}}')}>{'{{' + w + '}}'}</button>)}
                    </div>
                </div>
            )}

            {/* Variables */}
            <div className="pfield">
                <div className="field-label" style={{ marginBottom: '10px' }}>
                    Detected Variables
                    <span style={{
                        background: '#dbeafe', color: '#2563eb',
                        borderRadius: '50px', padding: '2px 10px',
                        fontSize: '.75rem', fontWeight: 700, marginLeft: '8px'
                    }}>
                        {preview.variables.length}
                    </span>
                </div>
                {preview.variables.length > 0 ? (
                    <div className="vars-wrap">
                        {preview.variables.map((v, i) => {
                            const c = CHIP_COLORS[i % CHIP_COLORS.length];
                            return (
                                <span key={i} className="var-chip" style={{ background: c.bg, color: c.color, border: `1.5px solid ${c.color}30` }}>
                                    {'{{' + v + '}}'}
                                    <button className="chip-remove" onClick={() => setPreview(p => ({ ...p, variables: p.variables.filter((_, j) => j !== i) }))}>✕</button>
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ color: '#94a3b8', fontSize: '.88rem' }}>
                        No variables detected. Add <code>{'{CANDIDATE_NAME}'}</code> or <code>{'{{variable_name}}'}</code> in the body above.
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'flex-end' }}>
                <button className="reset-btn" onClick={resetUpload}>✕ Cancel</button>
                <button className="save-btn" disabled={saving} onClick={saveTemplate}>
                    {saving
                        ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.4)' }} /> Saving…</>
                        : <>💾 {preview.id ? 'Update Template' : 'Save Template'}</>}
                </button>
            </div>
        </div>
    );
}
