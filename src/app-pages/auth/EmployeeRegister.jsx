import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmployeeRegister() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        emp_code: '', email_id: '', full_name: '', father_spouse_name: '', dob: '',
        present_address: '', permanent_address: '', mobile_no: '', alternate_mobile_no: '',
        date_of_joining: '', account_number: '', bank_name: '', pan: '', location: 'Gurgaon, HR'
    });

    const [files, setFiles] = useState({});
    const [sameAddress, setSameAddress] = useState(false);
    const [addressError, setAddressError] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            if (name === 'present_address') {
                setAddressError(false);
                if (sameAddress) updated.permanent_address = value;
            }
            return updated;
        });
    };

    const handleSameAddressToggle = (e) => {
        const checked = e.target.checked;
        if (checked && !formData.present_address.trim()) {
            setAddressError(true);
            setSameAddress(false);
            return;
        }
        setSameAddress(checked);
        if (checked) {
            setFormData(prev => ({ ...prev, permanent_address: prev.present_address }));
        }
    };

    const validateFile = (e, type) => {
        const fileList = Array.from(e.target.files);
        if (fileList.length === 0) return;

        let validFiles = [];
        for (let file of fileList) {
            if (type === 'pdf') {
                const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
                if (!allowedTypes.includes(file.type)) {
                    alert("Only PDF or Photo files (JPG/PNG) are allowed for documents.");
                    e.target.value = "";
                    return;
                }
                if (file.size > 2 * 1024 * 1024) {
                    alert("PDF file size must be 2 MB or less.");
                    e.target.value = "";
                    return;
                }
            } else if (type === 'photo') {
                const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
                if (!allowedTypes.includes(file.type)) {
                    alert("Photo must be in JPG, JPEG, or PNG format only.");
                    e.target.value = "";
                    return;
                }
                if (file.size > 100 * 1024) {
                    alert("Photo size must be 100 KB or less.");
                    e.target.value = "";
                    return;
                }
            } else if (type === 'bank_doc') {
                const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
                if (!allowedTypes.includes(file.type)) {
                    alert("Bank Document must be in PDF, JPG, JPEG, or PNG format.");
                    e.target.value = "";
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    alert("Document size must be 5 MB or less.");
                    e.target.value = "";
                    return;
                }
            }
            validFiles.push(file);
        }
        
        if (e.target.multiple) {
            setFiles(prev => ({ ...prev, [e.target.name]: validFiles }));
        } else {
            setFiles(prev => ({ ...prev, [e.target.name]: validFiles[0] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = new FormData();
        Object.keys(formData).forEach(key => data.append(key, formData[key]));
        Object.keys(files).forEach(key => {
            if (Array.isArray(files[key])) {
                files[key].forEach(f => data.append(key, f));
            } else {
                data.append(key, files[key]);
            }
        });
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/employee/register', {
                method: 'POST',
                headers: token ? { 'Authorization': 'Bearer ' + token } : {},
                body: data
            });
            const result = await res.json();
            if (res.ok) {
                alert("Employee registered successfully!");
                navigate('/employees/manage');
            } else {
                alert(result.detail || result.error || "Error registering employee.");
            }
        } catch (err) {
            alert("Failed to connect to the server: " + err.message);
        }
    };

    const s = {
        field: { marginBottom: 16 },
        label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
        star: { color: '#ef4444' },
        input: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' },
        textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', background: '#fff' },
        inputGroup: { display: 'flex', alignItems: 'stretch' },
        inputGroupText: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRight: 'none', borderRadius: '10px 0 0 10px', fontSize: 14, color: '#64748b', background: '#f8fafc' },
        inputGroupInput: { flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '0 10px 10px 0', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
        sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginTop: 28, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #eef2ff', fontFamily: "'Outfit', sans-serif" },
        fileInput: { width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fafbfc' },
        fileLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
        checkLabel: { fontSize: 12, color: '#64748b', cursor: 'pointer', userSelect: 'none' },
        submitBtn: { width: '50%', padding: '12px 24px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 24 },
        backBtn: { padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
        errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
        grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
        grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
        gridFull: { gridColumn: '1 / -1' },
    };

    const inputStyle = (readonly) => ({ ...s.input, ...(readonly ? { background: '#f8fafc', color: '#94a3b8' } : {}) });

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f0ff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #eef2ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button type="button" style={s.backBtn} onClick={() => navigate(-1)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}><polyline points="15 18 9 12 15 6"/></svg>
                            Back
                        </button>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: "'Outfit', sans-serif" }}>Add New Employee</h2>
                    </div>
                </div>

                <form onSubmit={handleSubmit} encType="multipart/form-data">
                    <div style={s.grid2}>
                        <div style={{...s.field, ...s.gridFull}}>
                            <label style={s.label}>Employee ID <span style={{fontSize: 11, color: '#64748b', fontWeight: 400}}>(Leave empty to auto-generate)</span></label>
                            <input type="text" style={s.input} name="emp_code" value={formData.emp_code} onChange={handleInputChange} placeholder="e.g. 0001" />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Email ID<span style={s.star}>*</span></label>
                            <input type="email" style={s.input} name="email_id" value={formData.email_id} onChange={handleInputChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Full Name<span style={s.star}>*</span></label>
                            <input type="text" style={s.input} name="full_name" value={formData.full_name} onChange={handleInputChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Father's / Spouse Name<span style={s.star}>*</span></label>
                            <input type="text" style={s.input} name="father_spouse_name" value={formData.father_spouse_name} onChange={handleInputChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Date of Birth<span style={s.star}>*</span></label>
                            <input type="date" style={s.input} name="dob" value={formData.dob} onChange={handleInputChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Present Address<span style={s.star}>*</span></label>
                            <textarea style={s.textarea} rows="2" name="present_address" value={formData.present_address} onChange={handleInputChange} required></textarea>
                            {addressError && <div style={s.errorText}>Please enter Present Address first.</div>}
                        </div>
                        <div style={s.field}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <label style={s.label}>Permanent Address<span style={s.star}>*</span></label>
                                <label style={s.checkLabel}>
                                    <input type="checkbox" checked={sameAddress} onChange={handleSameAddressToggle} style={{ marginRight: 4 }} />
                                    Same as Present
                                </label>
                            </div>
                            <textarea style={{ ...s.textarea, ...(sameAddress ? { background: '#f8fafc', color: '#94a3b8' } : {}) }} rows="2" name="permanent_address" value={formData.permanent_address} onChange={handleInputChange} readOnly={sameAddress} required></textarea>
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Mobile Number<span style={s.star}>*</span></label>
                            <div style={s.inputGroup}>
                                <span style={s.inputGroupText}>+91</span>
                                <input type="text" style={s.inputGroupInput} name="mobile_no" value={formData.mobile_no} onChange={handleInputChange} maxLength="10" pattern="[0-9]{10}" required />
                            </div>
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Alternate Mobile<span style={s.star}>*</span></label>
                            <div style={s.inputGroup}>
                                <span style={s.inputGroupText}>+91</span>
                                <input type="text" style={s.inputGroupInput} name="alternate_mobile_no" value={formData.alternate_mobile_no} onChange={handleInputChange} maxLength="10" pattern="[0-9]{10}" required />
                            </div>
                        </div>
                    </div>

                    <div style={s.sectionTitle}>Bank Details</div>
                    <div style={s.grid3}>
                        <div style={s.field}>
                            <label style={s.label}>Date of Joining</label>
                            <input type="date" style={s.input} name="date_of_joining" value={formData.date_of_joining} onChange={handleInputChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Account No.</label>
                            <input style={s.input} name="account_number" value={formData.account_number} onChange={handleInputChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Bank Name</label>
                            <input style={s.input} name="bank_name" value={formData.bank_name} onChange={handleInputChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>PAN</label>
                            <input style={s.input} name="pan" value={formData.pan} onChange={handleInputChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Location</label>
                            <input style={s.input} name="location" value={formData.location} onChange={handleInputChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.fileLabel}>🏦 Bank Document (PDF/Photo, Max 5MB)</label>
                            <input type="file" name="BankDocument" accept="application/pdf,image/jpeg,image/jpg,image/png" onChange={(e) => validateFile(e, 'bank_doc')} style={s.fileInput} />
                        </div>
                    </div>

                    <div style={s.sectionTitle}>Upload Documents</div>
                    <div style={s.grid3}>
                        {[
                            { name: 'IdentityProof', label: '🪪 Identity Proof', type: 'pdf' },
                            { name: 'AddressProof', label: '🏠 Address Proof', type: 'pdf' },
                            { name: 'Resume', label: '📄 Resume', type: 'pdf' },
                            { name: 'UGDegree', label: '🎓 UG Degree', type: 'pdf' },
                            { name: 'Marksheet10', label: '📘 10th Marksheet', type: 'pdf' },
                            { name: 'Marksheet12', label: '📗 12th Marksheet', type: 'pdf' },
                            { name: 'OfferLetter', label: '📜 Offer Letter', type: 'pdf' },
                            { name: 'PGDegree', label: '🎓 PG Degree', type: 'pdf' },
                            { name: 'AppointmentLetter', label: '📃 Appointment Letter', type: 'pdf' },
                            { name: 'InternshipCertificate', label: '🏅 Internship Certificate', type: 'pdf' },
                            { name: 'Photograph', label: '📷 Photograph (JPG/PNG)', type: 'photo' },
                        ].map(doc => (
                            <div key={doc.name} style={s.field}>
                                <label style={s.fileLabel}>{doc.label}</label>
                                <input type="file" name={doc.name} accept={doc.type === 'pdf' ? 'application/pdf,image/jpeg,image/jpg,image/png' : 'image/jpeg,image/jpg,image/png'} onChange={(e) => validateFile(e, doc.type)} style={s.fileInput} />
                            </div>
                        ))}
                        <div style={s.field}>
                            <label style={s.fileLabel}>📁 Additional Documents (PDF/Photo)</label>
                            <input type="file" name="AdditionalDocuments" multiple accept="application/pdf,image/jpeg,image/jpg,image/png" onChange={(e) => validateFile(e, 'bank_doc')} style={s.fileInput} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button type="submit" style={s.submitBtn}>Submit Registration</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
