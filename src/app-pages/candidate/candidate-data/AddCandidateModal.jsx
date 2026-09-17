import React, { useRef, useState } from 'react';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const MOBILE_PATTERN = /^[6-9]\d{9}$/;

/* ── self-contained "Add Candidate" wizard: mobile check → resume parse → save ── */
const AddCandidateModal = ({ isOpen, onClose, onSaved }) => {
    const [mobile, setMobile] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [rawData, setRawData] = useState(null);
    const [resumeDisabled, setResumeDisabled] = useState(true);
    const [uploadDisabled, setUploadDisabled] = useState(true);
    const [getDisabled, setGetDisabled] = useState(true);
    const [saveDisabled, setSaveDisabled] = useState(true);
    const [showInfo, setShowInfo] = useState(false);
    const [loader, setLoader] = useState(false);
    const debounceRef = useRef(null);

    const resetForm = () => {
        setMobile(''); setResumeFile(null); setResumeDisabled(true);
        setShowInfo(false); setRawData(null);
        setUploadDisabled(true); setGetDisabled(true); setSaveDisabled(true);
    };

    const close = () => { if (!loader) { resetForm(); onClose(); } };

    const handleMobileChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setMobile(val); setShowInfo(false); setRawData(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (val.length !== 10 || !MOBILE_PATTERN.test(val)) {
            setResumeDisabled(true); setUploadDisabled(true); setGetDisabled(true); setSaveDisabled(true);
            return;
        }
        debounceRef.current = setTimeout(() => {
            fetch(`${API}/candidate/check?mobile=${encodeURIComponent(val)}`, { headers: auth() })
                .then(r => r.json()).then(res => {
                    if (res.exists && res.data) {
                        Swal.fire('Duplicate Found', 'This Mobile already exists!', 'warning');
                        setRawData(res.data); setResumeDisabled(true); setUploadDisabled(true); setGetDisabled(false); setSaveDisabled(true);
                    } else {
                        Swal.fire('New Candidate', 'Please upload resume', 'info');
                        setRawData(null); setResumeDisabled(false); setUploadDisabled(false); setGetDisabled(true); setSaveDisabled(true);
                    }
                }).catch(() => Swal.fire('Server error'));
        }, 400);
    };

    const handleGetDetails = () => {
        if (!rawData) { Swal.fire('No candidate found'); return; }
        setShowInfo(true); setUploadDisabled(true); setGetDisabled(true); setSaveDisabled(true);
    };

    const handleUploadParse = () => {
        if (!resumeFile || !mobile) { Swal.fire('Upload resume & enter mobile'); return; }
        const fd = new FormData();
        fd.append('resume', resumeFile);
        fd.append('mobileNumber', mobile);
        setLoader(true);
        fetch(`${API}/resume/parse`, { method: 'POST', headers: auth(), body: fd })
            .then(r => r.json()).then(res => {
                setLoader(false);
                if (res.success && res.data) {
                    setRawData(res.data); setShowInfo(true);
                    setUploadDisabled(true); setGetDisabled(true); setSaveDisabled(false);
                } else if (!res.success && res.data) {
                    Swal.fire('Duplicate Found', res.message || 'Duplicate record found', 'warning');
                    setRawData(res.data); setResumeDisabled(true); setUploadDisabled(true); setGetDisabled(false); setSaveDisabled(true);
                } else {
                    Swal.fire(res.message || 'Resume parsing failed');
                }
            }).catch(() => { setLoader(false); Swal.fire('Upload failed'); });
    };

    const handleViewResume = () => {
        if (!rawData?.resume_pdf_path) { Swal.fire('Resume not available'); return; }
        window.open('/' + rawData.resume_pdf_path, '_blank');
    };

    const handleSave = () => {
        if (!rawData) return;
        setLoader(true);
        const payload = { ...rawData };
        if (!payload.email_id || payload.email_id.toLowerCase() === 'n/a' || !payload.email_id.includes('@')) payload.email_id = null;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!payload.date_of_birth || !dateRegex.test(payload.date_of_birth)) payload.date_of_birth = null;
        fetch(`${API}/candidate/save`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(payload) })
            .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail ? (Array.isArray(d.detail) ? d.detail[0].msg : d.detail) : (d.message || 'Save failed')); return d; })
            .then(r => {
                setLoader(false);
                if (r.success) {
                    Swal.fire('Success', 'Candidate saved successfully', 'success').then(() => {
                        resetForm(); onClose(); onSaved();
                    });
                } else {
                    Swal.fire('Error', r.message || 'Unknown error', 'error');
                }
            }).catch(err => { setLoader(false); Swal.fire('Error', err.message || 'Save failed', 'error'); });
    };

    return (
        <>
            {isOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }} onClick={close} />
                <div style={{ position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 20, padding: 28, width: '90%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto', zIndex: 1001, boxShadow: '0 25px 80px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Add New Candidate</h4>
                    <button onClick={close} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#64748b' }}>&times;</button>
                  </div>

                  <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>Mobile Number</label>
                      <input type="text" placeholder="Enter 10-digit mobile number" maxLength="10" autoComplete="off"
                        value={mobile} onChange={handleMobileChange}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none' }} />
                    </div>
                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>Upload Resume (PDF only)</label>
                      <input type="file" accept="application/pdf"
                        onChange={(e) => { setResumeFile(e.target.files[0]); if (mobile.length === 10) setUploadDisabled(false); }}
                        style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      <button onClick={handleGetDetails} disabled={getDisabled}
                        style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: getDisabled ? '#f1f5f9' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: getDisabled ? '#94a3b8' : '#fff', fontSize: 13, fontWeight: 600, cursor: getDisabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                        Get Details
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <button onClick={handleUploadParse} disabled={uploadDisabled}
                      style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: uploadDisabled ? '#f1f5f9' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: uploadDisabled ? '#94a3b8' : '#fff', fontSize: 14, fontWeight: 600, cursor: uploadDisabled ? 'not-allowed' : 'pointer' }}>
                      Upload &amp; Parse Resume
                    </button>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0 0 20px' }} />

                  <div style={{ display: showInfo ? 'block' : 'none' }}>
                    <h5 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Extracted Candidate Information</h5>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <tbody>
                          {[
                            ['Candidate Name', rawData?.candidate_name, 'Mobile Number', rawData?.contact_number],
                            ['Email ID', rawData?.email_id, 'Date of Birth', rawData?.date_of_birth],
                            ['Qualification', rawData?.qualification, 'Work Experience', rawData?.work_experience],
                            ['Location', rawData?.location, 'Skills', rawData?.skills],
                          ].map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                j % 2 === 0 ? (
                                  <td key={j} style={{ padding: '8px 14px', background: '#f8fafc', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', width: '18%' }}>{cell}</td>
                                ) : (
                                  <td key={j} style={{ padding: '8px 14px', color: '#0f172a', borderBottom: '1px solid #e2e8f0', width: '32%' }}>{cell || '—'}</td>
                                )
                              ))}
                            </tr>
                          ))}
                          <tr>
                            <td style={{ padding: '8px 14px', background: '#f8fafc', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Career Objective</td>
                            <td colSpan="3" style={{ padding: '8px 14px', color: '#0f172a', borderBottom: '1px solid #e2e8f0' }}>{rawData?.career_objective || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 14px', background: '#f8fafc', fontWeight: 600, color: '#64748b' }}>Certificates</td>
                            <td colSpan="3" style={{ padding: '8px 14px', color: '#0f172a' }}>{rawData?.certificates || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <button onClick={handleViewResume}
                        style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                        View PDF
                      </button>
                      <button onClick={handleSave} disabled={saveDisabled}
                        style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saveDisabled ? '#f1f5f9' : '#16a34a', color: saveDisabled ? '#94a3b8' : '#fff', fontSize: 14, fontWeight: 600, cursor: saveDisabled ? 'not-allowed' : 'pointer' }}>
                        Save Details
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {loader && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'atmSpin .6s linear infinite' }} />
                <p style={{ marginTop: 12, fontWeight: 600, color: '#64748b', fontSize: 14 }}>Please wait...</p>
              </div>
            )}
        </>
    );
};

export default AddCandidateModal;
