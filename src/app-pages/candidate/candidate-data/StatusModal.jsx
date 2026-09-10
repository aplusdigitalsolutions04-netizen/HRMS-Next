import React from 'react';

const StatusModal = ({ isOpen, remarks, comments, onRemarksChange, onCommentsChange, onSave, onCancel }) => (
    <div className="modal" style={{ display: isOpen ? 'flex' : 'none' }}>
        <div className="modal-content small">
            <h3>Update Status</h3>
            <div className="full-width">
                <label>Remarks</label>
                <textarea rows="2" value={remarks} onChange={e => onRemarksChange(e.target.value)} />
            </div>
            <div className="full-width">
                <label>Comments</label>
                <textarea rows="3" value={comments} onChange={e => onCommentsChange(e.target.value)} />
            </div>
            <div className="modal-actions right">
                <button className="btn medium" onClick={onSave}>Save</button>
                <button className="btn medium" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    </div>
);

export default StatusModal;
