import React from 'react';
import Swal from 'sweetalert2';

const EmailComposeModal = ({
    isOpen, candidateName, candidateEmail, applyPost, roundSelect, interviewDate, modeSelect,
    emailTab, setEmailTab, loadEmailHistory, emailHistory,
    emailTemplates, selectedTemplateId, onTemplateSelect,
    emailTo, setEmailTo,
    senderEmail, setSenderEmail, senderPassword, setSenderPassword,
    showCC, setShowCC, showBCC, setShowBCC,
    emailCC, setEmailCC, emailCCList, setEmailCCList,
    emailBCC, setEmailBCC, emailBCCList, setEmailBCCList,
    emailSubject, setEmailSubject, emailBody, setEmailBody,
    emailSending, emailMessage,
    isPreviewMode, setIsPreviewMode,
    hasDraftAvailable,
    onClose, onSaveDraft, onDiscardDraft, onSendEmail,
}) => {
    if (!isOpen) return null;

    const addCC = () => {
        const e = emailCC.trim();
        if (!e || !e.includes('@')) { Swal.fire({ icon: 'warning', title: 'Invalid', text: 'Enter a valid email.' }); return; }
        if (emailCCList.includes(e)) { Swal.fire({ icon: 'warning', title: 'Duplicate', text: 'Email already added.' }); return; }
        setEmailCCList(l => [...l, e]);
        setEmailCC('');
    };
    const addBCC = () => {
        const e = emailBCC.trim();
        if (!e || !e.includes('@')) { Swal.fire({ icon: 'warning', title: 'Invalid', text: 'Enter a valid email.' }); return; }
        if (emailBCCList.includes(e)) { Swal.fire({ icon: 'warning', title: 'Duplicate', text: 'Email already added.' }); return; }
        setEmailBCCList(l => [...l, e]);
        setEmailBCC('');
    };
    const goPreview = () => {
        if (!emailTo || !emailTo.includes('@')) { Swal.fire({ icon: 'warning', title: 'Invalid Email', text: 'Please provide a valid recipient email.' }); return; }
        if (!emailSubject.trim()) { Swal.fire({ icon: 'warning', title: 'Missing Subject', text: 'Please enter an email subject.' }); return; }
        if (!emailBody.trim()) { Swal.fire({ icon: 'warning', title: 'Empty Body', text: 'Please enter the email body.' }); return; }
        setIsPreviewMode(true);
    };

    return (
        <div className="email-modal-overlay">
            <div className="email-modal" style={{ width: emailTab === 'history' ? 760 : 680, maxWidth: '92vw' }}>

                <div className="email-modal-header">
                    <div className="email-modal-title">
                        <span style={{ fontSize: '1.4rem' }}>📧</span>
                        Email — {candidateName}
                    </div>
                    <button className="email-modal-close" onClick={onClose} disabled={emailSending === 'sending'} style={{ opacity: emailSending === 'sending' ? 0.5 : 1, cursor: emailSending === 'sending' ? 'not-allowed' : 'pointer' }}>✕</button>
                </div>

                <div className="email-modal-body">

                    <div className="em-tabs">
                        <button className={`em-tab${emailTab === 'compose' ? ' active' : ''}`} onClick={() => setEmailTab('compose')}>✉️ Compose</button>
                        <button className={`em-tab${emailTab === 'history' ? ' active' : ''}`} onClick={() => { setEmailTab('history'); loadEmailHistory(); }}>
                            📋 Email History {emailHistory.length > 0 && <span style={{ background: '#4338ca', color: '#fff', borderRadius: 50, padding: '1px 7px', fontSize: '.72rem', marginLeft: 5 }}>{emailHistory.length}</span>}
                        </button>
                    </div>

                    {emailTab === 'compose' && (
                        !isPreviewMode ? (
                            <>
                                <div className="tpl-selector-info">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                        <span style={{ fontSize: '1.1rem' }}>👤</span>
                                        <strong style={{ color: '#1e293b' }}>{candidateName}</strong>
                                        {candidateEmail && <span style={{ color: '#64748b', fontSize: '.83rem' }}>&lt;{candidateEmail}&gt;</span>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {applyPost && <span className="var-chip-small" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Post: {applyPost}</span>}
                                        {roundSelect && <span className="var-chip-small" style={{ background: '#ede9fe', color: '#7c3aed' }}>Round: {roundSelect}</span>}
                                        {interviewDate && <span className="var-chip-small" style={{ background: '#dcfce7', color: '#166534' }}>Date: {interviewDate}</span>}
                                        {modeSelect && <span className="var-chip-small" style={{ background: '#fef3c7', color: '#b45309' }}>Mode: {modeSelect}</span>}
                                    </div>
                                </div>

                                <div className="em-field">
                                    <label className="em-label">📋 Select Email Template</label>
                                    {emailTemplates.length === 0 ? (
                                        <div className="no-tpl-hint">
                                            No templates saved yet.&nbsp;
                                            <a href="/templates" target="_blank" style={{ color: '#4338ca', textDecoration: 'underline' }}>
                                                Create one here →
                                            </a>
                                        </div>
                                    ) : (
                                        <select className="em-select" value={selectedTemplateId} onChange={e => onTemplateSelect(e.target.value)}>
                                            <option value="">— Choose a saved template —</option>
                                            {emailTemplates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="em-field">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label className="em-label" style={{ margin: 0 }}>📨 To (Recipient)</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="button" onClick={() => setShowCC(!showCC)} style={{ background: 'none', border: 'none', color: showCC ? '#4338ca' : '#64748b', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>Cc</button>
                                            <button type="button" onClick={() => setShowBCC(!showBCC)} style={{ background: 'none', border: 'none', color: showBCC ? '#4338ca' : '#64748b', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>Bcc</button>
                                        </div>
                                    </div>
                                    <div className="em-to-badge" style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                                        <span>✉️</span>
                                        <input className="em-input" style={{ background: 'transparent', border: 'none', padding: 0, boxShadow: 'none', fontSize: '.92rem', marginLeft: '8px', flex: 1 }} value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="candidate@email.com" />
                                    </div>
                                </div>

                                <div className="em-field">
                                    <label className="em-label">📤 From (Sender) — company email</label>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <input className="em-input" style={{ flex: 1 }} type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="sender@company.com" />
                                        <input className="em-input" style={{ flex: 1 }} type="password" value={senderPassword} onChange={e => setSenderPassword(e.target.value)} placeholder="Password" />
                                    </div>
                                </div>

                                {showCC && (
                                    <div className="em-field" style={{ animation: 'fadeUp .2s ease both' }}>
                                        <label className="em-label">CC</label>
                                        <div className="cc-chip-wrap">
                                            {emailCCList.map((em, i) => (
                                                <span key={i} className="cc-chip">
                                                    {em}
                                                    <button className="chip-remove" onClick={() => setEmailCCList(l => l.filter((_, j) => j !== i))}>✕</button>
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                            <input className="em-input" style={{ flex: 1 }} value={emailCC} onChange={e => setEmailCC(e.target.value)} placeholder="Add email..." />
                                            <button type="button" className="btn-premium" style={{ padding: '6px 12px', fontSize: '.75rem' }} onClick={addCC}>+ Add</button>
                                        </div>
                                    </div>
                                )}

                                {showBCC && (
                                    <div className="em-field" style={{ animation: 'fadeUp .2s ease both' }}>
                                        <label className="em-label">BCC</label>
                                        <div className="cc-chip-wrap">
                                            {emailBCCList.map((em, i) => (
                                                <span key={i} className="cc-chip">
                                                    {em}
                                                    <button className="chip-remove" onClick={() => setEmailBCCList(l => l.filter((_, j) => j !== i))}>✕</button>
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                            <input className="em-input" style={{ flex: 1 }} value={emailBCC} onChange={e => setEmailBCC(e.target.value)} placeholder="Add email..." />
                                            <button type="button" className="btn-premium" style={{ padding: '6px 12px', fontSize: '.75rem' }} onClick={addBCC}>+ Add</button>
                                        </div>
                                    </div>
                                )}

                                <div className="em-field">
                                    <label className="em-label">🏷️ Subject</label>
                                    <input className="em-input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject line…" />
                                </div>

                                <div className="em-field">
                                    <label className="em-label">📝 Email Body</label>
                                    <textarea className="em-textarea" value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Select a template above, or type your email here…" rows={8} />
                                </div>

                                {emailSending === 'sending' && (
                                    <div className="status-banner sending">
                                        <span className="spinner" style={{ borderTopColor: '#7c3aed', borderColor: 'rgba(124,58,237,.3)' }} />
                                        Sending email via SMTP…
                                    </div>
                                )}
                                {emailSending === 'sent' && <div className="status-banner success">✅ {emailMessage}</div>}
                                {emailSending === 'error' && <div className="status-banner error">❌ {emailMessage}</div>}

                                <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                                    <button className="skip-btn" onClick={onClose} style={{ padding: '13px 18px' }}>↩ Skip</button>
                                    <button className="skip-btn" style={{ background: '#f1f5f9', color: '#1e293b', border: '1.5px solid #cbd5e1', padding: '13px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={onSaveDraft}>💾 Save Draft</button>
                                    {hasDraftAvailable && (
                                        <button className="skip-btn" style={{ background: '#fee2e2', color: '#b91c1c', border: '1.5px solid #fecaca', padding: '13px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={onDiscardDraft}>🗑️ Discard Draft</button>
                                    )}
                                    <button className="send-btn" style={{ marginLeft: 'auto' }} onClick={goPreview}>👁️ Preview Mail</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="gmail-preview-container" style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#fff', padding: '24px', fontFamily: "'Inter', sans-serif" }}>
                                    <h2 style={{ fontSize: '1.4rem', color: '#1e293b', fontWeight: 600, marginTop: 0, marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', fontFamily: "'Outfit', sans-serif" }}>
                                        {emailSubject}
                                    </h2>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ede9fe', color: '#5b21b6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem', border: '1.5px solid #c4b5fd' }}>H</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>APDS HR Team</strong>
                                                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                                                    {new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
                                                <div><span style={{ color: '#94a3b8' }}>from:</span> &lt;hr@apds.com&gt;</div>
                                                <div><span style={{ color: '#94a3b8' }}>to:</span> {emailTo}</div>
                                                {(showCC && (emailCCList.length > 0 || emailCC)) && <div><span style={{ color: '#94a3b8' }}>cc:</span> {emailCCList.join(', ')}{emailCC ? (emailCCList.length > 0 ? ', ' : '') + emailCC : ''}</div>}
                                                {(showBCC && (emailBCCList.length > 0 || emailBCC)) && <div><span style={{ color: '#94a3b8' }}>bcc:</span> {emailBCCList.join(', ')}{emailBCC ? (emailBCCList.length > 0 ? ', ' : '') + emailBCC : ''}</div>}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '20px', minHeight: '200px', color: '#334155', fontSize: '0.92rem', lineHeight: '1.65', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                        {emailBody}
                                    </div>
                                </div>

                                {emailSending === 'sending' && (
                                    <div className="status-banner sending" style={{ marginTop: '16px' }}>
                                        <span className="spinner" style={{ borderTopColor: '#7c3aed', borderColor: 'rgba(124,58,237,.3)' }} />
                                        Sending email via SMTP…
                                    </div>
                                )}
                                {emailSending === 'sent' && <div className="status-banner success" style={{ marginTop: '16px' }}>✅ {emailMessage}</div>}
                                {emailSending === 'error' && <div className="status-banner error" style={{ marginTop: '16px' }}>❌ {emailMessage}</div>}

                                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                                    <button className="skip-btn" onClick={() => setIsPreviewMode(false)} disabled={emailSending === 'sending' || emailSending === 'sent'}>← Back to Edit</button>
                                    <button className="send-btn" onClick={onSendEmail} disabled={emailSending === 'sending' || emailSending === 'sent'}>
                                        {emailSending === 'sending' ? <><span className="spinner" /> Sending…</> : emailSending === 'sent' ? <>✅ Sent!</> : <>✉️ Send Email</>}
                                    </button>
                                </div>
                            </>
                        )
                    )}

                    {emailTab === 'history' && (
                        <div>
                            {emailHistory.length === 0 ? (
                                <div className="hist-empty">📭 No emails sent to this candidate yet.</div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="hist-table">
                                        <thead>
                                            <tr>
                                                <th>Sent At</th><th>To</th><th>Subject</th><th>Template</th>
                                                <th>Job Role</th><th>Round</th><th>Status</th><th>Sent By</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {emailHistory.map(log => (
                                                <tr key={log.id}>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        {log.sent_at ? new Date(log.sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                    <td>{log.to_email}</td>
                                                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.subject}>{log.subject || '—'}</td>
                                                    <td><span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 50, fontSize: '.75rem', fontWeight: 700 }}>{log.template_name || 'Custom'}</span></td>
                                                    <td>{log.job_role || '—'}</td>
                                                    <td>{log.interview_round || '—'}</td>
                                                    <td>
                                                        {log.status === 'sent'
                                                            ? <span className="hist-status-sent">✅ Sent</span>
                                                            : <span className="hist-status-failed" title={log.error_message}>❌ Failed</span>}
                                                    </td>
                                                    <td style={{ fontSize: '.78rem', color: '#64748b' }}>{log.sent_by || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="skip-btn" onClick={onClose}>✕ Close</button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default EmailComposeModal;
