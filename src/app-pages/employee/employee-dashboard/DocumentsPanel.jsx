import React from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const allDocTypes = [
  { key: 'IdentityProof', label: 'Identity Proof' },
  { key: 'AddressProof', label: 'Address Proof' },
  { key: 'Resume', label: 'Resume' },
  { key: 'Marksheet10', label: '10th Marksheet' },
  { key: 'Marksheet12', label: '12th Marksheet' },
  { key: 'UGDegree', label: 'UG Degree' },
  { key: 'PGDegree', label: 'PG Degree' },
  { key: 'OfferLetter', label: 'Offer Letter' },
  { key: 'AppointmentLetter', label: 'Appointment Letter' },
  { key: 'InternshipCertificate', label: 'Internship Certificate' },
  { key: 'Photograph', label: 'Photograph' },
];

export default function DocumentsPanel({ documents, uploadingDoc, handleUploadDoc, handleMultiUploadDoc, uploadMsg, uploadError }) {
  const additionalDocs = documents.filter(d => d.document_type === 'Additional');
  const uploadingAdditional = uploadingDoc === 'Additional';
  return (
    <div className="emp-card">
      <div className="emp-card-header">
        <h3>My Documents</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {allDocTypes.map(({ key, label }) => {
          const doc = documents.find(d => d.document_type === key);
          const uploading = uploadingDoc === key;
          const isPending = doc?.status === 'pending';
          const uploadThis = (e) => handleUploadDoc(key, e);
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>
                    {label}
                    {isPending && <span style={{ marginLeft: 8, fontSize: 11, background: '#fffbeb', color: '#d97706', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Pending Approval</span>}
                  </div>
                  {doc && doc.file_path ? (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {doc.document_name || doc.file_path?.split('/').pop()}
                      {doc.uploaded_at ? ` · ${new Date(doc.uploaded_at).toLocaleDateString('en-IN')}` : ''}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{isPending ? 'Awaiting HR approval' : 'No document uploaded'}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {doc && doc.file_path && (
                  <span onClick={async () => {
                    const r = await fetch(`/api/documents/${doc.id}/serve`, { headers: auth() });
                    if (!r.ok) { alert('Failed to load document'); return; }
                    const blob = await r.blob();
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                  }} style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer' }}>View</span>
                )}
                <label style={{ fontSize: 12, fontWeight: 500, cursor: isPending ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', padding: '4px 10px', borderRadius: 6, border: '1px solid', background: isPending ? '#f1f5f9' : '#fff', color: isPending ? '#94a3b8' : '#6366f1', borderColor: isPending ? '#e2e8f0' : '#6366f1' }}>
                  {uploading ? 'Uploading...' : isPending ? 'Pending' : doc ? 'Replace' : 'Upload'}
                  {!isPending && <input type="file" style={{ display: 'none' }} onChange={uploadThis} disabled={uploadingDoc !== null} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />}
                </label>
              </div>
            </div>
          );
        })}
        {uploadMsg && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: uploadError ? '#fef2f2' : '#f0fdf4', border: `1px solid ${uploadError ? '#fecaca' : '#bbf7d0'}`, color: uploadError ? '#dc2626' : '#16a34a', fontSize: 13, textAlign: 'center' }}>
            {uploadMsg}
          </div>
        )}

        <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: '#334155', margin: 0 }}>Additional Documents</h4>
            <label style={{ fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {uploadingAdditional ? 'Uploading...' : 'Upload Multiple'}
              <input type="file" style={{ display: 'none' }} multiple onChange={handleMultiUploadDoc} disabled={uploadingDoc !== null} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
            </label>
          </div>
          
          {additionalDocs.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No additional documents uploaded.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {additionalDocs.map(doc => (
                <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.document_name || doc.file_path?.split('/').pop()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                    {doc.status === 'pending' ? (
                      <span style={{ fontSize: 10, background: '#fffbeb', color: '#d97706', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>Pending</span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>Approved</span>
                    )}
                    <span onClick={async () => {
                      const r = await fetch(`/api/documents/${doc.id}/serve`, { headers: auth() });
                      if (!r.ok) { alert('Failed to load document'); return; }
                      const blob = await r.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                    }} style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', fontWeight: 600, cursor: 'pointer' }}>View</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { allDocTypes };
