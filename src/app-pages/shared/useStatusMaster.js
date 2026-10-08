import { useState, useEffect } from 'react';

// Loads Settings > Status Master (employee and attendance statuses) once per page load
// and shares it, so no page has to hardcode a status label, colour or meaning.
let cache = null;
let inflight = null;
const listeners = new Set();

export function loadStatusMaster(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  const token = sessionStorage.getItem('token');
  inflight = fetch('/api/status-master', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(r => (r.ok ? r.json() : { statuses: [] }))
    .catch(() => ({ statuses: [] }))
    .then(d => {
      const all = Array.isArray(d.statuses) ? d.statuses : [];
      cache = {
        all,
        employee: all.filter(s => s.group_key === 'employee'),
        attendance: all.filter(s => s.group_key === 'attendance'),
        canEdit: !!d.can_edit,
      };
      inflight = null;
      listeners.forEach(fn => fn(cache));
      return cache;
    });
  return inflight;
}

export function resetStatusMaster() { cache = null; }

// Synchronous lookup from what is already loaded (a neutral fallback until it has loaded).
export function findCached(group, code) {
  const row = cache && (cache[group] || []).find(s => s.code === code);
  return row || { code, label: code || '-', color: '#64748b', description: '', used_for: '' };
}

const EMPTY = { all: [], employee: [], attendance: [], canEdit: false };

export default function useStatusMaster() {
  const [data, setData] = useState(cache || EMPTY);
  useEffect(() => {
    let alive = true;
    const fn = (c) => { if (alive) setData(c); };
    listeners.add(fn);
    loadStatusMaster().then(fn);
    return () => { alive = false; listeners.delete(fn); };
  }, []);
  return {
    ...data,
    ready: data !== EMPTY,
    // row for one code, or a neutral fallback so an unknown code still renders
    find: (group, code) => (data[group] || []).find(s => s.code === code)
      || { code, label: code || '-', color: '#64748b', description: '', used_for: '', behavior: '', present_weight: 0, unpaid_weight: 0 },
  };
}

// Inline style for a coloured pill / badge from a master colour.
export const pillStyle = (color) => ({
  display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
  background: `${color}1a`, color, border: `1px solid ${color}33`,
});
