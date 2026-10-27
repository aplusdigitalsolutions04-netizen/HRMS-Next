import React from 'react';

const InterviewModal = ({
    isOpen, candidateName, formError,
    applyPost, applyPosts, roundSelect, interviewDate, modeSelect,
    onApplyPostChange, onRoundChange, onDateChange, onModeChange,
    previousInterviews, currentInterviewId, onPrevStatusChange,
    onSave, onCancel,
}) => (
    <div className="modal" style={{ display: isOpen ? 'flex' : 'none' }}>
        <div className="modal-content full">
            <h3 className="modal-title" style={{ marginBottom: 16 }}>
                📋 Interview Details —&nbsp;
                <span style={{ color: '#1e40af' }}>{candidateName}</span>
            </h3>
            {formError && (
                <div style={{ color: '#e53935', fontWeight: 500, marginBottom: 10 }}>{formError}</div>
            )}
            <div className="form-grid">
                <div>
                    <label>Apply Post</label>
                    <select value={applyPost} onChange={e => onApplyPostChange(e.target.value)}>
                        <option value="">Select Apply Post</option>
                        {applyPosts.map((p, i) => {
                            const label = typeof p === 'string' ? p : (p.title || p.name || '');
                            return <option key={label || i} value={label}>{label}</option>;
                        })}
                    </select>
                </div>
                <div>
                    <label>Interview Round</label>
                    <select value={roundSelect} onChange={e => onRoundChange(e.target.value)}>
                        <option value="">Select Round</option>
                        <option>First Call</option>
                        <option>Second Round</option>
                        <option>Third Round</option>
                        <option>Final Round</option>
                    </select>
                </div>
                <div>
                    <label>Interview Date</label>
                    <input type="date" value={interviewDate} onChange={e => onDateChange(e.target.value)} />
                </div>
                <div>
                    <label>Interview Mode</label>
                    <select value={modeSelect} onChange={e => onModeChange(e.target.value)}>
                        <option value="">Select</option>
                        <option>Online</option>
                        <option>Offline</option>
                        <option>Telephonic</option>
                    </select>
                </div>
            </div>

            <div className="modal-actions right">
                <button className="btn btn-save" onClick={onSave}>💾 Save Interview</button>
                <button className="btn btn-cancel" onClick={onCancel}>Cancel</button>
            </div>
            <hr />
            {(
                <div>
                    <h4 style={{ marginBottom: 10 }}>Interview History <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 13 }}>({previousInterviews.length} {previousInterviews.length === 1 ? 'round' : 'rounds'})</span></h4>
                    {previousInterviews.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, padding: '6px 0' }}>No interview rounds yet. Fill the details above and save to start the history.</div>}
                    {previousInterviews.length > 0 && (
                    <table>
                        <thead>
                            <tr><th>Round</th><th>Apply Post</th><th>Date</th><th>Mode</th><th style={{ minWidth: 150 }}>Status</th><th>Remarks</th><th>Comments</th></tr>
                        </thead>
                        <tbody>
                            {[...previousInterviews].reverse().map((r, idx) => (
                                <tr key={r.id || idx} style={r.id && r.id === currentInterviewId ? { background: '#eff6ff' } : undefined}>
                                    <td>{r.interview_round}{r.id && r.id === currentInterviewId && <span style={{ marginLeft: 6, fontSize: 10.5, background: '#2563eb', color: '#fff', borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>Latest</span>}</td>
                                    <td>{r.apply_post || '-'}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{r.interview_date?.split('T')[0] || ''}</td>
                                    <td>{r.interview_mode}</td>
                                    <td style={{ minWidth: 150 }}>
                                        <select key={`${r.id}-${r.status}`} defaultValue={r.status} style={{ width: 'auto', minWidth: 130, padding: '8px 28px 8px 10px' }} onChange={e => onPrevStatusChange(r.id, e.target.value)}>
                                            <option value="Scheduled">Scheduled</option>
                                            <option value="Completed">Completed</option>
                                            <option value="On Hold">On Hold</option>
                                            <option value="Rejected">Rejected</option>
                                        </select>
                                    </td>
                                    <td style={{ minWidth: 200, whiteSpace: 'pre-wrap' }}>{r.remarks || '-'}</td>
                                    <td style={{ minWidth: 200, whiteSpace: 'pre-wrap' }}>{r.comments || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    )}
                </div>
            )}
        </div>
    </div>
);

export default InterviewModal;
