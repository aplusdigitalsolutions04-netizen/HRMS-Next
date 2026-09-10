import React, { useState, useEffect, useRef } from 'react';

export function AnimatedValue({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef();
  const startTime = useRef();
  useEffect(() => {
    const target = Number(value) || 0;
    if (target === 0) { setDisplay(0); return; }
    const dur = 600;
    startTime.current = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / dur, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <>{display}{suffix}</>;
}

export const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
};

export const statusBadge = (status) => {
  if (status === 'active') return <span className="emp-badge emp-badge-active">Active</span>;
  if (status === 'pending') return <span className="emp-badge emp-badge-pending">Pending</span>;
  return <span className="emp-badge emp-badge-dropped">Dropped</span>;
};

export const canDeleteEmployee = () => {
  const role = localStorage.getItem('role');
  if (role === 'ADMIN' || role === 'HR') return true;
  try { return JSON.parse(localStorage.getItem('permissions') || '{}').delete_employee === true; } catch { return false; }
};

export const formatDT = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
