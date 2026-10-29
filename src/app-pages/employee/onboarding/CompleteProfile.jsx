import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { DOC_OPTIONS } from '@/lib/documents';
import { shrinkImage, MAX_UPLOAD_BYTES, MAX_TOTAL_BYTES, mb } from '@/lib/shrink-upload';
import { useNavigate } from 'react-router-dom';

const s = {
    page: { minHeight: '100vh', background: '#f8fafc', padding: '24px 15px', boxSizing: 'border-box' },
    card: { maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '21px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e8f0ff' },
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 },
    logoutBtn: { flexShrink: 0, padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
    title: { fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" },
    subtitle: { fontSize: 13.5, color: '#64748b', margin: '0 0 20px' },
    remarksBox: { background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '14px 16px', marginBottom: 20 },
    remarksTitle: { fontSize: 13, fontWeight: 700, color: '#b91c1c', margin: '0 0 4px' },
    remarksText: { fontSize: 13.5, color: '#991b1b', margin: 0 },
    field: { marginBottom: 16 },
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
    input: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' },
    textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', background: '#fff' },
    sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b', marginTop: 24, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #eff6ff', fontFamily: "'Outfit', sans-serif" },
    submitBtn: { padding: '12px 24px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 24 },
};

const DOCS = DOC_OPTIONS.map(d => ({ label: d.label, name: d.key }));

const CSS = `
.cp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.cp-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.cp-file { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 8px 12px; border-radius: 10px; box-sizing: border-box; width: 100%; text-align: left; font-family: inherit; }
.cp-file-empty { border: 1.5px dashed #cbd5e1; background: #f8fafc; color: #475569; cursor: pointer; }
.cp-file-ok { border: 1.5px solid #86efac; background: #f0fdf4; color: #166534; }
.cp-file-old { border: 1.5px solid #bfdbfe; background: #eff6ff; color: #1e40af; }
.cp-file b { font-weight: 600; word-break: break-all; }
.cp-file small { display: block; font-size: 11.5px; opacity: .8; }
.cp-file-btn { margin-left: auto; flex-shrink: 0; border: 1.5px solid currentColor; background: #fff; color: inherit; border-radius: 8px; padding: 7px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
.cp-file-x { flex-shrink: 0; border: none; background: transparent; color: #b91c1c; font-size: 20px; line-height: 1; cursor: pointer; padding: 4px 6px; }
@media (max-width: 900px) { .cp-grid3 { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) {
  .cp-grid2, .cp-grid3 { grid-template-columns: 1fr; gap: 4px; }
  .cp-page { padding: 12px 8px !important; }
  .cp-card { padding: 16px 14px !important; border-radius: 12px !important; }
  .cp-card input, .cp-card textarea { font-size: 16px !important; }
  .cp-card button[type=submit] { width: 100%; }
}
`;

const fmtSize = (n) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

// Shows plainly whether a file is chosen: a dashed "Choose file" box, a green box with the file name and size, or a blue
// "already uploaded" box. Replacing and removing are buttons, so nothing depends on reading the browser's own file field.
function FilePick({ name, multiple, value, had, busy, onChange, onClear }) {
    const ref = useRef(null);
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    const open = () => ref.current && ref.current.click();
    const clear = () => { if (ref.current) ref.current.value = ''; onClear(); };
    let box;
    if (busy) {
        box = <div className="cp-file cp-file-old"><span>Preparing the file...</span></div>;
    } else if (list.length > 0) {
        box = (
            <div className="cp-file cp-file-ok">
                <span style={{ fontSize: 18 }}>✓</span>
                <span style={{ minWidth: 0 }}>
                    {list.length === 1
                        ? <><b>{list[0].name}</b><small>{fmtSize(list[0].size)} - ready to submit</small></>
                        : <><b>{list.length} files selected</b><small>{list.map(x => x.name).join(', ')}</small></>}
                </span>
                <button type="button" className="cp-file-btn" onClick={open}>Change</button>
                <button type="button" className="cp-file-x" aria-label="Remove" onClick={clear}>&times;</button>
            </div>
        );
    } else if (had) {
        box = (
            <div className="cp-file cp-file-old">
                <span style={{ fontSize: 18 }}>✓</span>
                <span style={{ minWidth: 0 }}><b>Already uploaded</b><small>Choose a file only if you want to replace it</small></span>
                <button type="button" className="cp-file-btn" onClick={open}>Replace</button>
            </div>
        );
    } else {
        box = (
            <button type="button" className="cp-file cp-file-empty" onClick={open}>
                <span style={{ fontSize: 18 }}>⬆</span>
                <span><b>{multiple ? 'Choose files' : 'Choose file'}</b><small>Not uploaded yet - PDF, JPG or PNG</small></span>
            </button>
        );
    }
    return (
        <>
            <input ref={ref} type="file" style={{ display: 'none' }} name={name} multiple={multiple} accept="application/pdf,image/jpeg,image/jpg,image/png" onChange={onChange} />
            {box}
        </>
    );
}

export default function CompleteProfile({ onSubmitted }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState(null);

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('permissions');
        sessionStorage.removeItem('employee_status');
        sessionStorage.removeItem('hr_remarks');
        navigate('/login', { replace: true });
    };
    const [form, setForm] = useState({
        full_name: '', father_spouse_name: '', dob: '', present_address: '', permanent_address: '',
        mobile_no: '', college_name: '', course_name: '', specialization: '', course_duration: '', cgpa: '',
        alternate_mobile_no: '', previous_company: '', bank_name: '', account_number: '', pan: '',
        location: '', date_of_joining: '',
    });
    const [files, setFiles] = useState({});
    const [busy, setBusy] = useState({});
    const [progress, setProgress] = useState(null); // while the files are being sent: { done, total, name }
    const sentRef = useRef(new Set()); // files already sent, so pressing Submit again does not send them twice

    useEffect(() => {
        fetch('/api/profile', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } })
            .then(r => r.json())
            .then(data => {
                setProfile(data);
                setForm(prev => {
                    const next = { ...prev };
                    Object.keys(prev).forEach(k => {
                        if (data[k] != null) next[k] = k === 'dob' || k === 'date_of_joining' ? String(data[k]).slice(0, 10) : data[k];
                    });
                    return next;
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Pictures are made smaller here before they are sent (phone photos are several MB each); a file that is still too big is refused
    // with its size, instead of the whole form failing later with "Failed to fetch".
    const handleFile = async (e) => {
        const input = e.target;
        const { name, multiple } = input;
        const picked = Array.from(input.files || []);
        if (picked.length === 0) return; // the picker was closed without choosing: keep what was chosen before
        const ready = [];
        setBusy(p => ({ ...p, [name]: true }));
        try {
            for (const f of picked) {
                const g = await shrinkImage(f);
                if (g.size > MAX_UPLOAD_BYTES) {
                    Swal.fire({ icon: 'warning', title: 'File is too big', text: '"' + f.name + '" is ' + mb(f.size) + '. Please upload a file smaller than ' + mb(MAX_UPLOAD_BYTES) + ' (a photo of the document, or a smaller PDF).' });
                    input.value = '';
                    return;
                }
                ready.push(g);
            }
            setFiles(prev => ({ ...prev, [name]: multiple ? ready : ready[0] }));
        } finally {
            setBusy(p => ({ ...p, [name]: false }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.full_name.trim() || !form.father_spouse_name.trim() || !form.dob || !form.present_address.trim() || !form.mobile_no.trim()) {
            Swal.fire({ icon: 'warning', title: 'Missing details', text: 'Please fill in all the required fields (marked with *).' });
            return;
        }
        // compulsory documents set by HR: each needs a file now, or one uploaded earlier
        const requiredKeys = (profile && profile.required_documents) || [];
        const doneKeys = (profile && profile.uploaded_documents) || [];
        const missingKeys = requiredKeys.filter(k => !(files[k]) && !doneKeys.includes(k));
        if (missingKeys.length > 0) {
            const names = DOCS.filter(d => missingKeys.includes(d.name)).map(d => d.label).join(', ');
            Swal.fire({ icon: 'warning', title: 'Documents required', text: 'Please upload the compulsory document(s): ' + names });
            return;
        }
        const totalBytes = Object.values(files).reduce((n, v) => n + (Array.isArray(v) ? v.reduce((a, f) => a + (f ? f.size : 0), 0) : (v ? v.size : 0)), 0);
        if (totalBytes > MAX_TOTAL_BYTES) {
            Swal.fire({ icon: 'warning', title: 'Files are too big together', text: 'The files add up to ' + mb(totalBytes) + '. Please keep them under ' + mb(MAX_TOTAL_BYTES) + ' in total (smaller photos or PDFs).' });
            return;
        }
        setSubmitting(true);
        const authHeader = { Authorization: 'Bearer ' + sessionStorage.getItem('token') };
        // Every file goes in a request of its own, one after the other: a single request with all the files ran so long that the
        // hosting cut it off ("Failed to fetch"). A file that has already gone is not sent again if Submit is pressed again.
        const queue = [];
        Object.entries(files).forEach(([k, v]) => { (Array.isArray(v) ? v : [v]).forEach(f => { if (f) queue.push({ key: k, file: f }); }); });
        const sig = (q) => q.key + '|' + q.file.name + '|' + q.file.size + '|' + q.file.lastModified;
        const todo = queue.filter(q => !sentRef.current.has(sig(q)));
        try {
            for (let i = 0; i < todo.length; i++) {
                const q = todo[i];
                setProgress({ done: i, total: todo.length, name: q.file.name });
                const one = new FormData();
                one.append('key', q.key);
                one.append('file', q.file);
                let up;
                try {
                    up = await fetch('/api/employee/complete-profile/document', { method: 'POST', headers: authHeader, body: one });
                } catch (netErr) {
                    Swal.fire({ icon: 'error', title: 'Could not upload', text: '"' + q.file.name + '" could not be sent. Please check your internet connection and press Submit again - the files that were already sent will not be sent again.' });
                    return;
                }
                const upResult = await up.json().catch(() => ({}));
                if (!up.ok) {
                    Swal.fire({ icon: 'error', title: 'Could not upload', text: (upResult.detail || ('"' + q.file.name + '" could not be uploaded.')) + ' Press Submit again to retry - the files that were already sent will not be sent again.' });
                    return;
                }
                sentRef.current.add(sig(q));
            }
            setProgress(null);
            const data = new FormData();
            Object.entries(form).forEach(([k, v]) => data.append(k, v || ''));
            const res = await fetch('/api/employee/complete-profile', {
                method: 'PUT',
                headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') },
                body: data,
            });
            const result = await res.json();
            if (res.ok) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Details Saved',
                    text: 'Your details have been submitted to HR. You can use the portal once HR reviews and activates your account.',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#1e40af',
                });
                onSubmitted && onSubmitted();
            } else {
                Swal.fire({ icon: 'error', title: 'Could not save', text: result.detail || 'Failed to submit profile.' });
            }
        } catch (err) {
            const dropped = /failed to fetch|networkerror|load failed/i.test(String(err && err.message));
            Swal.fire({ icon: 'error', title: 'Connection error', text: dropped
                ? 'Your details could not reach the server. Please check your internet connection and try again. If it keeps happening, use smaller files (under ' + mb(MAX_UPLOAD_BYTES) + ' each) or try again on a faster connection. (' + err.message + ')'
                : 'Failed to connect to the server: ' + err.message });
        } finally {
            setSubmitting(false);
            setProgress(null);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 45, color: '#64748b' }}>Loading...</div>;

    return (
        <div className="cp-page" style={s.page}>
            <style>{CSS}</style>
            <div className="cp-card" style={s.card}>
                <div style={s.header}>
                    <h2 style={s.title}>👋 Complete Your Profile</h2>
                    <button type="button" style={s.logoutBtn} onClick={handleLogout}>Log Out</button>
                </div>
                <p style={s.subtitle}>
                    Fill in your details below. Once submitted, HR will review and activate your account.
                    {profile?.emp_code && <> Your Employee ID is <strong>{profile.emp_code}</strong>.</>}
                </p>

                {profile?.hr_remarks && (
                    <div style={s.remarksBox}>
                        <p style={s.remarksTitle}>⚠️ HR requested a correction:</p>
                        <p style={s.remarksText}>{profile.hr_remarks}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} encType="multipart/form-data">
                    <div style={s.sectionTitle}>Personal Details</div>
                    <div className="cp-grid2">
                        <div style={s.field}>
                            <label style={s.label}>Full Name *</label>
                            <input style={s.input} name="full_name" value={form.full_name} onChange={handleChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Father / Spouse Name *</label>
                            <input style={s.input} name="father_spouse_name" value={form.father_spouse_name} onChange={handleChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Date of Birth *</label>
                            <input type="date" style={s.input} name="dob" value={form.dob} onChange={handleChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Mobile Number *</label>
                            <input style={s.input} name="mobile_no" value={form.mobile_no} onChange={handleChange} maxLength={10} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Alternate Mobile</label>
                            <input style={s.input} name="alternate_mobile_no" value={form.alternate_mobile_no} onChange={handleChange} maxLength={10} />
                        </div>
                        <div style={{ ...s.field, gridColumn: '1 / -1' }}>
                            <label style={s.label}>Present Address *</label>
                            <textarea style={s.textarea} rows={2} name="present_address" value={form.present_address} onChange={handleChange} required />
                        </div>
                        <div style={{ ...s.field, gridColumn: '1 / -1' }}>
                            <label style={s.label}>Permanent Address</label>
                            <textarea style={s.textarea} rows={2} name="permanent_address" value={form.permanent_address} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={s.sectionTitle}>Education</div>
                    <div className="cp-grid3">
                        <div style={s.field}>
                            <label style={s.label}>College Name</label>
                            <input style={s.input} name="college_name" value={form.college_name} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Course</label>
                            <input style={s.input} name="course_name" value={form.course_name} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Specialization</label>
                            <input style={s.input} name="specialization" value={form.specialization} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Course Duration</label>
                            <input style={s.input} name="course_duration" value={form.course_duration} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>CGPA / Percentage</label>
                            <input style={s.input} name="cgpa" value={form.cgpa} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Previous Company</label>
                            <input style={s.input} name="previous_company" value={form.previous_company} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={s.sectionTitle}>Bank &amp; Joining Details</div>
                    <div className="cp-grid3">
                        <div style={s.field}>
                            <label style={s.label}>Bank Name</label>
                            <input style={s.input} name="bank_name" value={form.bank_name} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Account Number</label>
                            <input style={s.input} name="account_number" value={form.account_number} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>PAN</label>
                            <input style={s.input} name="pan" value={form.pan} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Location</label>
                            <input style={s.input} name="location" value={form.location} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Date of Joining</label>
                            <input type="date" style={s.input} name="date_of_joining" value={form.date_of_joining} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={s.sectionTitle}>Documents</div>
                    <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '-8px 0 14px' }}>
                        {profile && profile.required_documents && profile.required_documents.length > 0
                            ? <>Documents marked <b style={{ color: '#dc2626' }}>*</b> are compulsory - HR needs them before you can submit. The rest are optional.</>
                            : 'Upload whichever of these you have - none are required to submit, and you can add the rest later.'}
                    </p>
                    <div className="cp-grid3">
                        {DOCS.map(({ label, name }) => {
                            const isReq = !!(profile && profile.required_documents && profile.required_documents.includes(name));
                            const had = !!(profile && profile.uploaded_documents && profile.uploaded_documents.includes(name));
                            return (
                                <div style={s.field} key={name}>
                                    <label style={s.label}>{label}{isReq && <span style={{ color: '#dc2626' }}> *</span>}{had && <span style={{ color: '#16a34a', fontWeight: 500, fontSize: 11.5 }}> (already uploaded)</span>}</label>
                                    <FilePick name={name} value={files[name]} had={had} busy={!!busy[name]} onChange={handleFile} onClear={() => setFiles(prev => ({ ...prev, [name]: undefined }))} />
                                </div>
                            );
                        })}
                        <div style={{ ...s.field, gridColumn: '1 / -1' }}>
                            <label style={s.label}>Additional Documents</label>
                            <FilePick name="AdditionalDocuments" multiple value={files.AdditionalDocuments} busy={!!busy.AdditionalDocuments} onChange={handleFile} onClear={() => setFiles(prev => ({ ...prev, AdditionalDocuments: undefined }))} />
                        </div>
                    </div>

                    <button type="submit" style={s.submitBtn} disabled={submitting}>
                        {submitting ? (progress ? 'Uploading ' + (progress.done + 1) + ' of ' + progress.total + '...' : 'Submitting...') : 'Submit for HR Review'}
                    </button>
                    {progress && <p style={{ fontSize: 12.5, color: '#64748b', margin: '10px 0 0', wordBreak: 'break-all' }}>Sending &quot;{progress.name}&quot; ({progress.done + 1} of {progress.total}). Please keep this page open until it finishes.</p>}
                </form>
            </div>
        </div>
    );
}
