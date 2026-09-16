import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { openEmployeeDocument } from '@/lib/clientDocs';

const EmployeeDetail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { id } = useParams();
    const fromPending = searchParams.get('fromPending') === 'true';

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);

    const openDoc = (field) => openEmployeeDocument(employee.id, field);

    useEffect(() => {
        if (id) {
            fetch(`/api/employee/detail/${id}`, {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
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
                'Authorization': 'Bearer ' + localStorage.getItem('token')
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
                'Authorization': 'Bearer ' + localStorage.getItem('token')
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

    return (
        <div className="emp-detail-page">
            <style>{`
                /* PAGE */
                .emp-detail-page {
                    background: #f5f6fa;
                    min-height: 100vh;
                    padding: 10px 15px;
                }
                /* REMOVE BOOTSTRAP CONTAINER EXTRA SPACE */
                .emp-detail-page .container-fluid {
                    padding-top: 0;
                }
                /* CARD */
                .emp-detail-card {
                    background: #fff;
                    border-radius: 14px;
                    box-shadow: 0 6px 25px rgba(0,0,0,.08);
                    padding: 20px;
                    margin-top: 0;
                }
                .section-title {
                    font-weight: 600;
                    color: #0d6efd;
                    margin-bottom: 10px;
                }
                .doc-link {
                    display: block;
                    margin-bottom: 6px;
                    text-decoration: none;
                }
                .doc-link:hover {
                    text-decoration: underline;
                }
                /* ===== COMMON HRMS GRADIENT BUTTON ===== */
                .hrms-btn {
                    cursor: pointer;
                    box-shadow: -5px 15px 30px rgb(17 23 77 / 18%);
                    color: #fff !important;
                    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
                    border: none !important;
                    background-size: 200% 100%;
                    background-position: right bottom;
                    transition: all .5s ease-out;
                    border-radius: 10px;
                    padding: 8px 14px;
                    font-size: 14px;
                    font-weight: 600;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .hrms-btn:hover {
                    box-shadow: none;
                    background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
                    background-position: left bottom;
                    color: #fff;
                    text-decoration: none;
                }
                /* ===== CLOSE BUTTON SIZE ===== */
                .close-btn {
                    min-width: 40px;
                }
            `}</style>

            <div className="container-fluid p-0">
                <div className="emp-detail-card">
                    {/* HEADER */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h4 className="mb-0">Employee Full Details</h4>
                        <button
                            type="button"
                            className="hrms-btn px-4"
                            onClick={() => fromPending ? navigate('/employees/pending') : navigate(-1)}
                        >
                            ← Back
                        </button>
                    </div>

                    {/* DETAILS */}
                    <div className="row">
                        {/* PERSONAL */}
                        <div className="col-md-6">
                            <h6 className="section-title">Personal Details</h6>
                            <p><b>Name:</b> {employee.full_name}</p>
                            <p><b>Father / Spouse:</b> {employee.father_spouse_name}</p>
                            <p><b>DOB:</b> {employee.dob ? new Date(employee.dob).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}</p>
                            <p><b>Email:</b> {employee.email_id}</p>
                            <p><b>Mobile:</b> {employee.mobile_no}</p>
                            <p><b>Alternate:</b> {employee.alternate_mobile_no}</p>
                            <p><b>Present Address:</b> {employee.present_address}</p>
                            <p><b>Permanent Address:</b> {employee.permanent_address}</p>
                        </div>

                        {/* EDUCATION */}
                        <div className="col-md-6">
                            <h6 className="section-title">Education / Work</h6>
                            <p><b>College:</b> {employee.college_name}</p>
                            <p><b>Course:</b> {employee.course_name}</p>
                            <p><b>Specialization:</b> {employee.specialization}</p>
                            <p><b>Duration:</b> {employee.course_duration}</p>
                            <p><b>CGPA:</b> {employee.cgpa}</p>
                            <p><b>Company:</b> {employee.previous_company}</p>
                            <p><b>Designation:</b> {employee.designation}</p>
                        </div>
                    </div>

                    <hr className="my-3" />

                    {/* DOCUMENTS */}
                    <h6 className="section-title">Uploaded Documents</h6>
                    <div className="row g-3">
                        {employee.identity_proof && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('identity_proof'); }}> Identity Proof</a></div>}
                        {employee.resume_path && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('resume_path'); }}>Latest Resume</a></div>}
                        {employee.marksheet10 && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('marksheet10'); }}>10th Marksheet</a></div>}
                        {employee.marksheet12 && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('marksheet12'); }}> 12th Marksheet</a></div>}
                        {employee.ug_document && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('ug_document'); }}> UG Degree</a></div>}
                        {employee.pg_document && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('pg_document'); }}> PG Degree</a></div>}
                        {employee.offer_letter && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('offer_letter'); }}> Offer Letter</a></div>}
                        {employee.address_proof && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('address_proof'); }}> Address Proof</a></div>}
                        {employee.appointment_letter && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('appointment_letter'); }}>Appointment Letter</a></div>}
                        {employee.internship_certificate && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('internship_certificate'); }}> Internship Certificate</a></div>}
                        {employee.photograph && <div className="col-md-4"><a className="doc-link" href="#" onClick={(e) => { e.preventDefault(); openDoc('photograph'); }}> Photograph</a></div>}
                    </div>

                    {fromPending && (
                        <>
                            <hr className="my-3" />
                            <div className="d-flex justify-content-between">
                                <button className="hrms-btn px-5" onClick={rejectEmployee}>Reject</button>
                                <button className="hrms-btn px-5" onClick={approveEmployee}> Approve</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetail;

