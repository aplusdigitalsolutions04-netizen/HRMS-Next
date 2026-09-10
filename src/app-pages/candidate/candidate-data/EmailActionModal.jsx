import React from 'react';

const EmailActionModal = ({
    isOpen, candidateName, candidateEmail,
    templates, templateId, templateSubject, message, saving,
    onTemplateSelect, onSendNow, onSaveDraft, onRemindLater, onClose,
}) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={() => !saving && onClose()}>
            <div className="modal-glass" style={{ minWidth: 480 }} onClick={e => e.stopPropagation()}>
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

                {templateSubject && (
                    <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: '0.9rem', color: 'var(--primary)' }}>
                        <strong>Subject:</strong> {templateSubject}
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
