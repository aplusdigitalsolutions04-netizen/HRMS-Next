import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const CandidateView = () => {
    const { id } = useParams();
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetch(`/api/candidate/details/${id}`, {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            })
                .then(res => res.json())
                .then(data => {
                    setCandidate(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch candidate profile", err);
                    setLoading(false);
                });
        }
    }, [id]);

    const displayValue = (val) => {
        if (val === null || val === undefined || String(val).trim() === '') {
            return "NA";
        }
        return val;
    };

    const displayDate = (date) => {
        if (!date) return "NA";
        const d = new Date(date);
        if (isNaN(d)) return "NA";
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };
    
    const naClass = (val) => {
        if (val === null || val === undefined || String(val).trim() === '') {
            return "value na";
        }
        return "value";
    };

    const naClassDate = (date) => {
        if (!date) return "value na";
        const d = new Date(date);
        if (isNaN(d)) return "value na";
        return "value";
    };

    if (loading) {
        return <div style={{ padding: '20px' }}>Loading...</div>;
    }

    if (!candidate) {
        return <div style={{ padding: '20px' }}>Candidate not found</div>;
    }

    return (
        <React.Fragment>
            <style>{`
                .candidate-page {
                    padding: 20px;
                    background: #f5f6fa;
                    min-height: calc(100vh - 40px);
                }
                .candidate-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .candidate-content {
                    background: #fff;
                    border-radius: 14px;
                    padding: 30px;
                }
                .section-title {
                    color: #0d6efd;
                    font-weight: 700;
                    margin: 24px 0 14px;
                    border-bottom: 1px solid #e5e7eb;
                    padding-bottom: 6px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 16px;
                }
                .label {
                    font-weight: 600;
                    color: #555;
                    margin-bottom: 4px;
                }
                .value {
                    background: #f8f9fa;
                    padding: 8px 10px;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .value.na {
                    color: #dc3545;
                    font-weight: 600;
                    background: transparent;
                    padding: 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    padding: 12px;
                    border-bottom: 1px solid #eee;
                    font-size: 14px;
                }
                th {
                    background: #f1f3f5;
                    font-weight: 600;
                }
                .action-btns {
                    display: flex;
                    gap: 10px;
                }
                .icon-btn {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: none;
                    background: #f1f3f5;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    color: #333;
                }
                .icon-btn:hover {
                    background: #0d6efd;
                    color: #fff;
                }
                .icon-btn.close:hover {
                    background: #dc3545;
                }
            `}</style>
            
            <div className="candidate-page">
                <div className="candidate-header">
                    <h3 className="mb-0">👤 Candidate Profile</h3>
                    <div className="action-btns">
                        <Link to="/candidates/data" className="icon-btn close">
                            ⬅ Back
                        </Link>
                        <a className="icon-btn"
                           href={`/${candidate.resume_pdf_path}`}
                           download
                           title="Download Resume">
                            ⬇ Resume
                        </a>
                    </div>
                </div>

                <div className="candidate-content">
                    <div className="section-title">Personal Information</div>
                    
                    <div className="info-grid">
                        <div>
                            <div className="label">Name</div>
                            <div className="value">{candidate.candidate_name}</div>
                        </div>
                        <div>
                            <div className="label">Mobile</div>
                            <div className="value">{candidate.contact_number}</div>
                        </div>
                        <div>
                            <div className="label">Email</div>
                            <div className={naClass(candidate.email_id)}>
                                {displayValue(candidate.email_id)}
                            </div>
                        </div>
                        <div>
                            <div className="label">DOB</div>
                            <div className={naClassDate(candidate.date_of_birth)}>
                                {displayDate(candidate.date_of_birth)}
                            </div>
                        </div>
                        <div>
                            <div className="label">Location</div>
                            <div className={naClass(candidate.location)}>
                                {displayValue(candidate.location)}
                            </div>
                        </div>
                        <div>
                            <div className="label">Qualification</div>
                            <div className={naClass(candidate.qualification)}>
                                {displayValue(candidate.qualification)}
                            </div>
                        </div>
                        <div>
                            <div className="label">Experience</div>
                            <div className={naClass(candidate.work_experience)}>
                                {displayValue(candidate.work_experience)}
                            </div>
                        </div>
                        <div>
                            <div className="label">Skills</div>
                            <div className={naClass(candidate.skills)}>
                                {displayValue(candidate.skills)}
                            </div>
                        </div>
                        <div>
                            <div className="label">Certificates</div>
                            <div className={naClass(candidate.certificates)}>
                                {displayValue(candidate.certificates)}
                            </div>
                        </div>
                    </div>

                    <div className="section-title">Interview History</div>

                    <table>
                        <thead>
                            <tr>
                                <th>Round</th>
                                <th>Date</th>
                                <th>Mode</th>
                                <th>Status</th>
                                <th>Remarks</th>
                                <th>Comments</th>
                            </tr>
                        </thead>
                        <tbody>
                            {candidate.interviews && candidate.interviews.length > 0 ? (
                                candidate.interviews.map((i, index) => (
                                    <tr key={index}>
                                        <td>{i.interview_round}</td>
                                        <td>{displayDate(i.interview_date)}</td>
                                        <td>{i.interview_mode}</td>
                                        <td>{i.status}</td>
                                        <td>{i.remarks}</td>
                                        <td>{i.comments}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center text-muted">
                                        No interview records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </React.Fragment>
    );
};

export default CandidateView;
