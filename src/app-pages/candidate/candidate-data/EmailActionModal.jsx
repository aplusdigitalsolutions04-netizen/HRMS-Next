import React, { useState, useEffect } from 'react';

const EmailActionModal = ({
    isOpen, candidateName, candidateEmail,
    templates, templateId, templateSubject, templateBody, message, saving,
    onTemplateSelect, onSubjectChange, onBodyChange, onSendNow, onSaveDraft, onRemindLater, onClose,
}) => {
    // Preview shows the mail as the candidate will see it; Edit changes the subject and text before it is saved or sent
    const [view, setView] = useState('');
    useEffect(() => { setView(''); }, [templateId, isOpen]);
    if (!isOpen) return null;
    const isHtml = /<\/?(p|div|br|table|tr|td|ul|ol|li|h[1-6])\b/i.test(templateBody || '');
    const srcDoc = isHtml ? templateBody : `<div style="white-space:pre-line;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">${String(templateBody || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`;
    const tab = (k, label) => <button type="button" className="btn-premium-outline" onClick={() => setView(view === k ? '' : k)} style={{ padding: '6px 14px', fontSize: '.82rem', ...(view === k ? { background: '#eff6ff', borderColor: '#2563eb' } : {}) }}>{label}</button>;
    return (
        <div className="modal-overlay" onClick={() => !saving && onClose()}>
            <div className="modal-glass" style={{ minWidth: 480, width: view ? 'min(760px, 94vw)' : undefined, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginBottom: 8 }}>📧 Email Action</h3>
                <p className="page-subtitle" style={{ marginBottom: 20 }}>Choose how to handle the email for this candidate.</p>

                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 18px', marginBottom: 20, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>{candidateName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{candidateEmail}</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label className="premium-label">Email Template</label>
                    <select className="premium-input" value={templateId} onChange={e => onTemplateSelect(e.target.value)}>
                        <option value="">-- Select Template --</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                {templateId && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        {tab('preview', '👁️ Preview')}
                        {tab('edit', '✏️ Edit')}
                    </div>
                )}

                {templateSubject && view !== 'edit' && (
                    <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '10px 14px', marginBottom: view ? 10 : 20, fontSize: '0.9rem', color: 'var(--primary)' }}>
                        <strong>Subject:</strong> {templateSubject}
                    </div>
                )}

                {view === 'preview' && (
                    <iframe title="Mail preview" sandbox="" srcDoc={srcDoc} style={{ width: '100%', height: 320, border: '1px solid var(--border)', borderRadius: 10, background: '#fff', marginBottom: 20 }} />
                )}

                {view === 'edit' && (
                    <div style={{ marginBottom: 20 }}>
                        <label className="premium-label">Subject</label>
                        <input className="premium-input" value={templateSubject} onChange={e => onSubjectChange(e.target.value)} style={{ marginBottom: 10 }} />
                        <label className="premium-label">Message</label>
                        <textarea className="premium-input" value={templateBody} onChange={e => onBodyChange(e.target.value)} rows={12} style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
                    </div>
                )}

                {message && (
                    <div className="alert-danger" style={{ marginBottom: 16 }}>{message}</div>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn-premium" onClick={onSendNow} style={{ flex: 1, minWidth: 140 }} disabled={!!saving}>
                        📤 Send Now
                    </button>
                    <button className="btn-premium-outline" onClick={onSaveDraft} style={{ flex: 1, minWidth: 140 }} disabled={!!saving}>
                        {saving === 'draft' ? <><span className="spinner-sm" /> Saving...</> : '💾 Save as Draft'}
                    </button>
                    <button className="btn-premium-outline" onClick={onRemindLater} style={{ flex: 1, minWidth: 140, borderColor: '#f59e0b', color: '#d97706' }} disabled={!!saving}>
                        {saving === 'remind' ? <><span className="spinner-sm" /> Saving...</> : '⏰ Remind Me Later'}
                    </button>
                </div>

                <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <button className="btn-premium-outline" onClick={onClose} disabled={!!saving} style={{ border: 'none', color: 'var(--text-muted)' }}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default EmailActionModal;
