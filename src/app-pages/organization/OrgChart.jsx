import React, { useState, useEffect } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const OrgNode = ({ node, childrenMap, searchQuery }) => {
  const [expanded, setExpanded] = useState(true);
  const children = childrenMap[node.id] || [];
  const hasChildren = children.length > 0;
  
  const isMatch = searchQuery && (
    (node.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (node.emp_code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 10px' }}>
      <div style={{
        padding: '12px 16px',
        border: `2px solid ${isMatch ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: '12px',
        background: isMatch ? '#eff6ff' : '#fff',
        minWidth: '160px',
        textAlign: 'center',
        position: 'relative',
        boxShadow: isMatch ? '0 0 0 4px rgba(59, 130, 246, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease'
      }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f1f5f9', margin: '0 auto 10px', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
          {node.profile_photo ? (
             <img src={`${API}/uploads/${node.profile_photo}`} alt={node.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 16, fontWeight: 'bold' }}>
               {(node.full_name||'').charAt(0).toUpperCase()}
             </div>
          )}
        </div>
        <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{node.full_name}</div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>{node.designation || 'No Designation'}</div>
        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 4, background: '#f8fafc', display: 'inline-block', padding: '2px 6px', borderRadius: 4 }}>
          {node.emp_code || 'No ID'}
        </div>
        
        {hasChildren && (
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{
              position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)',
              width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '1px solid #cbd5e1',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#475569', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {expanded ? '-' : '+'}
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginTop: 26, paddingTop: 16 }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', width: 2, height: 16, background: '#cbd5e1', transform: 'translateX(-50%)' }} />
          
          {children.map((child, index) => {
            const isFirst = index === 0;
            const isLast = index === children.length - 1;
            const isOnly = children.length === 1;

            return (
              <div key={child.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {!isOnly && (
                  <div style={{
                    position: 'absolute', top: 0, height: 2, background: '#cbd5e1',
                    left: isFirst ? '50%' : 0,
                    right: isLast ? '50%' : 0,
                    width: isFirst || isLast ? '50%' : '100%'
                  }} />
                )}
                <div style={{ width: 2, height: 16, background: '#cbd5e1' }} />
                
                <OrgNode node={child} childrenMap={childrenMap} searchQuery={searchQuery} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function OrgChart() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(`${API}/org-chart`, { headers: auth() })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to load org chart');
        setEmployees(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading organization chart...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>{error}</div>;

  // Group by department first so the chart doesn't become one giant flat row
  // once there are many employees - each department gets its own compact
  // section with its own (smaller) reporting tree.
  const departments = {};
  employees.forEach(emp => {
    const dept = emp.department_name || 'Unassigned';
    if (!departments[dept]) departments[dept] = [];
    departments[dept].push(emp);
  });

  const buildTree = (deptEmployees) => {
    const idsInDept = new Set(deptEmployees.map(e => e.id));
    const childrenMap = {};
    const roots = [];
    deptEmployees.forEach(emp => {
      // A manager outside this department (or none at all) makes this
      // employee a root within their own department's section.
      if (!emp.manager_id || !idsInDept.has(emp.manager_id)) {
        roots.push(emp);
      } else {
        if (!childrenMap[emp.manager_id]) childrenMap[emp.manager_id] = [];
        childrenMap[emp.manager_id].push(emp);
      }
    });
    return { childrenMap, roots };
  };

  const deptNames = Object.keys(departments).sort((a, b) => a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b));

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, background: '#fff', padding: '16px 24px', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Organization Chart</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>Visual reporting hierarchy</p>
        </div>
        <div>
          <input 
            type="text" 
            placeholder="Search name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', width: 250, fontSize: 14 }}
          />
        </div>
      </div>

      {employees.length === 0 ? (
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: 40, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#94a3b8', textAlign: 'center' }}>
          No employees found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {deptNames.map(dept => {
            const { childrenMap, roots } = buildTree(departments[dept]);
            return (
              <DeptSection key={dept} dept={dept} count={departments[dept].length} roots={roots} childrenMap={childrenMap} searchQuery={searchQuery} />
            );
          })}
        </div>
      )}
    </div>
  );
}

const DeptSection = ({ dept, count, roots, childrenMap, searchQuery }) => {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#f8fafc', border: 'none', borderBottom: open ? '1px solid #e2e8f0' : 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
          🏢 {dept} <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 13 }}>({count})</span>
        </span>
        <span style={{ color: '#64748b', fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
      </button>
      {open && (
        <div style={{ overflow: 'auto', padding: 32 }}>
          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', width: 'fit-content', margin: '0 auto' }}>
            {roots.map(root => (
              <OrgNode key={root.id} node={root} childrenMap={childrenMap} searchQuery={searchQuery} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
