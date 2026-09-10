import React from 'react';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const STATUS_BADGE = {
    no_email: { bg: '#f1f5f9', c: '#64748b', l: 'No Email' },
    draft_saved: { bg: '#dbeafe', c: '#1d4ed8', l: 'Draft' },
    reminder_active: { bg: '#fef3c7', c: '#92400e', l: 'Reminder' },
    overdue: { bg: '#fee2e2', c: '#991b1b', l: 'Overdue' },
    email_sent: { bg: '#dcfce7', c: '#166534', l: 'Sent' },
};

/* ── Email Action Modal opened from the Candidate Pool's 📧 button ── */
const CandidateEmailActionModal = ({
    candidateId, candidateName, candidateEmail,
    status, setStatus,
    templates, templateId, templateSubject,
    senderEmail, setSenderEmail, senderPassword, setSenderPassword,
    saving,
    onTemplateSelect, onSend, onSaveDraft, onCreateReminder, onClose,
}) => {
    if (!status) return null;
    const badge = STATUS_BADGE[status.status] || STATUS_BADGE.no_email;

    const deleteDraft = async () => {
        try {
            await fetch(`${API}/email/draft/${candidateId}`, { method: 'DELETE', headers: auth() });
            Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
            onClose();
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message });
        }
    };

    const editDraft = () => {
        onTemplateSelect(status.draft.template_id || '', status.draft.subject || '');
        setStatus(prev => ({ ...prev, status: 'no_email' }));
    };

    const pauseReminder = async () => {
        try {
            const r = await fetch(`${API}/reminders/${status.reminder.id}`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PAUSED' }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.detail || 'Failed');
            setStatus(prev => ({ ...prev, status: 'draft_saved' }));
            Swal.fire({ icon: 'success', title: 'Paused!', timer: 1500, showConfirmButton: false });
        } catch (e) { Swal.fire({ icon: 'error', text: e.message }); }
    };

    const cancelReminder = async () => {
        try {
            const r = await fetch(`${API}/reminders/${status.reminder.id}`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.detail || 'Failed');
            setStatus(prev => ({ ...prev, status: 'draft_saved' }));
            Swal.fire({ icon: 'success', title: 'Cancelled!', timer: 1500, showConfirmButton: false });
        } catch (e) { Swal.fire({ icon: 'error', text: e.message }); }
    };

    const rescheduleReminder = async () => {
        try {
            const settings = await (await fetch(`${API}/settings/system`, { headers: auth() })).json();
            const dm = parseInt(settings.default_reminder_delay || '30', 10);
            const rt = new Date(Date.now() + dm * 60000).toISOString();
            const r = await fetch(`${API}/reminders/${status.reminder.id}`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ACTIVE', reminder_time: rt, custom_delay: dm }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.detail || 'Failed');
            setStatus(prev => ({ ...prev, status: 'reminder_active', reminder: { ...prev.reminder, status: 'ACTIVE', reminder_time: rt } }));
            Swal.fire({ icon: 'success', title: 'Rescheduled!', timer: 1500, showConfirmButton: false });
        } catch (e) { Swal.fire({ icon: 'error', text: e.message }); }
    };

    return (
        <div className="email-modal-overlay" onClick={() => !saving && onClose()}>
            <div className="email-modal" onClick={e => e.stopPropagation()} style={{ width: 580 }}>
                <div className="email-modal-header">
                    <div className="email-modal-title">📧 Email — {candidateName}</div>
                    <button className="email-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="email-modal-body">
                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', marginBottom: 16, border: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><strong style={{ fontSize: '.95rem' }}>{candidateName}</strong><br /><span style={{ color: '#64748b', fontSize: '.85rem' }}>{candidateEmail}</span></div>
                        <div><span style={{ background: badge.bg, color: badge.c, padding: '3px 12px', borderRadius: 50, fontWeight: 700, fontSize: '.75rem' }}>{badge.l}</span></div>
                    </div>

                    {status.status === 'email_sent' && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#166534', marginBottom: 6 }}>Email Already Sent</div>
                            <div style={{ color: '#64748b', fontSize: '.85rem', marginBottom: 20 }}>
                                {status.email_log?.subject && <>Subject: {status.email_log.subject}<br /></>}
                                {status.email_log?.sent_at && <>Sent: {new Date(status.email_log.sent_at).toLocaleString()}</>}
                            </div>
                            <button className="btn-premium-outline" onClick={onClose}>Close</button>
                        </div>
                    )}

                    {status.status === 'no_email' && (
                        <>
                            <div className="em-field">
                                <label className="em-label">📋 Email Template</label>
                                <select className="em-select" value={templateId} onChange={e => onTemplateSelect(e.target.value)}>
                                    <option value="">-- Select Template --</option>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            {templateSubject && <div style={{ background: '#eef2ff', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '.85rem', color: '#4338ca', fontWeight: 600 }}>Subject: {templateSubject}</div>}
                            <div style={{ marginBottom: 16 }}>
                                <label className="em-label" style={{ marginBottom: 6, fontSize: '.72rem' }}>📤 From (Sender) — company email</label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input className="em-input" style={{ flex: 1, fontSize: '.82rem', padding: '8px 10px' }} type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="sender@company.com" />
                                    <input className="em-input" style={{ flex: 1, fontSize: '.82rem', padding: '8px 10px' }} type="password" value={senderPassword} onChange={e => setSenderPassword(e.target.value)} placeholder="Password" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <button className="btn-premium" onClick={() => onSend({})} disabled={!!saving} style={{ flex: 1, minWidth: 130, padding: '12px 20px' }}>{saving === 'sending' ? 'Sending...' : '📤 Send Now'}</button>
                                <button className="btn-premium-outline" onClick={onSaveDraft} disabled={!!saving} style={{ flex: 1, minWidth: 130, padding: '12px 20px' }}>{saving === 'draft' ? 'Saving...' : '💾 Save Draft'}</button>
                                <button className="btn-premium-outline" onClick={onCreateReminder} disabled={!!saving} style={{ flex: 1, minWidth: 130, padding: '12px 20px', borderColor: '#f59e0b', color: '#d97706' }}>{saving === 'remind' ? 'Saving...' : '⏰ Remind Me Later'}</button>
                            </div>
                        </>
                    )}

                    {status.status === 'draft_saved' && status.draft && (
                        <>
                            <div style={{ background: '#eef2ff', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                                <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Template</div>
                                <div style={{ fontSize: '.88rem', fontWeight: 600 }}>{status.draft.template_name || '—'}</div>
                                <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 10, marginBottom: 4 }}>Subject</div>
                                <div style={{ fontSize: '.85rem' }}>{status.draft.subject || '—'}</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 16, border: '1.5px solid #e2e8f0', maxHeight: 180, overflowY: 'auto', fontSize: '.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{status.draft.body || '—'}</div>
                            {status.draft.last_saved_at && <div style={{ fontSize: '.78rem', color: '#94a3b8', marginBottom: 16 }}>Last saved: {new Date(status.draft.last_saved_at).toLocaleString()}</div>}
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <button className="btn-premium" onClick={() => onSend(status)} disabled={!!saving} style={{ flex: 1, padding: '12px 20px' }}>{saving === 'sending' ? 'Sending...' : '📤 Send Email'}</button>
                                <button className="btn-premium-outline" onClick={editDraft} disabled={!!saving} style={{ flex: 1, padding: '12px 20px' }}>✏️ Edit Draft</button>
                                <button className="btn-premium-outline" onClick={deleteDraft} style={{ flex: 1, padding: '12px 20px', borderColor: '#ef4444', color: '#dc2626' }}>🗑 Delete Draft</button>
                            </div>
                        </>
                    )}

                    {status.status === 'reminder_active' && status.reminder && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div style={{ background: '#fffbeb', borderRadius: 10, padding: '10px 14px', border: '1.5px solid #fde68a' }}>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.5px' }}>Status</div>
                                    <div style={{ fontWeight: 700, color: '#d97706', fontSize: '.9rem' }}>⏰ Reminder Active</div>
                                </div>
                                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', border: '1.5px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px' }}>Due Time</div>
                                    <div style={{ fontWeight: 600, fontSize: '.82rem' }}>{status.reminder.reminder_time ? new Date(status.reminder.reminder_time).toLocaleString() : '—'}</div>
                                </div>
                            </div>
                            {status.draft && (
                                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', marginBottom: 16, border: '1.5px solid #e2e8f0', maxHeight: 120, overflowY: 'auto', fontSize: '.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{status.draft.body || '—'}</div>
                            )}
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <button className="btn-premium" onClick={() => onSend(status)} disabled={!!saving} style={{ flex: 1, padding: '12px 20px' }}>{saving === 'sending' ? 'Sending...' : '📤 Send Now'}</button>
                                <button className="btn-premium-outline" onClick={pauseReminder} disabled={!!saving} style={{ flex: 1, padding: '12px 20px', borderColor: '#f59e0b', color: '#d97706' }}>⏸ Pause Reminder</button>
                                <button className="btn-premium-outline" onClick={cancelReminder} style={{ flex: 1, padding: '12px 20px', borderColor: '#ef4444', color: '#dc2626' }}>🗑 Cancel Reminder</button>
                            </div>
                        </>
                    )}

                    {status.status === 'overdue' && status.reminder && (
                        <>
                            <div style={{ background: '#fef2f2', borderRadius: 12, padding: '14px 18px', marginBottom: 16, border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontSize: '2rem' }}>🔴</div>
                                <div>
                                    <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '1rem' }}>Reminder Overdue</div>
                                    <div style={{ color: '#b91c1c', fontSize: '.82rem' }}>Overdue since {status.reminder.reminder_time ? new Date(status.reminder.reminder_time).toLocaleString() : '—'}</div>
                                </div>
                            </div>
                            {status.draft && (
                                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', marginBottom: 16, border: '1.5px solid #e2e8f0', maxHeight: 140, overflowY: 'auto', fontSize: '.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{status.draft.body || '—'}</div>
                            )}
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <button className="btn-premium" onClick={() => onSend(status)} disabled={!!saving} style={{ flex: 1, padding: '12px 20px', background: 'linear-gradient(135deg,#dc2626,#ef4444)' }}>{saving === 'sending' ? 'Sending...' : '📤 Send Now'}</button>
                                <button className="btn-premium-outline" onClick={rescheduleReminder} disabled={!!saving} style={{ flex: 1, padding: '12px 20px', borderColor: '#f59e0b', color: '#d97706' }}>🔄 Reschedule</button>
                                <button className="btn-premium-outline" onClick={cancelReminder} style={{ flex: 1, padding: '12px 20px', borderColor: '#ef4444', color: '#dc2626' }}>🗑 Cancel</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CandidateEmailActionModal;
