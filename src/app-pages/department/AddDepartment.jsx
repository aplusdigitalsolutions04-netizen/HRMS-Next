import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';

const AddDepartment = () => {
  const [departmentName, setDepartmentName] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    fetch('/api/departments/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + sessionStorage.getItem('token')
      },
      body: JSON.stringify({
        name: departmentName,
        description: description
      })
    })
    .then(res => {
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Department added successfully'
        }).then(() => {
          navigate('/masters/departments');
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to add department'
        });
      }
    })
    .catch(() => {
      Swal.fire('Error', 'Something went wrong', 'error');
    });
  };

  return (
    <>
      <style>{`
        .form-card {
            max-width: 600px;
            margin: 40px auto;
            background: #fff;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 15px 30px rgba(0,0,0,.08);
        }

        label {
            font-weight: 600;
            margin-top: 12px;
        }

        input, textarea {
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

        .btn-cancel {
            background: #e5e7eb;
            color: #333;
            padding: 10px 18px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
        }
        /* =========================
               ✅ COMMON BUTTON CSS
               ========================= */
        .form-actions button,
        .btn-link {
            cursor: pointer;
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
            text-decoration: none;
            display: inline-block;
        }

            .form-actions button:hover,
            .btn-link:hover {
                box-shadow: none;
                background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
                background-position: left bottom;
            }
      `}</style>

      <div className="form-card">
        <h3>➕ Add Department</h3>

        <form id="addDeptForm" onSubmit={handleSubmit}>
          <label>Department Name</label>
          <input 
            id="DepartmentName" 
            value={departmentName} 
            onChange={(e) => setDepartmentName(e.target.value)} 
          />

          <label>Description</label>
          <textarea 
            id="Description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
          ></textarea>

          <div className="form-actions">
            {/* Cancel (anchor but button-style) */}
            <Link to="/masters/departments" className="btn-cancel">Cancel</Link>

            {/* Save */}
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AddDepartment;

