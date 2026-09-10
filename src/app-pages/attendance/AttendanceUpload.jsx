import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const AttendanceUpload = () => {
    const navigate = useNavigate();
    const [uploadMode, setUploadMode] = useState('bulk');
    const [employeeId, setEmployeeId] = useState('');
    const [file, setFile] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [msg, setMsg] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);
    const [toSyncMonth, setToSyncMonth] = useState(String(new Date().getMonth() + 1));
    const [toSyncYear, setToSyncYear] = useState(String(new Date().getFullYear()));
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        fetch(`${API}/employee/management`, { headers: auth() })
            .then(res => res.json())
            .then(data => setEmployees(data))
            .catch(err => console.error("Failed to load employees", err));
    }, []);

    const selectMode = async (mode) => {
        setUploadMode(mode);
        setMsg('');
        if (mode === 'download') {
            try {
                const res = await fetch(`${API}/HRMS/DownloadAttendanceFormat`, { headers: auth() });
                if (!res.ok) { const d = await res.json().catch(() => {}); throw new Error(d?.detail || 'Failed to download'); }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Attendance_Format.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (err) {
                setMsg(err.message);
            }
            setUploadMode('bulk');
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setMsg('');
        }
    };

    const removeFile = () => {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files;
        if (dropped.length > 0) {
            setFile(dropped[0]);
            setMsg('');
        }
    };

    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);

    const validateUpload = () => {
        if (uploadMode === "employee" && !employeeId)
            return show("Please select an employee");
        if (!file)
            return show("Please select an Excel file");
        return true;
    };

    const show = (text) => { setMsg(text); return false; };

    const uploadExcel = () => {
        if (!validateUpload()) return;
        setUploading(true);
        setMsg('');

        const formData = new FormData();
        formData.append("mode", uploadMode);
        formData.append("empCode", employeeId);
        formData.append("file", file);

        const url = uploadMode === "bulk"
            ? `${API}/attendance/upload_bulk`
            : `${API}/attendance/upload_employee_wise`;

        fetch(url, {
            method: "POST",
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
            body: formData
        })
        .then(async res => {
            if (!res.ok) {
                let errorMsg = "Upload failed";
                try { const data = await res.json(); if (data.detail) errorMsg = data.detail; } catch (e) {}
                throw new Error(errorMsg);
            }
            return res.json();
        })
        .then((data) => {
            setUploading(false);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            Swal.fire({
                icon: 'success',
                title: 'Attendance Imported',
                text: data.message || 'Attendance records imported successfully',
                timer: 2000,
                showConfirmButton: true,
                confirmButtonText: 'View Summary',
                confirmButtonColor: '#6366f1',
            }).then(r => { if (r.isConfirmed) navigate('/attendance/result'); });
        })
        .catch((err) => {
            setUploading(false);
            setMsg(err.message);
        });
    };

    const syncTeamOffice = () => {
        setSyncing(true);
        setMsg('');
        fetch(`${API}/attendance/import-teamoffice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
            body: JSON.stringify({ month: parseInt(toSyncMonth), year: parseInt(toSyncYear) })
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Sync failed');
            return data;
        })
        .then(data => {
            setSyncing(false);
            Swal.fire({
                icon: 'success',
                title: 'TeamOffice Sync Complete',
                text: data.message || `Imported ${data.importCount} records`,
                confirmButtonColor: '#6366f1',
            });
        })
        .catch(err => {
            setSyncing(false);
            setMsg(err.message);
        });
    };

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    return (
        <>
            <style>{`
                .au-page { animation:auFade .35s ease both; }
                @keyframes auFade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
                @keyframes auLift { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
                @keyframes auSpin { to{transform:rotate(360deg)} }

                .au-hdr { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:16px; flex-wrap:wrap; }
                .au-hdr-l { display:flex; align-items:center; gap:16px; }
                .au-hdr-icon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#eef2ff,#f5f4ff); display:flex; align-items:center; justify-content:center; color:#6366f1; flex-shrink:0; }
                .au-hdr-txt h1 { margin:0; font-family:'Outfit',sans-serif; font-weight:800; font-size:1.4rem; color:#0f172a; letter-spacing:-0.3px; }
                .au-hdr-txt p { margin:2px 0 0; font-size:.82rem; color:#6b7280; }

                .au-support-card { display:flex; align-items:center; gap:12px; padding:12px 18px; background:#faf9ff; border:1.5px dashed #ddd6fe; border-radius:12px; max-width:1800px; }
                .au-support-card .au-sc-icon { width:36px; height:36px; border-radius:8px; background:#eef2ff; display:flex; align-items:center; justify-content:center; color:#6366f1; flex-shrink:0; }
                .au-support-card .au-sc-info { font-size:.75rem; color:#6b7280; line-height:1.4; }
                .au-support-card .au-sc-info strong { color:#1f2937; font-weight:600; }

                .au-modes { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
                .au-mode-card { background:#fff; border:1.5px solid #f1f0ff; border-radius:14px; padding:20px; cursor:pointer; transition:all .25s; text-align:center; }
                .au-mode-card:hover { border-color:#ddd6fe; transform:translateY(-2px); box-shadow:0 6px 20px rgba(99,102,241,0.08); }
                .au-mode-card.active { border-color:#6366f1; background:#faf9ff; box-shadow:0 4px 16px rgba(99,102,241,0.12); }
                .au-mode-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; transition:all .25s; }
                .au-mode-card.active .au-mode-icon { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; }
                .au-mode-card:not(.active) .au-mode-icon { background:#f5f4ff; color:#6366f1; }
                .au-mode-card h3 { font-size:.9rem; font-weight:700; color:#0f172a; margin:0 0 4px; }
                .au-mode-card p { font-size:.75rem; color:#6b7280; margin:0; line-height:1.3; }

                .au-dropzone { border:2px dashed #ddd6fe; border-radius:14px; padding:36px 24px; text-align:center; transition:all .25s; cursor:pointer; background:#faf9ff; margin-bottom:16px; }
                .au-dropzone:hover, .au-dropzone.dragover { border-color:#6366f1; background:#eef2ff; box-shadow:0 0 0 4px rgba(99,102,241,0.06); }
                .au-dropzone-icon { color:#6366f1; margin-bottom:10px; }
                .au-dropzone p { font-size:.88rem; color:#1f2937; font-weight:500; margin:0 0 4px; }
                .au-dropzone .au-or { font-size:.78rem; color:#9ca3af; margin:0 0 10px; }
                .au-choose-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 20px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:9px; font-weight:600; font-size:.8rem; cursor:pointer; transition:all .2s; }
                .au-choose-btn:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(99,102,241,0.3); }

                .au-file-info { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; margin-bottom:16px; animation:auFade .25s ease; }
                .au-file-info .au-fi-l { display:flex; align-items:center; gap:10px; }
                .au-file-info .au-fi-name { font-size:.82rem; font-weight:600; color:#15803d; }
                .au-file-info .au-fi-size { font-size:.72rem; color:#6b7280; }
                .au-file-remove { width:28px; height:28px; border-radius:6px; border:none; background:#fef2f2; color:#ef4444; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
                .au-file-remove:hover { background:#fee2e2; }

                .au-validations { display:flex; gap:20px; margin-bottom:18px; flex-wrap:wrap; }
                .au-validations span { display:flex; align-items:center; gap:6px; font-size:.75rem; color:#6b7280; }
                .au-validations .au-v-ok { color:#15803d; }

                .au-import-btn { width:100%; height:56px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:12px; font-weight:700; font-size:.95rem; cursor:pointer; transition:all .25s; display:flex; align-items:center; justify-content:center; gap:8px; }
                .au-import-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 24px rgba(99,102,241,0.35); }
                .au-import-btn:disabled { opacity:.7; cursor:default; }

                .au-msg { display:flex; align-items:center; gap:8px; padding:12px 16px; border-radius:10px; margin-bottom:16px; font-size:.82rem; font-weight:500; animation:auFade .25s ease; }
                .au-msg.error { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; }
                .au-msg .au-retry { margin-left:auto; padding:4px 12px; background:#fff; border:1px solid #fecaca; border-radius:6px; color:#dc2626; font-size:.75rem; font-weight:600; cursor:pointer; transition:all .15s; }
                .au-msg .au-retry:hover { background:#fef2f2; }

                .au-tips { background:linear-gradient(135deg,#faf9ff,#f5f4ff); border:1px solid #f1f0ff; border-radius:14px; padding:20px; margin-top:24px; display:flex; gap:16px; }
                .au-tips-icon { width:40px; height:40px; border-radius:10px; background:#eef2ff; display:flex; align-items:center; justify-content:center; color:#6366f1; flex-shrink:0; }
                .au-tips-content { flex:1; }
                .au-tips-content h3 { font-size:.85rem; font-weight:700; color:#0f172a; margin:0 0 10px; }
                .au-tips-content ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
                .au-tips-content ul li { display:flex; align-items:center; gap:8px; font-size:.78rem; color:#6b7280; }
                .au-tips-content ul li .au-tip-badge { width:6px; height:6px; border-radius:50%; background:#6366f1; flex-shrink:0; }

                .au-select-wrap { margin-bottom:18px; }
                .au-select-wrap label { display:block; font-size:.78rem; font-weight:600; color:#374151; margin-bottom:5px; }
                .au-select-wrap select { width:100%; padding:9px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:.82rem; outline:none; background:#fff; color:#1f2937; transition:all .2s; }
                .au-select-wrap select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }

                .to-section { margin-bottom:24px; }
                .to-card { display:flex; align-items:flex-start; gap:14px; padding:18px 20px; background:linear-gradient(135deg,#f0f9ff,#e0f2fe); border:1.5px solid #bae6fd; border-radius:14px; margin-bottom:18px; }
                .to-card-icon { width:48px; height:48px; border-radius:12px; background:#e0f2fe; display:flex; align-items:center; justify-content:center; color:#0284c7; flex-shrink:0; }
                .to-card-info h3 { font-size:.92rem; font-weight:700; color:#0c4a6e; margin:0 0 4px; }
                .to-card-info p { font-size:.78rem; color:#0369a1; margin:0; line-height:1.4; }
                .to-pickers { display:flex; gap:14px; margin-bottom:16px; }
                .to-picker-group { flex:1; }
                .to-picker-group label { display:block; font-size:.78rem; font-weight:600; color:#374151; margin-bottom:5px; }
                .to-picker-group select { width:100%; padding:9px 14px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:.82rem; outline:none; background:#fff; color:#1f2937; transition:all .2s; font-weight:500; }
                .to-picker-group select:focus { border-color:#0284c7; box-shadow:0 0 0 3px rgba(2,132,199,0.1); }
                .to-sync-btn { width:100%; height:56px; background:linear-gradient(135deg,#0284c7,#0ea5e9); color:#fff; border:none; border-radius:12px; font-weight:700; font-size:.95rem; cursor:pointer; transition:all .25s; display:flex; align-items:center; justify-content:center; gap:8px; }
                .to-sync-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 24px rgba(2,132,199,0.35); }
                .to-sync-btn:disabled { opacity:.7; cursor:default; }

                @media (max-width:768px) {
                    .au-modes { grid-template-columns:1fr; }
                    .au-hdr { flex-direction:column; }
                    .au-support-card { max-width:100%; }
                }
            `}</style>

            <div className="au-page">
                <div className="au-hdr">
                    <div className="au-hdr-l">
                        <div className="au-hdr-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                            </svg>
                        </div>
                        <div className="au-hdr-txt">
                            <h1>Upload Attendance</h1>
                            <p>Upload and manage employee attendance files</p>
                        </div>
                    </div>
                    <div className="au-support-card">
                        <div className="au-sc-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                        </div>
                        <div className="au-sc-info">
                            <strong>Supported format:</strong> Excel (.xlsx, .xls)<br />
                            Make sure your file follows the correct template.
                        </div>
                    </div>
                </div>

                <div className="au-modes">
                    <div className={`au-mode-card ${uploadMode === 'employee' ? 'active' : ''}`} onClick={() => selectMode('employee')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && selectMode('employee')}>
                        <div className="au-mode-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                        </div>
                        <h3>Employee Wise</h3>
                        <p>Upload attendance file for individual employees</p>
                    </div>
                    <div className="au-mode-card" onClick={() => selectMode('download')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && selectMode('download')}>
                        <div className="au-mode-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </div>
                        <h3>Download Template</h3>
                        <p>Download the attendance template for upload</p>
                    </div>
                    <div className={`au-mode-card ${uploadMode === 'bulk' ? 'active' : ''}`} onClick={() => selectMode('bulk')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && selectMode('bulk')}>
                        <div className="au-mode-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                        </div>
                        <h3>Bulk Upload</h3>
                        <p>Upload attendance for all employees at once</p>
                    </div>
                    <div className={`au-mode-card ${uploadMode === 'teamoffice' ? 'active' : ''}`} onClick={() => selectMode('teamoffice')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && selectMode('teamoffice')}>
                        <div className="au-mode-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/>
                            </svg>
                        </div>
                        <h3>Team Office Sync</h3>
                        <p>Import attendance directly from TeamOffice API</p>
                    </div>
                </div>

                {uploadMode === 'employee' && (
                    <div className="au-select-wrap">
                        <label htmlFor="au-employee">Select Employee</label>
                        <select id="au-employee" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                            <option value="">-- Select Employee --</option>
                            {employees.map((emp, index) => (
                                <option key={index} value={emp.emp_code || emp.EmpCode || emp.employeeCode}>
                                    {emp.full_name || emp.FullName || emp.fullName}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {uploadMode === 'teamoffice' && (
                    <div className="to-section">
                        <div className="to-card">
                            <div className="to-card-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/>
                                </svg>
                            </div>
                            <div className="to-card-info">
                                <h3>Sync from Team Office</h3>
                                <p>Select the month and year to import attendance data from your TeamOffice account. The system will fetch and import records for all employees automatically.</p>
                            </div>
                        </div>
                        <div className="to-pickers">
                            <div className="to-picker-group">
                                <label>Month</label>
                                <select value={toSyncMonth} onChange={e => setToSyncMonth(e.target.value)}>
                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                        <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleString('en-US', { month: 'long' })}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="to-picker-group">
                                <label>Year</label>
                                <select value={toSyncYear} onChange={e => setToSyncYear(e.target.value)}>
                                    {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button className="to-sync-btn" onClick={syncTeamOffice} disabled={syncing}>
                            {syncing ? (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:'auSpin 1s linear infinite'}}>
                                        <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                                        <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                                    </svg>
                                    Syncing with Team Office...
                                </>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                    </svg>
                                    Connect with Team Office
                                </>
                            )}
                        </button>
                        {msg && (
                            <div className="au-msg error">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                                {msg}
                                <button className="au-retry" onClick={syncTeamOffice}>Retry</button>
                            </div>
                        )}
                    </div>
                )}

                {uploadMode !== 'teamoffice' && (
                <>
                <div
                    className={`au-dropzone ${dragOver ? 'dragover' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    <div className="au-dropzone-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                    </div>
                    <p>Drag and drop your Excel file here</p>
                    <p className="au-or">or</p>
                    <button className="au-choose-btn" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Choose File
                    </button>
                </div>

                <div className="au-validations">
                    <span className="au-v-ok">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Supported formats: .xlsx, .xls
                    </span>
                    <span className="au-v-ok">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Maximum file size: 10MB
                    </span>
                </div>

                {msg && (
                    <div className="au-msg error">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        {msg}
                        <button className="au-retry" onClick={uploadExcel}>Retry</button>
                    </div>
                )}

                {file && (
                    <div className="au-file-info">
                        <div className="au-fi-l">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            <div>
                                <div className="au-fi-name">{file.name}</div>
                                <div className="au-fi-size">Size: {formatSize(file.size)}</div>
                            </div>
                        </div>
                        <button className="au-file-remove" onClick={removeFile} title="Remove file">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                )}

                <button className="au-import-btn" onClick={uploadExcel} disabled={uploading}>
                    {uploading ? (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:'auSpin 1s linear infinite'}}>
                                <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                                <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                            </svg>
                            Importing Attendance...
                        </>
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            Import Attendance
                        </>
                    )}
                </button>
                </>
                )}

            </div>
        </>
    );
};

export default AttendanceUpload;
