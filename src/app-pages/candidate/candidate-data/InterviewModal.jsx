import React from 'react';

const InterviewModal = ({
    isOpen, candidateName, formError,
    applyPost, applyPosts, roundSelect, interviewDate, modeSelect,
    onApplyPostChange, onRoundChange, onDateChange, onModeChange,
    previousInterviews, onPrevStatusChange,
    onSave, onCancel,
}) => (
    <div className="modal" style={{ display: isOpen ? 'flex' : 'none' }}>
        <div className="modal-content">
            <h3 className="modal-title" style={{ marginBottom: 16 }}>
                📋 Interview Details —&nbsp;
                <span style={{ color: '#4338ca' }}>{candidateName}</span>
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
            {previousInterviews.length > 0 && (
                <div>
                    <h4 style={{ marginBottom: 10 }}>Previous Interview Records</h4>
                    <table>
                        <thead>
                            <tr><th>Round</th><th>Date</th><th>Mode</th><th>Status</th><th>Remarks</th><th>Comments</th></tr>
                        </thead>
                        <tbody>
                            {previousInterviews.map((r, idx) => (
                                <tr key={idx}>
                                    <td>{r.interview_round}</td>
                                    <td>{r.interview_date?.split('T')[0] || ''}</td>
                                    <td>{r.interview_mode}</td>
                                    <td>
                                        <select defaultValue={r.status} onChange={e => onPrevStatusChange(r.id, e.target.value)}>
                                            <option value="Scheduled">Scheduled</option>
                                            <option value="Completed">Completed</option>
                                            <option value="On Hold">On Hold</option>
                                            <option value="Rejected">Rejected</option>
                                        </select>
                                    </td>
                                    <td>{r.remarks || '-'}</td>
                                    <td>{r.comments || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
);

export default InterviewModal;
