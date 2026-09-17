import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';

const UpdateAttendance = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const [searchInput, setSearchInput] = useState(searchParams.get('emp_code') || searchParams.get('empCode') || '');
    const [empCode, setEmpCode] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [department, setDepartment] = useState('');
    const [days, setDays] = useState([]);
    const [loadingMap, setLoadingMap] = useState({});
    const [editedMap, setEditedMap] = useState({});
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        const code = searchParams.get('emp_code') || searchParams.get('empCode');
        if (code) {
            setSearchInput(code);
            fetchAttendance(code);
        }
    }, [searchParams]);

    const fetchAttendance = (code) => {
        setIsFetching(true);
        fetch(`/api/attendance/daywise?emp_code=${code}`, {
            headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
        })
            .then(res => res.json())
            .then(data => {
                if (data.days && data.days.length > 0) {
                    setEmpCode(data.emp_code || code);
                    setEmployeeName(data.full_name || 'Unknown');
                    setDepartment(data.department || 'Unknown');
                    
                    const mappedDays = data.days.map(d => ({
                        id: (d.id || '').toString().replace(/-/g, ''),
                        originalId: d.id,
                        date: d.attendance_date ? new Date(d.attendance_date) : null,
                        dayName: d.day || '',
                        inTime: (d.in_time === '--:--') ? '' : (d.in_time || ''),
                        outTime: (d.out_time === '--:--') ? '' : (d.out_time || ''),
                        workingHours: d.working_hours || '00:00',
                        status: d.status || 'P'
                    }));
                    setDays(mappedDays);
                } else {
                    setDays([]);
                    Swal.fire('Not Found', 'No attendance records found for this employee.', 'info');
                }
            })
            .catch(err => {
                console.error("Failed to load attendance details", err);
                Swal.fire('Error', 'Failed to fetch data.', 'error');
            })
            .finally(() => setIsFetching(false));
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchInput.trim()) return;
        setSearchParams({ emp_code: searchInput.trim() });
    };

    const calculateHours = (inTime, outTime) => {
        if (!inTime || !outTime || inTime === '--:--' || outTime === '--:--' || inTime === '' || outTime === '') {
            return '00:00';
        }

        const [inH, inM] = inTime.split(':').map(Number);
        const [outH, outM] = outTime.split(':').map(Number);

        if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return '00:00';

        let inMinutes = inH * 60 + inM;
        let outMinutes = outH * 60 + outM;

        if (outMinutes < inMinutes) {
            outMinutes += 24 * 60; // cross-day
        }

        let diff = outMinutes - inMinutes;
        let hrs = Math.floor(diff / 60);
        let mins = diff % 60;

        return (hrs < 10 ? '0' : '') + hrs + ':' + (mins < 10 ? '0' : '') + mins;
    };

    const handleInputChange = (id, field, value) => {
        setDays(prevDays => prevDays.map(d => {
            if (d.id === id) {
                let updated = { ...d, [field]: value };
                if (field === 'inTime' || field === 'outTime') {
                    updated.workingHours = calculateHours(updated.inTime, updated.outTime);
                }
                return updated;
            }
            return d;
        }));
    };

    const handleStatusChange = (id, value) => {
        setDays(prevDays => prevDays.map(d => {
            if (d.id === id) {
                let updated = { ...d, status: value };
                if (value === 'A' || value === 'WO') {
                    updated.inTime = '';
                    updated.outTime = '';
                    updated.workingHours = '00:00';
                } else if (value === 'P') {
                    updated.inTime = '';
                    updated.outTime = '';
                    updated.workingHours = '00:00';
                }
                return updated;
            }
            return d;
        }));
    };

    const saveRow = (dayData) => {
        setLoadingMap(prev => ({ ...prev, [dayData.id]: true }));

        if (dayData.status === 'P') {
            if (!dayData.inTime || !dayData.outTime || dayData.inTime === '--:--' || dayData.outTime === '--:--') {
                Swal.fire('Required', 'IN & OUT time mandatory for Present', 'warning');
                setLoadingMap(prev => ({ ...prev, [dayData.id]: false }));
                return;
            }
        }

        const formData = new URLSearchParams();
        formData.append('attendance_id', dayData.originalId);
        formData.append('in_time', dayData.inTime);
        formData.append('out_time', dayData.outTime);
        formData.append('status', dayData.status);

        fetch('/api/attendance/update_row', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            },
            body: formData.toString()
        })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                setEditedMap(prev => ({ ...prev, [dayData.id]: true }));
                Swal.fire({
                    icon: 'success',
                    title: 'Saved',
                    text: 'Attendance updated successfully',
                    timer: 1200,
                    showConfirmButton: false
                });
            }
        })
        .catch(err => {
            Swal.fire('Error', 'Update failed', 'error');
        })
        .finally(() => {
            setLoadingMap(prev => ({ ...prev, [dayData.id]: false }));
        });
    };

    return (
        <div className="attendance-update-page container-fluid mt-4">
            <style>
                {`
                /* Basic Page Setup */
                .attendance-update-page {
                    padding-bottom: 40px;
                }
                
                /* Main Card */
                .update-card {
                    background: #fff;
                    border-radius: 16px;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.08);
                    overflow: hidden;
                    border: 1px solid #edf2f7;
                }

                /* Search Header */
                .search-header {
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    padding: 24px;
                    border-bottom: 1px solid #e2e8f0;
                }

                .search-input-group {
                    max-width: 500px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    border-radius: 10px;
                    overflow: hidden;
                }
                .search-input-group input {
                    border: none;
                    padding: 12px 20px;
                    font-size: 1rem;
                }
                .search-input-group input:focus {
                    box-shadow: none;
                    outline: none;
                }
                .search-input-group button {
                    background: var(--primary);
                    color: white;
                    border: none;
                    padding: 0 24px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }
                .search-input-group button:hover {
                    background: var(--primary-hover);
                }

                /* Info Strip */
                .info-strip {
                    background: white;
                    padding: 16px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #edf2f7;
                }
                .info-badge {
                    background: #f1f5f9;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    color: #475569;
                    font-weight: 500;
                }
                .info-badge b {
                    color: #0f172a;
                }

                /* Table Styling */
                .table-container {
                    padding: 0;
                    overflow-x: auto;
                }
                
                .daywise-table {
                    margin-bottom: 0;
                    border-color: #edf2f7;
                }
                
                .daywise-table th {
                    background: #f8fafc;
                    color: #475569;
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    letter-spacing: 0.05em;
                    padding: 16px;
                    border-bottom: 2px solid #e2e8f0;
                }
                
                .daywise-table td {
                    padding: 12px 16px;
                    vertical-align: middle;
                    color: #334155;
                    font-weight: 500;
                }

                /* Input & Select Controls */
                .time-input {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    text-align: center;
                    font-family: monospace;
                    font-size: 0.9rem;
                    padding: 6px 12px;
                    transition: all 0.2s;
                }
                .time-input:focus {
                    background: #fff;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px var(--primary-light);
                    outline: none;
                }
                .time-input:disabled {
                    background: #f1f5f9;
                    color: #94a3b8;
                }

                .status-select {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-weight: 600;
                    color: #334155;
                    cursor: pointer;
                }

                /* Action Button */
                .update-btn {
                    background: var(--primary);
                    color: white;
                    border: none;
                    padding: 6px 16px;
                    border-radius: 6px;
                    font-weight: 600;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .update-btn:hover:not(:disabled) {
                    background: var(--primary-hover);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);
                }
                .update-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* Row Highlights */
                .edited-row td {
                    background-color: #f0fdf4 !important;
                    border-bottom-color: #bbf7d0 !important;
                }
                .sun-row td {
                    background-color: #fffbeb !important;
                }
                .sat-row td {
                    background-color: #f8fafc !important;
                }
                `}
            </style>

            <div className="update-card">
                {/* Search Header */}
                <div className="search-header">
                    <h4 className="mb-3" style={{ fontWeight: 700, color: '#0f172a' }}>Update Employee Attendance</h4>
                    <form onSubmit={handleSearch} className="search-input-group d-flex">
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Enter Employee Code (e.g. EMP-123)"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                        />
                        <button type="submit" disabled={isFetching}>
                            {isFetching ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                </div>

                {/* Data Section */}
                {days.length > 0 && (
                    <>
                        <div className="info-strip flex-wrap gap-2">
                            <div className="d-flex gap-3">
                                <span className="info-badge"><b>Code:</b> {empCode}</span>
                                <span className="info-badge"><b>Name:</b> {employeeName}</span>
                                <span className="info-badge"><b>Dept:</b> {department}</span>
                            </div>
                            <button className="btn btn-outline-secondary btn-sm rounded-pill px-4 fw-bold" onClick={() => navigate('/attendance/result')}>
                                Back to Summary
                            </button>
                        </div>

                        <div className="table-container">
                            <table className="table daywise-table table-hover">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Day</th>
                                        <th style={{ width: '120px' }}>IN Time</th>
                                        <th style={{ width: '120px' }}>OUT Time</th>
                                        <th>Working Hrs</th>
                                        <th style={{ width: '130px' }}>Status</th>
                                        <th style={{ width: '120px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {days.map(d => (
                                        <tr key={d.id} className={`${d.dayName === 'Sun' ? 'sun-row' : d.dayName === 'Sat' ? 'sat-row' : ''} ${editedMap[d.id] ? 'edited-row' : ''}`}>
                                            <td>{d.date && !isNaN(d.date) ? d.date.toLocaleDateString('en-GB').replace(/\//g, '-') : ''}</td>
                                            <td>
                                                <span className={`badge ${d.dayName === 'Sun' ? 'bg-danger' : 'bg-secondary'}`}>
                                                    {d.dayName}
                                                </span>
                                            </td>
                                            <td>
                                                <input 
                                                    type="time"
                                                    value={d.inTime}
                                                    disabled={d.status === 'A' || d.status === 'WO'}
                                                    onChange={(e) => handleInputChange(d.id, 'inTime', e.target.value)}
                                                    className="time-input w-100" 
                                                />
                                            </td>
                                            <td>
                                                <input 
                                                    type="time"
                                                    value={d.outTime}
                                                    disabled={d.status === 'A' || d.status === 'WO'}
                                                    onChange={(e) => handleInputChange(d.id, 'outTime', e.target.value)}
                                                    className="time-input w-100" 
                                                />
                                            </td>
                                            <td className="text-center">
                                                <span className="badge bg-light text-dark border px-3 py-2 fs-6">
                                                    {d.workingHours}
                                                </span>
                                            </td>
                                            <td>
                                                <select 
                                                    value={d.status}
                                                    onChange={(e) => handleStatusChange(d.id, e.target.value)}
                                                    className="form-select status-select"
                                                >
                                                    <option value="P">P (Present)</option>
                                                    <option value="A">A (Absent)</option>
                                                    <option value="WO">WO (Week Off)</option>
                                                    <option value="CL">CL</option>
                                                    <option value="CL/2">CL/2</option>
                                                    <option value="NH">NH</option>
                                                    <option value="WFH">WFH</option>
                                                    <option value="UPL">UPL</option>
                                                </select>
                                            </td>
                                            <td>
                                                <button 
                                                    type="button" 
                                                    className="update-btn w-100"
                                                    disabled={loadingMap[d.id]}
                                                    onClick={() => saveRow(d)}
                                                >
                                                    {loadingMap[d.id] ? 'Saving...' : '💾 Update'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
                
                {days.length === 0 && !isFetching && (
                    <div className="p-5 text-center text-muted">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                        <h5>Search for an employee to view and update their attendance</h5>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdateAttendance;
