export const fmt = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const parseVars = (raw) => {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
};

export const CHIP_COLORS = [
    { bg: '#ede9fe', color: '#7c3aed' },
    { bg: '#dbeafe', color: '#1d4ed8' },
    { bg: '#dcfce7', color: '#15803d' },
    { bg: '#fef3c7', color: '#b45309' },
    { bg: '#fce7f3', color: '#be185d' },
    { bg: '#e0f2fe', color: '#0369a1' },
];

export const fileIcon = (name) => {
    if (!name) return '📄';
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📕';
    if (ext === 'docx' || ext === 'doc') return '📘';
    if (ext === 'html') return '🌐';
    return '📄';
};
