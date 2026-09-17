import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const CandidatesForm = () => {
    const navigate = useNavigate();
    const [mobile, setMobile] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [rawCandidateData, setRawCandidateData] = useState(null);
    const [debounceTimer, setDebounceTimer] = useState(null);
    const [resumeDisabled, setResumeDisabled] = useState(true);
    const [btnUploadDisabled, setBtnUploadDisabled] = useState(true);
    const [btnGetDisabled, setBtnGetDisabled] = useState(true);
    const [btnSaveDisabled, setBtnSaveDisabled] = useState(true);
    const [showCandidateInfo, setShowCandidateInfo] = useState(false);
    const [loaderShow, setLoaderShow] = useState(false);

    const mobilePattern = /^[6-9]\d{9}$/;

    const handleMobileChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setMobile(val);
        setShowCandidateInfo(false);
        setRawCandidateData(null);

        if (debounceTimer) clearTimeout(debounceTimer);

        if (val.length !== 10 || !mobilePattern.test(val)) {
            setResumeDisabled(true);
            setBtnUploadDisabled(true);
            setBtnGetDisabled(true);
            setBtnSaveDisabled(true);
            return;
        }

        const timer = setTimeout(() => {
            fetch(`/api/candidate/check?mobile=${encodeURIComponent(val)}`, {
                headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
            })
                .then(r => r.json())
                .then(res => {
                    if (res.exists && res.data) {
                        Swal.fire("Duplicate Found", "This Mobile already exists!", "warning");
                        setRawCandidateData(res.data);
                        setResumeDisabled(true);
                        setBtnUploadDisabled(true);
                        setBtnGetDisabled(false);
                        setBtnSaveDisabled(true);
                        return;
                    }
                    
                    Swal.fire("New Candidate", "Please upload resume", "info");
                    setRawCandidateData(null);
                    setResumeDisabled(false);
                    setBtnUploadDisabled(false);
                    setBtnGetDisabled(true);
                    setBtnSaveDisabled(true);
                })
                .catch(() => Swal.fire("Server error"));
        }, 400);
        setDebounceTimer(timer);
    };

    const getCandidateDetails = () => {
        if (!rawCandidateData) {
            Swal.fire("No candidate found");
            return;
        }
        setShowCandidateInfo(true);
        setBtnUploadDisabled(true);
        setBtnGetDisabled(true);
        setBtnSaveDisabled(true);
    };

    const uploadAndParseResume = () => {
        if (!resumeFile || !mobile) {
            Swal.fire("Upload resume & enter mobile");
            return;
        }
        const fd = new FormData();
        fd.append("resume", resumeFile);
        fd.append("mobileNumber", mobile);

        setLoaderShow(true);

        fetch('/api/resume/parse', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') },
            body: fd
        })
        .then(res => res.json())
        .then(res => {
            setLoaderShow(false);
            if (res.success && res.data) {
                setRawCandidateData(res.data);
                setShowCandidateInfo(true);
                setBtnUploadDisabled(true);
                setBtnGetDisabled(true);
                setBtnSaveDisabled(false);
            }
            else if (!res.success && res.data) {
                Swal.fire("Duplicate Found", res.message || "Duplicate record found", "warning");
                setRawCandidateData(res.data);
                setResumeDisabled(true);
                setBtnUploadDisabled(true);
                setBtnGetDisabled(false);
                setBtnSaveDisabled(true);
            } else {
                Swal.fire(res.detail || res.message || "Resume parsing failed");
            }
        })
        .catch(() => {
            setLoaderShow(false);
            Swal.fire("Upload failed");
        });
    };

    const saveCandidate = () => {
        if (!rawCandidateData) return;
        setLoaderShow(true);
        
        const payload = { ...rawCandidateData };
        
        // Clean up data that might cause Pydantic 422 errors
        if (!payload.email_id || payload.email_id.toLowerCase() === 'n/a' || !payload.email_id.includes('@')) {
            payload.email_id = null;
        }
        
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!payload.date_of_birth || !dateRegex.test(payload.date_of_birth)) {
            payload.date_of_birth = null;
        }

        fetch('/api/candidate/save', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            },
            body: JSON.stringify(payload)
        })
        .then(async r => {
            const data = await r.json();
            if (!r.ok) {
                const errMsg = data.detail ? (Array.isArray(data.detail) ? data.detail[0].msg : data.detail) : (data.message || "Save failed");
                throw new Error(errMsg);
            }
            return data;
        })
        .then(r => {
            setLoaderShow(false);
            if (r.success) {
                const candId = r.id || '';
                Swal.fire("Success", "Candidate saved successfully", "success")
                    .then(() => {
                        resetForm();
                        navigate(candId ? `/candidates/data?newCandidate=${candId}` : '/candidates/data');
                    });
            } else {
                Swal.fire("Error", r.message || "Unknown error", "error");
            }
        })
        .catch((err) => {
            setLoaderShow(false);
            Swal.fire("Error", err.message || "Save failed", "error");
        });
    };

    const viewResume = () => {
        if (!rawCandidateData || !rawCandidateData.resume_pdf_path) {
            Swal.fire("Resume not available");
            return;
        }
        window.open("/" + rawCandidateData.resume_pdf_path, "_blank");
    };

    const resetForm = () => {
        setMobile('');
        setResumeFile(null);
        document.getElementById("resumeUpload").value = "";
        setResumeDisabled(true);
        setShowCandidateInfo(false);
        setRawCandidateData(null);
        setBtnUploadDisabled(true);
        setBtnGetDisabled(true);
        setBtnSaveDisabled(true);
    };

    return (
        <React.Fragment>
            <style>{`
                .btn-gradient {
                    background: linear-gradient(45deg, #007bff, #00c6ff);
                    border: none;
                    color: white;
                    font-weight: 600;
                    padding: 10px 20px;
                    border-radius: 8px;
                    transition: 0.3s;
                }

                .fancy-btn {
                    cursor: pointer;
                    box-shadow: -5px 15px 30px rgb(17 23 77 / 18%);
                    color: #fff !important;
                    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
                    border: none !important;
                    background-size: 200% 100%;
                    background-position: right bottom;
                    transition: all .5s ease-out;
                    border-radius: 50px;
                }

                .fancy-btn:hover {
                    box-shadow: none;
                    background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
                    background-position: left bottom;
                }

                .btn-gradient:disabled {
                    background: #cccccc;
                    cursor: not-allowed;
                }

                .btn-gradient:hover:not(:disabled) {
                    background: linear-gradient(45deg, #0056b3, #0096c7);
                    transform: scale(1.03);
                    box-shadow: 0px 4px 12px rgba(0,0,0,0.15);
                }

                .form-control:focus {
                    border-color: #00b4d8;
                    box-shadow: 0 0 6px rgba(0, 180, 216, 0.5);
                }
            `}</style>
            
            <div className="animate-in">
                <div className="glass-card p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h4 className="page-title m-0" style={{fontSize: '1.75rem'}}>Add New Candidate</h4>
                        <button className="btn-premium-outline px-4" onClick={() => navigate('/candidates/data')}>
                             Back to Candidate Pool
                        </button>
                    </div>

                    <div className="container mt-4">
                        <div className="row align-items-end g-3">
                            <div className="col-lg-6">
                                <label className="form-label fw-semibold">Mobile Number</label>
                                <input type="text"
                                       id="mobileInput"
                                       className="form-control shadow-sm"
                                       placeholder="Enter 10-digit mobile number"
                                       maxLength="10"
                                       autoComplete="off"
                                       value={mobile}
                                       onChange={handleMobileChange} />
                            </div>

                            <div className="col-lg-6">
                                <label className="form-label fw-semibold">Upload Resume (PDF, Word or Photo)</label>
                                <input type="file"
                                       id="resumeUpload"
                                       className="form-control shadow-sm"
                                       accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                                       onChange={(e) => {
                                           setResumeFile(e.target.files[0]);
                                           if (mobile.length === 10) setBtnUploadDisabled(false);
                                       }} />
                            </div>
                        </div>

                        <div className="row mt-3">
                            <div className="col-lg-12 d-grid">
                                <button id="btnUploadResume"
                                        onClick={uploadAndParseResume}
                                        className="btn btn-primary fancy-btn"
                                        disabled={btnUploadDisabled}>
                                    <i className="bi bi-upload"></i> Upload & Parse Resume
                                </button>
                            </div>
                        </div>
                    </div>

                    <hr />

                    <div id="candidateInfo" style={{ display: showCandidateInfo ? 'flex' : 'none' }} className="row">
                        <div className="col-lg-12">
                            <h5>Extracted Candidate Information</h5>

                            <div className="mt-3">
                                <table className="table table-bordered">
                                    <tbody>
                                        <tr>
                                            <th width="25%">Candidate Name</th>
                                            <td width="25%" id="candidateName">{rawCandidateData?.candidate_name || ""}</td>
                                            <th width="25%">Mobile Number</th>
                                            <td width="25%" id="contactNumber">{rawCandidateData?.contact_number || ""}</td>
                                        </tr>
                                        <tr>
                                            <th>Email ID</th>
                                            <td id="emailId">{rawCandidateData?.email_id || ""}</td>
                                            <th>Date of Birth</th>
                                            <td id="dob">{rawCandidateData?.date_of_birth || ""}</td>
                                        </tr>
                                        <tr>
                                            <th>Qualification</th>
                                            <td id="qualification">{rawCandidateData?.qualification || ""}</td>
                                            <th>Work Experience</th>
                                            <td id="experience">{rawCandidateData?.work_experience || ""}</td>
                                        </tr>
                                        <tr>
                                            <th>Location</th>
                                            <td id="location">{rawCandidateData?.location || ""}</td>
                                            <th>Skills</th>
                                            <td id="skills">{rawCandidateData?.skills || ""}</td>
                                        </tr>
                                        <tr>
                                            <th>Career Objective</th>
                                            <td colSpan="3" id="careerObjective">{rawCandidateData?.career_objective || ""}</td>
                                        </tr>
                                        <tr>
                                            <th>Certificates</th>
                                            <td colSpan="3" id="certificates">{rawCandidateData?.certificates || ""}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-3 d-flex justify-content-between">
                                <button className="btn btn-secondary fancy-btn" onClick={viewResume}>
                                    <i className="bi bi-file-earmark-pdf"></i> View PDF
                                </button>

                                <button id="btnSaveCandidate"
                                        onClick={saveCandidate}
                                        className="btn btn-success fancy-btn"
                                        disabled={btnSaveDisabled}>
                                    Save Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loaderShow && (
                <div id="loader" style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(255,255,255,0.7)', zIndex: 9999, textAlign: 'center', paddingTop: '20%'
                }}>
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 fw-semibold">Please wait...</p>
                </div>
            )}
        </React.Fragment>
    );
};

export default CandidatesForm;

