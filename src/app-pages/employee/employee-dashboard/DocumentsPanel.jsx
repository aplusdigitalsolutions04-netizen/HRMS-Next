import React from 'react';
import { previewDocumentUrl } from '@/lib/clientDocs';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

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

const open = async (url) => {
  const r = await fetch(url, { headers: auth() });
  if (!r.ok) {
    let msg = 'Failed to load document';
    try { msg = (await r.json()).detail || msg; } catch { /* not json */ }
    alert(msg);
    return;
  }
  const blob = await r.blob();
  const u = URL.createObjectURL(blob);
  window.open(u, '_blank');
  setTimeout(() => URL.revokeObjectURL(u), 60000);
};
const pill = (text, bg, color) => <span style={{ marginLeft: 8, fontSize: 11, background: bg, color, padding: '2px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{text}</span>;
const btn = { fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', padding: '4px 10px', borderRadius: 6, border: '1px solid' };

// The employee can view what is uploaded. Uploading (a new document or a new copy) is only possible after HR allows it;
// until then a document shows only View. When HR allows it, an Upload button appears.
export default function DocumentsPanel({ documents, slots = [], onboarding = [], uploadingDoc, handleUploadDoc, handleMultiUploadDoc, onRequestReupload, uploadMsg, uploadError }) {
  const additionalDocs = documents.filter(d => d.document_type === 'Additional');
  const uploadingAdditional = uploadingDoc === 'Additional';
  const addPerm = (slots.find(s => s.key === 'Additional') || {}).permission || 'none';
  return (
    <div className="emp-card">
      <div className="emp-card-header">
        <h3>My Documents</h3>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>You can view your documents here. An Upload button appears for a document when HR allows you to upload it.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {allDocTypes.map(({ key, label }) => {
          const doc = documents.find(d => d.document_type === key && d.status !== 'denied');
          const fromOnboarding = onboarding.some(o => o.document_type === key);
          const slot = slots.find(s => s.key === key);
          const perm = slot ? slot.permission : 'none';
          const filled = slot ? slot.filled : !!doc || fromOnboarding;
          const isPending = !!(slot ? slot.waiting : doc && doc.status === 'pending');
          const locked = perm !== 'granted' && !isPending;
          const uploading = uploadingDoc === key;
          const canView = (doc && doc.file_path) || fromOnboarding;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>
                    {label}
                    {isPending && pill('Pending Approval', '#fffbeb', '#d97706')}
                    {!isPending && perm === 'granted' && pill('HR allowed you to upload again', '#f0fdf4', '#15803d')}
                    {locked && perm === 'none' && filled && pill('Uploaded', '#f1f5f9', '#475569')}
                  </div>
                  {doc && doc.file_path ? (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {doc.document_name || doc.file_path?.split('/').pop()}
                      {doc.uploaded_at ? ` · ${new Date(doc.uploaded_at).toLocaleDateString('en-IN')}` : ''}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{isPending ? 'Awaiting HR approval' : fromOnboarding ? 'Uploaded with your profile' : 'No document uploaded'}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {canView && (
                  <>
                    <span onClick={() => previewDocumentUrl(doc && doc.file_path ? `${API}/documents/${doc.id}/serve` : `${API}/my-documents/file?type=${key}`, label)} style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer' }}>Preview</span>
                    <span onClick={() => open(doc && doc.file_path ? `${API}/documents/${doc.id}/serve` : `${API}/my-documents/file?type=${key}`)} style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer' }}>View</span>
                  </>
                )}
                {isPending ? (
                  <span style={{ ...btn, color: '#94a3b8', borderColor: '#e2e8f0', background: '#f1f5f9', cursor: 'not-allowed' }}>Pending</span>
                ) : locked ? null : (
                  <label style={{ ...btn, cursor: uploadingDoc !== null ? 'not-allowed' : 'pointer', color: '#fff', borderColor: '#2563eb', background: '#2563eb' }}>
                    {uploading ? 'Uploading...' : filled ? 'Upload new file' : 'Upload'}
                    <input type="file" style={{ display: 'none' }} onChange={(e) => handleUploadDoc(key, e)} disabled={uploadingDoc !== null} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                  </label>
                )}
              </div>
            </div>
          );
        })}
        {uploadMsg && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: uploadError ? '#fef2f2' : '#f0fdf4', border: `1px solid ${uploadError ? '#fecaca' : '#bbf7d0'}`, color: uploadError ? '#dc2626' : '#16a34a', fontSize: 13 }}>
            {uploadMsg}
          </div>
        )}

        <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: '#334155', margin: 0 }}>Additional Documents</h4>
            {addPerm === 'granted' ? (
              <label style={{ fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {uploadingAdditional ? 'Uploading...' : 'Upload Multiple'}
                <input type="file" style={{ display: 'none' }} multiple onChange={handleMultiUploadDoc} disabled={uploadingDoc !== null} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
              </label>
            ) : null}
          </div>

          {additionalDocs.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No additional documents uploaded.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {additionalDocs.map(doc => (
                <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
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
                    <span style={{ display: 'flex', gap: 10 }}>
                      <span onClick={() => previewDocumentUrl(`${API}/documents/${doc.id}/serve`, doc.document_name || 'Document')} style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>Preview</span>
  <span onClick={() => open(`${API}/documents/${doc.id}/serve`)} style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>View</span>
                    </span>
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
