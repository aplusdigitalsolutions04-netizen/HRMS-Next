import React from 'react';

/* ── slice an array for the current page ── */
export const paginate = (items, page, pageSize) => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
};

const css = `
.pgn { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-top:10px; padding:6px 12px; background:#fff; border:1px solid #eef2f7; border-radius:10px; font-size:12px; line-height:1.2; }
.pgn * { box-sizing:border-box; }
.pgn-left { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:12px; color:#64748b; }
.pgn .pgn-size { display:flex; align-items:center; gap:6px; white-space:nowrap; margin:0; font-size:12px; font-weight:500; color:#64748b; width:auto; }
.pgn .pgn-size select { height:28px !important; width:auto !important; min-width:54px; padding:0 22px 0 8px !important; margin:0; border-radius:7px; border:1px solid #e2e8f0; font-size:12px !important; font-weight:500; color:#475569; background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 7px center; appearance:none; -webkit-appearance:none; cursor:pointer; outline:none; }
.pgn .pgn-size select:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
.pgn .pgn-range { color:#64748b; font-size:12px; white-space:nowrap; }
.pgn-nav { display:flex; align-items:center; gap:8px; }
.pgn .pgn-b { width:28px !important; height:28px !important; min-width:0; border-radius:7px; border:1px solid #e2e8f0; background:#fff; color:#0f172a; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all .15s; padding:0 !important; margin:0; }
.pgn .pgn-b:hover:not(:disabled) { border-color:#2563eb; color:#1d4ed8; background:#f1f6ff; }
.pgn .pgn-b:disabled { background:#f8fafc; color:#cbd5e1; border-color:#f1f5f9; cursor:not-allowed; }
.pgn .pgn-b svg { width:13px; height:13px; }
.pgn .pgn-page { font-size:12px; font-weight:600; color:#334155; white-space:nowrap; }
@media (max-width:560px) { .pgn { justify-content:center; } }
`;

/* ── shared pager used by every list page ──
   Left:  Rows per page [20 v]  1-20 of 434
   Right: [<]  Page 1 of 22  [>]
   Pass onPageSizeChange to show the "Rows per page" picker. The current page size is always
   part of the list, so a page that starts with an odd size (e.g. 15) still shows it. ── */
const Pagination = ({ page, totalItems, pageSize, onPageChange, itemLabel = 'records', onPageSizeChange, pageSizeOptions = [10, 20, 50, 100] }) => {
    if (!totalItems) return null;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const cur = Math.min(Math.max(1, page), totalPages);
    const start = (cur - 1) * pageSize + 1;
    const end = Math.min(cur * pageSize, totalItems);
    const go = (p) => { if (p >= 1 && p <= totalPages && p !== page) onPageChange(p); };
    const options = [...new Set([...pageSizeOptions, pageSize])].sort((a, b) => a - b);

    return (
        <div className="pgn">
            <style>{css}</style>
            <div className="pgn-left">
                {onPageSizeChange && (
                    <label className="pgn-size">
                        Rows per page
                        <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}>
                            {options.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                )}
                <span className="pgn-range" title={itemLabel}>{start}–{end} of {totalItems}</span>
            </div>
            <div className="pgn-nav">
                <button className="pgn-b" onClick={() => go(cur - 1)} disabled={cur <= 1} aria-label="Previous page">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span className="pgn-page">Page {cur} of {totalPages}</span>
                <button className="pgn-b" onClick={() => go(cur + 1)} disabled={cur >= totalPages} aria-label="Next page">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
            </div>
        </div>
    );
};

export default Pagination;
