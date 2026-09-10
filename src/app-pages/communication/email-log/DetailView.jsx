import React from 'react';
import StatusBadge from './StatusBadge';
import { formatEmailBody, formatDT, formatDate } from './helpers';

export default function DetailView({ viewing, setViewing }) {
    return (
        <div className="el-view-page">
            <button className="el-view-back" onClick={() => setViewing(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Email Log
            </button>
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, paddingBottom:16, borderBottom:'1px solid #f1f5f9' }}>
                    <h3 style={{ margin:0, fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.15rem', color:'#0f172a' }}>Email Details</h3>
                    <StatusBadge status={viewing.status} />
                </div>
                <div className="el-view-grid">
                    <div className="el-view-field">
                        <div className="el-view-field-label">To</div>
                        <div className="el-view-field-value email">{viewing.to_email}</div>
                    </div>
                    {viewing.cc && (
                        <div className="el-view-field">
                            <div className="el-view-field-label">CC</div>
                            <div className="el-view-field-value">{viewing.cc}</div>
                        </div>
                    )}
                    {viewing.bcc && (
                        <div className="el-view-field">
                            <div className="el-view-field-label">BCC</div>
                            <div className="el-view-field-value">{viewing.bcc}</div>
                        </div>
                    )}
                    <div className="el-view-field">
                        <div className="el-view-field-label">Sent By</div>
                        <div className="el-view-field-value">{viewing.sent_by || '—'}</div>
                    </div>
                    {viewing.job_role && (
                        <div className="el-view-field">
                            <div className="el-view-field-label">Job Role</div>
                            <div className="el-view-field-value">{viewing.job_role}</div>
                        </div>
                    )}
                    <div className="el-view-field">
                        <div className="el-view-field-label">Candidate</div>
                        <div className="el-view-field-value">{viewing.candidate_name || '—'}</div>
                    </div>
                    <div className="el-view-field">
                        <div className="el-view-field-label">Sent At</div>
                        <div className="el-view-field-value">{formatDT(viewing.sent_at)}</div>
                    </div>
                    <div className="el-view-field">
                        <div className="el-view-field-label">Interview Date</div>
                        <div className="el-view-field-value">{formatDate(viewing.interview_date)}</div>
                    </div>
                    {viewing.error_message && (
                        <div className="el-view-field full">
                            <div className="el-view-field-label">Error</div>
                            <div className="el-view-field-value" style={{ color:'#ef4444' }}>{viewing.error_message}</div>
                        </div>
                    )}
                    <div className="el-view-field full">
                        <div className="el-view-field-label">Subject</div>
                        <div className="el-view-field-value" style={{ fontWeight:600 }}>{viewing.subject || '—'}</div>
                    </div>
                </div>
                <div className="el-view-field-label" style={{ marginBottom:8 }}>Body</div>
                <div className="el-view-body-box" dangerouslySetInnerHTML={{ __html: formatEmailBody(viewing.body) }} />
            </div>
        </div>
    );
}
