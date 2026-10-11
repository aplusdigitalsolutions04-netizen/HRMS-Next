import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';
import useStatusMaster from '../shared/useStatusMaster';

const hoursToHM = (v) => {
    if (typeof v === 'string' && v.includes(':')) return v;
    const n = Number(v);
    if (!n || isNaN(n)) return '00:00';
    const m = Math.round(n * 60);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};

const UpdateAttendance = () => {
    const navigate = useNavigate();
    const sm = useStatusMaster();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(31);
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
                        workingHours: hoursToHM(d.working_hours),
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

    const behaviorOf = (code) => sm.find('attendance', code).behavior;
    const noPunch = (code) => ['absent', 'week_off', 'holiday'].includes(behaviorOf(code));

    const handleStatusChange = (id, value) => {
        setDays(prevDays => prevDays.map(d => {
            if (d.id === id) {
                let updated = { ...d, status: value };
                if (noPunch(value) || behaviorOf(value) === 'present') {
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

        if (behaviorOf(dayData.status) === 'present') {
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
            if (!res.success) {
                Swal.fire('Error', res.detail || 'Update failed', 'error');
            } else {
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

    const pageDays = paginate(days, page, pageSize);
    useEffect(() => { setPage(1); }, [days.length]);

    return (
        <div className="attendance-update-page">
            <style>{`
                .ua-card { background:#fff; border:1px solid #e8edf6; border-radius:12px; overflow:hidden; }
                .ua-search { display:flex; max-width:440px; border:1px solid #e2e8f0; border-radius:9px; overflow:hidden; background:#fff; }
                .ua-search input { flex:1; border:none; outline:none; height:36px; padding:0 12px; font-size:.84rem; color:#0f172a; background:transparent; }
                .ua-search:focus-within { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
                .ua-search button { border:none; background:#2563eb; color:#fff; font-weight:600; font-size:.82rem; padding:0 16px; cursor:pointer; }
                .ua-search button:disabled { opacity:.6; }
                .ua-head { padding:12px 14px; border-bottom:1px solid #eef2f7; }
                .ua-info { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:10px 14px; border-bottom:1px solid #eef2f7; }
                .ua-chips { display:flex; gap:8px; flex-wrap:wrap; }
                .ua-chip { background:#f1f5f9; border-radius:7px; padding:5px 10px; font-size:.78rem; color:#475569; }
                .ua-chip b { color:#0f172a; }
                .ua-wrap { overflow-x:auto; }
                .ua-t { width:100%; border-collapse:collapse; }
                .ua-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #e8edf6; text-align:left; white-space:nowrap; }
                .ua-t td { padding:7px 12px; vertical-align:middle; color:#334155; font-size:.82rem; border-bottom:1px solid #f4f6fa; white-space:nowrap; }
                .ua-t tbody tr:hover td { background:#f8fbff; }
                .ua-t .num { width:36px; color:#94a3b8; }
                .ua-day { display:inline-block; padding:2px 8px; border-radius:20px; font-size:.68rem; font-weight:700; background:#eef2f7; color:#475569; }
                .ua-day.sun { background:#fee2e2; color:#b91c1c; }
                .ua-time { width:112px; height:30px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; text-align:center; font-family:monospace; font-size:.8rem; padding:0 6px; outline:none; }
                .ua-time:focus { background:#fff; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
                .ua-time:disabled { background:#f1f5f9; color:#94a3b8; }
                .ua-hrs { display:inline-block; min-width:56px; text-align:center; padding:3px 9px; border-radius:7px; background:#f1f5f9; font-family:monospace; font-size:.8rem; font-weight:700; color:#0f172a; }
                .ua-sel { height:30px; min-width:150px; border:1px solid #e2e8f0; border-radius:7px; padding:0 26px 0 9px; font-size:.8rem; font-weight:600; color:#334155; background-color:#f8fafc; cursor:pointer; outline:none; }
                .ua-save { height:30px; padding:0 14px; border:none; border-radius:7px; background:#2563eb; color:#fff; font-weight:600; font-size:.78rem; cursor:pointer; transition:background-color .15s; }
                .ua-save:hover:not(:disabled) { background:#1d4ed8; }
                .ua-save:disabled { opacity:.6; cursor:not-allowed; }
                .ua-t tr.edited-row td { background:#f0fdf4 !important; }
                .ua-t tr.sun-row td { background:#fffbeb; }
                .ua-empty { text-align:center; padding:40px 16px; color:#94a3b8; }
                .ua-empty b { display:block; color:#64748b; font-size:.95rem; margin-top:6px; }
            `}</style>

            <div className="ph">
                <div>
                    <h1>Update Employee Attendance</h1>
                    <p>Search an employee code, then correct in/out times or status for any day.</p>
                </div>
            </div>

            <div className="ua-card">
                <div className="ua-head">
                    <form onSubmit={handleSearch} className="ua-search">
                        <input type="text" placeholder="Enter Employee Code (e.g. EMP-123)" value={searchInput} onChange={e => setSearchInput(e.target.value)} aria-label="Employee code" />
                        <button type="submit" disabled={isFetching}>{isFetching ? 'Searching...' : 'Search'}</button>
                    </form>
                </div>

                {days.length > 0 && (
                    <>
                        <div className="ua-info">
                            <div className="ua-chips">
                                <span className="ua-chip"><b>Code:</b> {empCode}</span>
                                <span className="ua-chip"><b>Name:</b> {employeeName}</span>
                                <span className="ua-chip"><b>Dept:</b> {department}</span>
                            </div>
                            <button type="button" className="btn-o" onClick={() => navigate('/attendance/result')}>&larr; Back to Summary</button>
                        </div>

                        <div className="ua-wrap">
                            <table className="ua-t">
                                <thead>
                                    <tr>
                                        <th className="num">#</th>
                                        <th>Date</th>
                                        <th>Day</th>
                                        <th>IN Time</th>
                                        <th>OUT Time</th>
                                        <th>Working Hrs</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageDays.map((d, idx) => (
                                        <tr key={d.id} className={`${d.dayName === 'Sun' || d.dayName === 'Sunday' ? 'sun-row' : ''} ${editedMap[d.id] ? 'edited-row' : ''}`}>
                                            <td className="num">{(page - 1) * pageSize + idx + 1}</td>
                                            <td>{d.date && !isNaN(d.date) ? d.date.toLocaleDateString('en-GB').replace(/\//g, '-') : ''}</td>
                                            <td><span className={`ua-day${d.dayName === 'Sun' || d.dayName === 'Sunday' ? ' sun' : ''}`}>{d.dayName}</span></td>
                                            <td><input type="time" value={d.inTime} disabled={noPunch(d.status)} onChange={(e) => handleInputChange(d.id, 'inTime', e.target.value)} className="ua-time" /></td>
                                            <td><input type="time" value={d.outTime} disabled={noPunch(d.status)} onChange={(e) => handleInputChange(d.id, 'outTime', e.target.value)} className="ua-time" /></td>
                                            <td><span className="ua-hrs">{d.workingHours}</span></td>
                                            <td>
                                                <select value={d.status} onChange={(e) => handleStatusChange(d.id, e.target.value)} className="ua-sel">
                                                    {!sm.attendance.some(st => st.code === d.status) && <option value={d.status}>{d.status}</option>}
                                                    {sm.attendance.map(st => <option key={st.code} value={st.code}>{st.code} - {st.label}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                <button type="button" className="ua-save" disabled={loadingMap[d.id]} onClick={() => saveRow(d)}>
                                                    {loadingMap[d.id] ? 'Saving...' : 'Update'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '0 14px 12px' }}>
                            <Pagination page={page} totalItems={days.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} pageSizeOptions={[10, 31, 50, 100]} itemLabel="days" />
                        </div>
                    </>
                )}

                {days.length === 0 && !isFetching && (
                    <div className="ua-empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <b>Search for an employee to view and update their attendance</b>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdateAttendance;
