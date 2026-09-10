export const emailLogStyles = `
    @keyframes elFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes elSpin { to{transform:rotate(360deg)} }

    .el-page { animation:elFadeIn .35s ease both; }

    /* ── Page Header ── */
    .el-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; }
    .el-header-left h2 { margin:0; font-family:'Outfit',sans-serif; font-weight:800; font-size:1.65rem; color:#0f172a; letter-spacing:-0.5px; }
    .el-header-left p { margin:4px 0 0; color:#64748b; font-size:.88rem; }
    .el-header-right { display:flex; gap:10px; }
    .el-btn-refresh {
        display:inline-flex; align-items:center; gap:7px;
        background:#fff; color:#475569; border:1.5px solid #e2e8f0;
        border-radius:10px; padding:9px 16px; font-size:.85rem; font-weight:600;
        cursor:pointer; transition:all .2s; font-family:'Outfit',sans-serif;
    }
    .el-btn-refresh:hover { background:#f8fafc; border-color:#cbd5e1; }

    /* ── Statistics Cards ── */
    .el-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-bottom:24px; }
    .el-card {
        background:#fff; border-radius:14px; padding:20px 22px;
        box-shadow:0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
        border:1px solid #f1f5f9;
        display:flex; align-items:center; gap:16px;
        transition:box-shadow .2s, transform .2s;
    }
    .el-card:hover { box-shadow:0 4px 12px rgba(0,0,0,.08); transform:translateY(-1px); }
    .el-card-icon {
        width:46px; height:46px; border-radius:12px;
        display:flex; align-items:center; justify-content:center;
        font-size:1.4rem; flex-shrink:0;
        background:#f8fafc;
    }
    .el-card-body { display:flex; flex-direction:column; gap:2px; }
    .el-card-value { font-size:1.75rem; font-weight:800; color:#0f172a; font-family:'Outfit',sans-serif; line-height:1.2; }
    .el-card-label { font-size:.78rem; font-weight:500; color:#94a3b8; }

    /* ── Filter Toolbar ── */
    .el-toolbar {
        display:flex; gap:12px; align-items:center;
        background:#fff; border-radius:14px;
        padding:14px 20px; margin-bottom:20px;
        box-shadow:0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
        border:1px solid #f1f5f9;
    }
    .el-search {
        flex:1; min-width:180px;
        padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:10px;
        font-size:.88rem; outline:none; transition:all .2s;
        background:#f8fafc; color:#0f172a;
    }
    .el-search:focus { border-color:#6366f1; background:#fff; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
    .el-search::placeholder { color:#94a3b8; }
    .el-filter-select {
        padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:10px;
        font-size:.85rem; outline:none; background:#f8fafc; color:#0f172a; cursor:pointer;
        min-width:120px;
    }
    .el-filter-select:focus { border-color:#6366f1; background:#fff; }
    .el-date-input {
        padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:10px;
        font-size:.85rem; outline:none; background:#f8fafc; color:#0f172a;
        min-width:130px;
    }
    .el-date-input:focus { border-color:#6366f1; background:#fff; }
    .el-btn-export {
        display:inline-flex; align-items:center; gap:7px;
        background:linear-gradient(135deg,#10b981,#059669); color:#fff; border:none;
        border-radius:10px; padding:10px 18px; font-size:.85rem; font-weight:700;
        cursor:pointer; transition:all .2s; font-family:'Outfit',sans-serif; white-space:nowrap;
        margin-left:auto;
    }
    .el-btn-export:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(16,185,129,.35); }
    .el-btn-export:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }

    /* ── Table Container ── */
    .el-table-wrap {
        background:#fff; border-radius:14px;
        box-shadow:0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
        border:1px solid #f1f5f9;
        overflow:hidden;
    }
    .el-table { width:100%; table-layout:fixed; border-collapse:collapse; }
    .el-table thead th {
        background:#f8fafc;
        color:#64748b; font-size:.72rem; font-weight:700;
        text-transform:uppercase; letter-spacing:.5px;
        padding:14px 16px; text-align:left; white-space:nowrap;
        border-bottom:1px solid #e2e8f0;
        position:sticky; top:0; z-index:1;
    }
    .el-table tbody tr { transition:background .12s; }
    .el-table tbody tr:hover { background:#f8fafc; }
    .el-table tbody td { padding:14px 16px; font-size:.84rem; color:#334155; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .el-table tbody tr:last-child td { border-bottom:none; }

    /* Column widths – avoid overflow */
    .el-col-date { width:14%; }
    .el-col-candidate { width:16%; }
    .el-col-subject { width:28%; }
    .el-col-status { width:10%; }
    .el-col-template { width:12%; }
    .el-col-interview { width:12%; }
    .el-col-actions { width:8%; }

    .el-cell-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .el-date-text { white-space:nowrap; font-size:.8rem; color:#64748b; }
    .el-candidate-name { font-weight:600; color:#1e293b; }
    .el-subject-text { font-weight:500; color:#0f172a; }

    /* ── Template chip ── */
    .el-tpl-chip {
        display:inline-block; background:#ede9fe; color:#5b21b6;
        padding:3px 10px; border-radius:50px;
        font-weight:600; font-size:.74rem;
        max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }

    /* ── Status Badges ── */
    .el-badge {
        display:inline-flex; align-items:center; gap:6px;
        padding:4px 12px; border-radius:50px;
        font-size:.75rem; font-weight:600; line-height:1;
    }
    .el-badge-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .el-badge-sent { background:#ecfdf5; color:#065f46; }
    .el-badge-dot-sent { background:#10b981; }
    .el-badge-failed { background:#fef2f2; color:#991b1b; }
    .el-badge-dot-failed { background:#ef4444; }
    .el-badge-pending { background:#fffbeb; color:#92400e; }
    .el-badge-dot-pending { background:#f59e0b; }

    /* ── Actions ── */
    .el-actions { display:flex; align-items:center; gap:6px; }
    .el-btn-view {
        width:32px; height:32px; border-radius:8px; border:1.5px solid #e2e8f0;
        background:#fff; color:#64748b; cursor:pointer; display:inline-flex;
        align-items:center; justify-content:center; font-size:.85rem;
        transition:all .15s;
    }
    .el-btn-view:hover { border-color:#6366f1; color:#6366f1; background:#eef2ff; }
    .el-btn-more {
        width:32px; height:32px; border-radius:8px; border:1.5px solid #e2e8f0;
        background:#fff; color:#64748b; cursor:pointer; display:inline-flex;
        align-items:center; justify-content:center; font-size:.85rem; font-weight:700;
        transition:all .15s; position:relative;
    }
    .el-btn-more:hover { border-color:#94a3b8; background:#f8fafc; color:#334155; }
    .el-dropdown {
        position:absolute; top:calc(100% + 4px); right:0;
        background:#fff; border-radius:10px; min-width:160px;
        box-shadow:0 10px 30px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.06);
        border:1px solid #e2e8f0; padding:4px; z-index:50;
        animation:elFadeIn .12s ease both;
    }
    .el-dropdown-item {
        display:flex; align-items:center; gap:10px;
        padding:9px 14px; border-radius:8px; font-size:.82rem;
        color:#334155; cursor:pointer; border:none; background:none;
        width:100%; text-align:left; font-family:inherit; font-weight:500;
        transition:background .12s;
    }
    .el-dropdown-item:hover { background:#f1f5f9; }
    .el-dropdown-item.danger { color:#ef4444; }
    .el-dropdown-item.danger:hover { background:#fef2f2; }

    /* ── Result count ── */
    .el-result-count { font-size:.82rem; color:#64748b; padding:12px 16px; border-top:1px solid #f1f5f9; background:#fafafa; }

    /* ── Loading & Empty ── */
    .el-loading { display:flex; justify-content:center; padding:80px 20px; }
    .el-spinner { width:34px; height:34px; border-radius:50%; border:3px solid #e2e8f0; border-top-color:#6366f1; animation:elSpin .7s linear infinite; }
    .el-empty { text-align:center; padding:80px 20px; }
    .el-empty-icon { font-size:3rem; margin-bottom:16px; display:block; }
    .el-empty-title { font-size:1.05rem; font-weight:700; color:#0f172a; margin-bottom:6px; }
    .el-empty-desc { font-size:.85rem; color:#94a3b8; margin-bottom:20px; }
    .el-empty-btn {
        display:inline-flex; align-items:center; gap:6px;
        background:#f1f5f9; color:#475569; border:1.5px solid #e2e8f0;
        border-radius:10px; padding:9px 18px; font-size:.85rem; font-weight:600;
        cursor:pointer; transition:all .2s; font-family:'Outfit',sans-serif;
    }
    .el-empty-btn:hover { background:#e2e8f0; }

    /* ── View Detail Page ── */
    .el-view-page { animation:elFadeIn .25s ease both; }
    .el-view-back { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border:1.5px solid #e2e8f0; border-radius:10px; background:#fff; color:#475569; font-size:.85rem; font-weight:600; cursor:pointer; transition:all .2s; font-family:'Outfit',sans-serif; margin-bottom:20px; }
    .el-view-back:hover { background:#f8fafc; border-color:#cbd5e1; }
    .el-view-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; margin-bottom:20px; }
    .el-view-field { background:#f8fafc; border-radius:10px; padding:12px 14px; }
    .el-view-field.full { grid-column:1 / -1; }
    .el-view-field-label { font-size:.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
    .el-view-field-value { font-size:.88rem; color:#0f172a; line-height:1.4; word-break:break-word; }
    .el-view-field-value.email { color:#4338ca; }
    .el-view-body-box { background:#fff; border-radius:10px; padding:20px 24px; font-size:.88rem; color:#334155; line-height:1.8; border:1px solid #e2e8f0; font-family:'Segoe UI',Arial,sans-serif; }
    .el-view-body-box p { margin:0 0 12px; }
    .el-view-body-box p:last-child { margin-bottom:0; }
    .el-view-body-box br { display:block; content:''; margin:8px 0; }
`;
