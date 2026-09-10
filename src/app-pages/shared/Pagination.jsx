import React from 'react';

/* ── slice an array for the current page ── */
export const paginate = (items, page, pageSize) => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
};

/* ── shared "Showing X-Y of Z" + Prev/Next bar, used by every list page ──
   Pass pageSizeOptions + onPageSizeChange to also show a "rows per page"
   picker; omit onPageSizeChange to keep the bar without it. ── */
const Pagination = ({ page, totalItems, pageSize, onPageChange, itemLabel = 'records', onPageSizeChange, pageSizeOptions = [10, 25, 50, 100] }) => {
    if (totalItems === 0) return null;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14, padding: '10px 2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.82rem', color: '#64748b', fontWeight: 500 }}>
                    Showing {start}-{end} of {totalItems} {itemLabel}
                </span>
                {onPageSizeChange && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', color: '#64748b', fontWeight: 500 }}>
                        Rows per page
                        <select
                            value={pageSize}
                            onChange={e => onPageSizeChange(Number(e.target.value))}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #e2e8f0', fontSize: '.82rem', color: '#334155', background: '#fff', cursor: 'pointer' }}
                        >
                            {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                )}
            </div>
            {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                        style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: page <= 1 ? '#f8fafc' : '#fff', color: page <= 1 ? '#cbd5e1' : '#334155', fontWeight: 600, fontSize: '.82rem', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
                    >
                        ← Previous
                    </button>
                    <span style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, minWidth: 70, textAlign: 'center' }}>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                        style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: page >= totalPages ? '#f8fafc' : '#fff', color: page >= totalPages ? '#cbd5e1' : '#334155', fontWeight: 600, fontSize: '.82rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default Pagination;
