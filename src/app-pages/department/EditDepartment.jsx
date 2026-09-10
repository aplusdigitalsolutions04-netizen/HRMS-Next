import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Swal from 'sweetalert2';

const EditDepartment = () => {
  const { id } = useParams();
  const [departmentName, setDepartmentName] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetch(`/api/departments/${id}`, {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      })
        .then(res => res.json())
        .then(data => {
          setDepartmentName(data.name || '');
          setDescription(data.description || '');
        })
        .catch(err => console.error(err));
    }
  }, [id]);

  const handleSubmit = (e) => {
    e.preventDefault();

    fetch(`/api/departments/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({
        name: departmentName.trim(),
        description: description.trim()
      })
    })
    .then(res => {
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Department updated successfully'
        }).then(() => {
          navigate('/masters/departments');
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to update department'
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
            display: block;
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

        /* ❌ Cancel button (simple) */
        .btn-cancel {
            background: #e5e7eb;
            color: #333;
            padding: 10px 18px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
        }

        /* ✅ GLOBAL BUTTON CSS (SAME EVERYWHERE) */
        button {
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

            button:hover {
                box-shadow: none;
                background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
                background-position: left bottom;
            }
      `}</style>

      <div className="form-card">
        <h3>✏️ Edit Department</h3>

        <form id="editDeptForm" onSubmit={handleSubmit}>
          <input type="hidden" id="DepartmentId" value={id || ''} />

          <label>Department Name</label>
          <input 
            id="DepartmentName"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            placeholder="Enter department name" 
          />

          <label>Description</label>
          <textarea 
            id="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description"
          ></textarea>

          <div className="form-actions">
            <Link to="/masters/departments" className="btn-cancel">
              Cancel
            </Link>

            <button type="submit">
              Update
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default EditDepartment;

