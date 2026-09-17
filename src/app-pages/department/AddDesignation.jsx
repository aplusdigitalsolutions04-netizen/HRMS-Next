import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Swal from 'sweetalert2';

const AddDesignation = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [departmentId, setDepartmentId] = useState('');
  const [designationName, setDesignationName] = useState('');
  const [description, setDescription] = useState('');
  const [departments, setDepartments] = useState([]);

  const isEdit = id && id !== '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    // Fetch departments for dropdown
    fetch('/api/departments/', {
      headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
    })
      .then(res => res.json())
      .then(data => setDepartments(data || []))
      .catch(err => console.error(err));

    // If edit, fetch designation details
    if (isEdit) {
      fetch(`/api/designations/${id}`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
      })
        .then(res => res.json())
        .then(data => {
          setDepartmentId(data.department_id || '');
          setDesignationName(data.name || '');
          setDescription(data.description || '');
        })
        .catch(err => console.error(err));
    }
  }, [id, isEdit]);

  const saveDesignation = () => {
    if (!departmentId || !designationName.trim() || !description.trim()) {
      Swal.fire("Validation", "All fields are required", "warning");
      return;
    }

    const url = isEdit
      ? `/api/designations/${id}`
      : '/api/designations/';

    const method = isEdit ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + sessionStorage.getItem('token')
      },
      body: JSON.stringify({
        department_id: departmentId,
        name: designationName.trim(),
        description: description.trim()
      })
    })
    .then(res => {
      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Saved",
          text: "Designation saved successfully"
        }).then(() => {
          navigate('/masters/designations');
        });
      } else {
        Swal.fire("Error", "Failed to save designation", "error");
      }
    })
    .catch(() => {
      Swal.fire("Error", "Something went wrong", "error");
    });
  };

  return (
    <>
      <style>{`
        .form-card {
            max-width: 650px;
            margin: 40px auto;
            background: #fff;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 15px 30px rgba(0,0,0,.08);
        }

        label {
            font-weight: 600;
            margin-top: 12px;
            display: block;
        }

        input, textarea, select {
            width: 100%;
            padding: 10px;
            border-radius: 8px;
            border: 1px solid #ccc;
            margin-top: 6px;
        }

        textarea {
            resize: none;
            height: 100px;
        }

        .form-actions {
            margin-top: 25px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }

        /* ❌ Cancel button (simple) */
        .btn-cancel {
            background: #e5e7eb;
            color: #333;
            padding: 10px 18px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
        }

        /* ✅ GLOBAL BUTTON STYLE (SAME AS LOGIN / DASHBOARD) */
        .form-actions button {
            cursor: pointer; /* ⭐ cursor issue FIX */
            box-shadow: -5px 15px 30px rgb(17 23 77 / 18%);
            color: #fff !important;
            background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
            border: none !important;
            background-size: 200% 100%;
            background-position: right bottom;
            transition: all .5s ease-out;
            border-radius: 50px;
            padding: 10px 22px;
            font-weight: 600;
        }

            .form-actions button:hover {
                box-shadow: none;
                background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
                background-position: left bottom;
            }
      `}</style>

      <div className="form-card">
        <h3>
          👔 {isEdit ? "Edit Designation" : "Add Designation"}
        </h3>

        <form id="designationForm">
          <input type="hidden" id="DesignationId" value={id || '00000000-0000-0000-0000-000000000000'} />

          <label>Department</label>
          <select 
            id="DepartmentId" 
            value={departmentId} 
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">-- Select Department --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <label>Designation Name</label>
          <input 
            id="DesignationName"
            value={designationName}
            onChange={(e) => setDesignationName(e.target.value)}
            placeholder="Enter designation name" 
          />

          <label>Description</label>
          <textarea 
            id="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description"
          ></textarea>

          <div className="form-actions">
            <Link to="/masters/designations" className="btn-cancel">
              Cancel
            </Link>

            <button type="button" onClick={saveDesignation}>
              Save
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AddDesignation;

