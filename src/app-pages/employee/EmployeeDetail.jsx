import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import useLiveRefresh from '@/lib/live';
import { openEmployeeDocument, previewEmployeeDocument, previewDocumentUrl } from '@/lib/clientDocs';
import { Tabs } from '@/lib/ui-motion';
import { DOC_OPTIONS } from '@/lib/documents';
import useStatusMaster, { pillStyle } from '../shared/useStatusMaster';

const EmployeeDetail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { id } = useParams();
    const fromPending = searchParams.get('fromPending') === 'true';

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    // ?tab=documents opens straight on the compulsory-documents editor (used by the Documents button in Manage Employees)
    const [tab, setTab] = useState(['overview', 'documents', 'assets'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview');
    const [assets, setAssets] = useState(null); // null = not loaded / not allowed
    const [reqDocs, setReqDocs] = useState([]);
    useEffect(() => {
        if (tab !== 'assets' || !employee) return;
        fetch('/api/assets?employee_id=' + employee.id, { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } })
            .then(r => (r.ok ? r.json() : { assignments: [] })).then(d => setAssets(d.assignments || [])).catch(() => setAssets([]));
    }, [tab, employee && employee.id]);
    // Which of the employee's documents are locked, and who may upload again (HR allows one upload at a time)
    const [permDocs, setPermDocs] = useState([]);
    const [permBusy, setPermBusy] = useState('');
    const [uploads, setUploads] = useState([]); // papers sent through My Documents (waiting or approved)
    const openApproval = async (id) => {
        try {
            const res = await fetch('/api/documents/' + id + '/serve', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } });
            if (!res.ok) throw new Error('Could not open the document');
            window.open(URL.createObjectURL(await res.blob()), '_blank');
        } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    };
    const loadPerms = () => {
        if (!employee) return;
        fetch('/api/employee/document-permissions?employee_id=' + employee.id, { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } })
            .then(r => (r.ok ? r.json() : { docs: [] })).then(d => { setPermDocs(d.docs || []); setUploads(d.uploads || []); }).catch(() => { setPermDocs([]); setUploads([]); });
    };
    useEffect(() => { loadPerms(); }, [tab === 'documents', employee && employee.id]);
    useLiveRefresh(() => loadPerms());
    const setPerm = async (key, allow) => {
        setPermBusy(key);
        try {
            const res = await fetch('/api/employee/document-permissions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('token') }, body: JSON.stringify({ employee_id: employee.id, document_type: key, allow }) });
            const d = await res.json();
            if (!res.ok) throw new Error(d.detail || 'Could not save');
            loadPerms();
            if (allow) askToMail(d.message || 'Permission given');
        } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
        finally { setPermBusy(''); }
    };
    // Mail the employee from here: the text comes from the "Document Request" template and can be changed before sending
    const mailEmployee = async () => {
        const auth = { Authorization: 'Bearer ' + sessionStorage.getItem('token') };
        let m;
        try {
            const res = await fetch('/api/employee/document-mail?employee_id=' + employee.id + '&required=' + encodeURIComponent(reqDocs.join(',')), { headers: auth });
            m = await res.json();
            if (!res.ok) throw new Error(m.detail || 'Could not prepare the mail');
        } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); return; }
        const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const lbl = 'font-size:12px;font-weight:700;display:block;margin:10px 0 3px';
        const box = 'width:100%;box-sizing:border-box;margin:0;font-size:13.5px';
        const x = await Swal.fire({
            title: 'Mail ' + (employee.full_name || 'the employee'), width: 680, showCancelButton: true, confirmButtonText: 'Send mail', focusConfirm: false,
            html: `<div style="text-align:left"><div style="font-size:12.5px;color:#64748b">To: <b>${esc(m.to) || 'no email address'}</b>${m.documents.length ? ' &middot; Documents: ' + esc(m.documents.join(', ')) : ''}</div>
              <label style="${lbl}">Cc (optional)</label><input id="dm-cc" class="swal2-input" style="${box};height:36px" />
              <label style="${lbl}">Subject</label><input id="dm-sub" class="swal2-input" style="${box};height:36px" value="${esc(m.subject)}" />
              <label style="${lbl}">Message</label><textarea id="dm-msg" class="swal2-textarea" style="${box};height:220px">${esc(m.body)}</textarea></div>`,
            preConfirm: () => {
                const subject = document.getElementById('dm-sub').value.trim(), message = document.getElementById('dm-msg').value.trim();
                if (!subject || !message) { Swal.showValidationMessage('Write the subject and the message'); return false; }
                return { subject, message, cc: document.getElementById('dm-cc').value.trim() };
            },
        });
        if (!x.isConfirmed) return;
        try {
            const res = await fetch('/api/employee/document-mail', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: employee.id, ...x.value }) });
            const d = await res.json();
            if (!res.ok) throw new Error(d.detail || 'Could not send');
            Swal.fire({ icon: 'success', title: 'Mail sent', text: d.message, timer: 2200, showConfirmButton: false });
        } catch (e) { Swal.fire({ icon: 'error', title: 'Not sent', text: e.message }); }
    };
    const askToMail = async (title) => {
        const r = await Swal.fire({ icon: 'success', title, text: 'Do you want to mail the employee about it now?', showCancelButton: true, confirmButtonText: 'Write the mail', cancelButtonText: 'Not now' });
        if (r.isConfirmed) mailEmployee();
    };
    const [savingReq, setSavingReq] = useState(false);
    useEffect(() => {
        if (!employee) return;
        try { setReqDocs(employee.required_documents ? JSON.parse(employee.required_documents) : []); } catch { setReqDocs([]); }
    }, [employee && employee.id]);
    const saveReqDocs = async () => {
        setSavingReq(true);
        try {
            const res = await fetch('/api/employee/required-documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('token') },
                body: JSON.stringify({ employee_id: employee.id, required_documents: reqDocs }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.detail || 'Could not save');
            if (reqDocs.length) askToMail(d.message || 'Saved');
            else Swal.fire({ icon: 'success', title: 'Saved', text: d.message, timer: 2000, showConfirmButton: false });
        } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
        finally { setSavingReq(false); }
    };
    const sm = useStatusMaster();

    const openDoc = (field) => openEmployeeDocument(employee.id, field);

    useEffect(() => {
        if (id) {
            fetch(`/api/employee/detail/${id}`, {
                headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
            })
                .then(res => res.json())
                .then(data => {
                    setEmployee(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [id]);

    const approveEmployee = () => {
        fetch(`/api/employee/approve/${employee?.id}`, {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            },
        })
        .then(res => {
            if (res.ok) {
                Swal.fire('Approved!', 'Employee approved successfully', 'success')
                    .then(() => navigate('/hrms/pendingemployees'));
            } else {
                throw new Error("Failed to approve");
            }
        })
        .catch(() => {
            Swal.fire('Error', 'Failed to approve employee', 'error');
        });
    };

    const rejectEmployee = () => {
        fetch(`/api/employee/edit/${employee?.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            },
            body: JSON.stringify({ status: 'dropped' })
        })
        .then(res => {
            if (res.ok) {
                Swal.fire('Dropped!', 'Employee marked as dropped', 'warning')
                    .then(() => navigate('/hrms/pendingemployees'));
            } else {
                throw new Error("Failed to reject");
            }
        })
        .catch(() => {
            Swal.fire('Error', 'Failed to reject employee', 'error');
        });
    };

    if (loading) {
        return <div className="p-4 text-center">Loading...</div>;
    }

    if (!employee) {
        return <div className="p-4 text-center text-danger">Employee details not found.</div>;
    }

    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
    const initials = (employee.full_name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const st = sm.find('employee', employee.status);
    const joined = employee.date_of_joining || employee.created_on;

    const Row = ({ label, value }) => (
        <div className="ed-row"><span>{label}</span><b>{value || value === 0 ? value : <em>&mdash;</em>}</b></div>
    );
    const docs = [
        ['identity_proof', 'Identity Proof'], ['resume_path', 'Latest Resume'], ['marksheet10', '10th Marksheet'], ['marksheet12', '12th Marksheet'],
        ['ug_document', 'UG Degree'], ['pg_document', 'PG Degree'], ['offer_letter', 'Offer Letter'], ['address_proof', 'Address Proof'],
        ['appointment_letter', 'Appointment Letter'], ['internship_certificate', 'Internship Certificate'], ['photograph', 'Photograph'],
    ].filter(([k]) => employee[k]);

    return (
        <div className="emp-detail-page">
            <style>{`
                .emp-detail-page { min-height: 60vh; }
                .ed-grid { display: grid; grid-template-columns: 300px 1fr; gap: 14px; align-items: start; }
                .ed-card { background: #fff; border: 1px solid #e8edf6; border-radius: 12px; padding: 16px; }
                .ed-card h3 { margin: 0 0 10px; font-size: .78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
                .ed-profile { text-align: center; }
                .ed-avatar { width: 84px; height: 84px; border-radius: 50%; margin: 4px auto 10px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg,#2563eb,#3b82f6); color: #fff; font-family: 'Outfit',sans-serif; font-size: 1.7rem; font-weight: 700; overflow: hidden; border: 3px solid #dbeafe; }
                .ed-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .ed-name { font-size: 1.05rem; font-weight: 700; color: #0f172a; font-family: 'Outfit',sans-serif; }
                .ed-role { font-size: .82rem; color: #64748b; margin: 2px 0 8px; }
                .ed-facts { margin-top: 14px; text-align: left; border-top: 1px solid #eef2f7; padding-top: 10px; }
                .ed-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; font-size: .82rem; border-bottom: 1px solid #f4f6fa; }
                .ed-row:last-child { border-bottom: none; }
                .ed-row span { color: #64748b; flex-shrink: 0; }
                .ed-row b { color: #0f172a; font-weight: 600; text-align: right; word-break: break-word; }
                .ed-row em { color: #cbd5e1; font-style: normal; }
                .ed-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
                .ed-docs { display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap: 8px; }
                .ed-doc { display: flex; align-items: center; gap: 9px; padding: 10px 12px; border: 1px solid #e8edf6; border-radius: 10px; color: #1d4ed8; font-size: .82rem; font-weight: 600; text-decoration: none; background: #f8fbff; }
                .ed-doc:hover { background: #eff6ff; border-color: #bfdbfe; }
                .ed-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #eef2f7; }
                @media (max-width: 960px) { .ed-grid { grid-template-columns: 1fr; } .ed-two { grid-template-columns: 1fr; } }
            `}</style>

            <div className="ph">
                <div>
                    <h1>Employee Profile</h1>
                    <p>Full details, education and uploaded documents.</p>
                </div>
                <div className="ph-actions">
                    <button type="button" className="btn-o" onClick={() => fromPending ? navigate('/employees/pending') : navigate(-1)}>&larr; Back</button>
                </div>
            </div>

            <div className="ed-grid">
                <div className="ed-card ed-profile">
                    <div className="ed-avatar">{employee.profile_photo ? <img src={employee.profile_photo} alt="" /> : initials}</div>
                    <div className="ed-name">{employee.full_name}</div>
                    <div className="ed-role">{employee.designation || 'No designation'}</div>
                    {employee.status && <span style={pillStyle(st.color)}>{st.label}</span>}
                    <div className="ed-facts">
                        <Row label="Employee ID" value={employee.emp_code} />
                        <Row label="Email" value={employee.email_id} />
                        <Row label="Phone" value={employee.mobile_no} />
                        <Row label="Department" value={employee.department} />
                        <Row label="Joining Date" value={fmtDate(joined)} />
                    </div>
                </div>

                <div>
                    <div className="tabs-bar">
                        <Tabs id="emp-detail" value={tab} onChange={setTab} tabs={[
                            { id: 'overview', label: 'Overview' },
                            { id: 'personal', label: 'Personal Info' },
                            { id: 'education', label: 'Education / Work' },
                            { id: 'documents', label: <>Documents ({permDocs.length ? permDocs.filter(d => d.filled).length + uploads.filter(u => u.document_type === 'Additional').length : docs.length}){permDocs.some(d => d.permission === 'requested') && <span style={{ marginLeft: 6, background: '#2563eb', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10.5, fontWeight: 700 }}>{permDocs.filter(d => d.permission === 'requested').length} asked</span>}</> },
                            { id: 'assets', label: 'Assets' },
                        ]} />
                    </div>

                    <div className="ed-card">
                        {tab === 'overview' && (
                            <div className="ed-two">
                                <div>
                                    <h3>Contact</h3>
                                    <Row label="Email" value={employee.email_id} />
                                    <Row label="Mobile" value={employee.mobile_no} />
                                    <Row label="Alternate" value={employee.alternate_mobile_no} />
                                    <Row label="Present Address" value={employee.present_address} />
                                </div>
                                <div>
                                    <h3>Employment</h3>
                                    <Row label="Designation" value={employee.designation} />
                                    <Row label="Department" value={employee.department} />
                                    <Row label="Previous Company" value={employee.previous_company} />
                                    <Row label="Joining Date" value={fmtDate(joined)} />
                                </div>
                            </div>
                        )}
                        {tab === 'personal' && (
                            <>
                                <h3>Personal Details</h3>
                                <Row label="Name" value={employee.full_name} />
                                <Row label="Father / Spouse" value={employee.father_spouse_name} />
                                <Row label="DOB" value={employee.dob ? new Date(employee.dob).toLocaleDateString('en-GB').replace(/\//g, '-') : ''} />
                                <Row label="Email" value={employee.email_id} />
                                <Row label="Mobile" value={employee.mobile_no} />
                                <Row label="Alternate" value={employee.alternate_mobile_no} />
                                <Row label="Present Address" value={employee.present_address} />
                                <Row label="Permanent Address" value={employee.permanent_address} />
                            </>
                        )}
                        {tab === 'education' && (
                            <>
                                <h3>Education / Work</h3>
                                <Row label="College" value={employee.college_name} />
                                <Row label="Course" value={employee.course_name} />
                                <Row label="Specialization" value={employee.specialization} />
                                <Row label="Duration" value={employee.course_duration} />
                                <Row label="CGPA" value={employee.cgpa} />
                                <Row label="Company" value={employee.previous_company} />
                                <Row label="Designation" value={employee.designation} />
                            </>
                        )}
                        {tab === 'assets' && (
                            <>
                                <h3>Company assets</h3>
                                {assets === null ? <div style={{ color: '#94a3b8', fontSize: '.85rem' }}>Loading...</div>
                                    : assets.length === 0 ? <div style={{ color: '#94a3b8', fontSize: '.85rem', padding: '8px 0' }}>No assets assigned to this employee.</div>
                                    : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                                                <thead><tr>{['Tag', 'Asset', 'Given', 'Returned', 'Condition'].map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, textTransform: 'uppercase', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e8edf6' }}>{h}</th>)}</tr></thead>
                                                <tbody>{assets.map(a => (
                                                    <tr key={a.assignment_id}>
                                                        <td style={{ padding: '7px 10px', fontWeight: 700 }}>{a.asset_tag}</td>
                                                        <td style={{ padding: '7px 10px' }}>{a.name} <span style={{ color: '#94a3b8' }}>({a.asset_type})</span></td>
                                                        <td style={{ padding: '7px 10px' }}>{a.assigned_on}</td>
                                                        <td style={{ padding: '7px 10px' }}>{a.returned_on || <b style={{ color: '#b45309' }}>Not returned</b>}</td>
                                                        <td style={{ padding: '7px 10px' }}>{[a.condition_out, a.condition_in].filter(Boolean).join(' → ') || '-'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        </div>
                                    )}
                            </>
                        )}
                        {tab === 'documents' && (
                            <>
                                <style>{`
                                    .dp-t { width:100%; border-collapse:collapse; }
                                    .dp-t th { text-align:left; font-size:.68rem; text-transform:uppercase; letter-spacing:.4px; color:#64748b; padding:6px 10px; background:#f8fafc; border-bottom:1px solid #e8edf6; white-space:nowrap; }
                                    .dp-t td { padding:5px 10px; font-size:.8rem; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
                                    .dp-t tr:last-child td { border-bottom:none; }
                                `}</style>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                                    <h3 style={{ margin: 0 }}>Documents</h3>
                                    <span style={{ fontSize: '.76rem', color: '#64748b' }}>Tick the documents the employee must upload. Once a document is in, the employee cannot upload it again unless you allow it (one upload at a time).</span>
                                </div>
                                <div style={{ border: '1px solid #e8edf6', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                                    <table className="dp-t">
                                        <thead><tr><th>Document</th><th>Status</th><th style={{ textAlign: 'center' }}>Compulsory</th><th>Upload permission</th></tr></thead>
                                        <tbody>
                                            {permDocs.map(d => {
                                                const opt = DOC_OPTIONS.find(o => o.key === d.key) || {};
                                                const onProfile = !!(employee && opt.column && employee[opt.column]);
                                                const sent = uploads.find(u => u.document_type === d.key);
                                                return (
                                                    <tr key={d.key} style={{ background: d.permission === 'requested' ? '#eff6ff' : undefined }}>
                                                        <td style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{d.label}</td>
                                                        <td style={{ whiteSpace: 'nowrap' }}>
                                                            <span style={{ color: d.waiting ? '#d97706' : d.filled ? '#15803d' : '#94a3b8', fontWeight: 600, fontSize: '.76rem' }}>{d.key === 'Additional' ? 'Extra papers' : d.waiting ? 'Waiting for approval' : d.filled ? 'Uploaded' : 'Not uploaded'}</span>
                                                            {onProfile && <a href="#" onClick={(e) => { e.preventDefault(); openDoc(opt.column); }} style={{ marginLeft: 8, color: '#2563eb', fontWeight: 600, fontSize: '.76rem' }}>View</a>}
                                                            {onProfile && <a href="#" onClick={(e) => { e.preventDefault(); previewEmployeeDocument(employee.id, opt.column, d.label); }} style={{ marginLeft: 8, color: '#2563eb', fontWeight: 600, fontSize: '.76rem' }}>Preview</a>}
                                                            {!onProfile && sent && <a href="#" onClick={(e) => { e.preventDefault(); openApproval(sent.id); }} style={{ marginLeft: 8, color: '#2563eb', fontWeight: 600, fontSize: '.76rem' }}>View</a>}
                                                            {!onProfile && sent && <a href="#" onClick={(e) => { e.preventDefault(); previewDocumentUrl('/api/documents/' + sent.id + '/serve', d.label); }} style={{ marginLeft: 8, color: '#2563eb', fontWeight: 600, fontSize: '.76rem' }}>Preview</a>}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>{d.key === 'Additional' ? <span style={{ color: '#cbd5e1' }}>-</span> : <input type="checkbox" checked={reqDocs.includes(d.key)} onChange={() => setReqDocs(p => p.includes(d.key) ? p.filter(x => x !== d.key) : [...p, d.key])} />}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                                {d.waiting ? <span style={{ color: '#94a3b8', fontSize: '.76rem' }}>Approve it first</span> : d.permission === 'granted' ? (
                                                                    <>
                                                                        <span style={{ color: '#15803d', fontWeight: 600, fontSize: '.76rem' }}>Allowed</span>
                                                                        <button className="btn-o" style={{ height: 24, padding: '0 9px', fontSize: '.72rem' }} disabled={permBusy === d.key} onClick={() => setPerm(d.key, false)}>Take back</button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {d.permission === 'requested' && <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: '.74rem' }} title={d.note}>Employee asked{d.note ? ': ' + (d.note.length > 40 ? d.note.slice(0, 40) + '…' : d.note) : ''}</span>}
                                                                        <button className="btn-p" style={{ height: 24, padding: '0 10px', fontSize: '.72rem' }} disabled={permBusy === d.key} onClick={() => setPerm(d.key, true)}>{d.filled ? 'Allow upload again' : 'Allow upload'}</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '0 0 6px' }}>
                                    <button className="btn-p" onClick={saveReqDocs} disabled={savingReq}>{savingReq ? 'Saving...' : 'Save compulsory documents'}</button>
                                    <button className="btn-o" onClick={mailEmployee}>&#9993; Mail the employee</button>
                                    <span style={{ fontSize: '.76rem', color: '#64748b' }}>Asks for the compulsory documents that are not uploaded yet and the ones you have allowed. The text is the &quot;Document Request&quot; template.</span>
                                </div>
                            </>
                        )}

                        {fromPending && (
                            <div className="ed-actions">
                                <button className="btn-o" onClick={rejectEmployee}>Reject</button>
                                <button className="btn-p" onClick={approveEmployee}>Approve</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetail;

