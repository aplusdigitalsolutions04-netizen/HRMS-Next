export const employeeManagementStyles = `
    .emp-page { animation:empFade .35s ease both; }
    @keyframes empFade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes empSlideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
    @keyframes empSlideOut { from{transform:translateX(0)} to{transform:translateX(100%)} }

    .emp-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; gap:14px; }
    .emp-hdr-l h1 { margin:0; font-family:'Outfit',sans-serif; font-weight:800; font-size:1.6rem; color:#0f172a; letter-spacing:-0.3px; }
    .emp-hdr-g { font-size:.9rem; color:#475569; font-weight:500; }
    .emp-breadcrumb { display:flex; align-items:center; gap:6px; font-size:.8rem; color:#94a3b8; margin-bottom:2px; }
    .emp-breadcrumb a { color:#6366f1; text-decoration:none; font-weight:600; }
    .emp-breadcrumb a:hover { text-decoration:underline; }

    .emp-add-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 22px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:12px; font-weight:600; font-size:.9rem; text-decoration:none; transition:all .2s; cursor:pointer; }
    .emp-add-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(99,102,241,.35); color:#fff; }

    .emp-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-bottom:20px; }
    .emp-card { background:#fff; border-radius:18px; padding:22px 24px; border:1px solid #f1f5f9; transition:all .2s; }
    .emp-card:hover { border-color:#e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,.04); }
    .emp-card-lbl { font-size:.8rem; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
    .emp-card-val { font-family:'Outfit',sans-serif; font-weight:700; font-size:2rem; color:#0f172a; line-height:1.1; }
    .emp-card-sub { font-size:.8rem; color:#64748b; margin-top:3px; }
    .emp-card-sub.green { color:#10b981; }
    .emp-card-sub.red { color:#ef4444; }
    .emp-card-icon { float:right; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; }

    .emp-toolbar { display:flex; align-items:center; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
    .emp-search { flex:1; min-width:200px; position:relative; }
    .emp-search input { width:100%; padding:10px 14px 10px 38px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:.9rem; outline:none; background:#fff; color:#0f172a; transition:all .2s; }
    .emp-search input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
    .emp-search .s-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; font-size:1.1rem; }
    .emp-select { padding:10px 32px 10px 14px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:.88rem; outline:none; background:#fff; color:#0f172a; cursor:pointer; appearance:none; -webkit-appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; transition:all .2s; }
    .emp-select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
    .emp-filter-btn { display:inline-flex; align-items:center; justify-content:center; padding:10px 20px; background:#6366f1; border:none; border-radius:10px; color:#fff; font-weight:600; font-size:.88rem; cursor:pointer; transition:all .2s; gap:6px; }
    .emp-filter-btn:hover { background:#4f46e5; transform:translateY(-1px); }

    .emp-table-wrap { background:#fff; border-radius:16px; border:1px solid #f1f5f9; overflow:hidden; }
    .emp-table { width:100%; border-collapse:collapse; }
    .emp-table th { padding:12px 16px; font-size:.8rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; text-align:left; background:#fafbfc; border-bottom:1px solid #f1f5f9; }
    .emp-table td { padding:12px 16px; font-size:.9rem; color:#334155; border-bottom:1px solid #f8fafc; vertical-align:middle; }
    .emp-table tr:last-child td { border-bottom:none; }
    .emp-table tbody tr { transition:background .15s; cursor:pointer; }
    .emp-table tbody tr:hover { background:#f8faff; }

    .emp-avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.88rem; color:#fff; flex-shrink:0; background:linear-gradient(135deg,#6366f1,#8b5cf6); }
    .emp-avatar-img { width:40px; height:40px; border-radius:50%; object-fit:cover; }
    .emp-name-cell { display:flex; align-items:center; gap:12px; }
    .emp-name-cell div { line-height:1.2; }
    .emp-name-cell .name { font-weight:600; color:#0f172a; }
    .emp-name-cell .code { font-size:.78rem; color:#94a3b8; }

    .emp-badge { display:inline-block; padding:3px 12px; border-radius:20px; font-size:.78rem; font-weight:600; }
    .emp-badge-active { background:#dcfce7; color:#15803d; }
    .emp-badge-pending { background:#fef9c3; color:#a16207; }
    .emp-badge-dropped { background:#fef2f2; color:#dc2626; }
    .emp-badge-dept { background:#f0f4ff; color:#4f46e5; }

    .emp-actions { display:flex; gap:6px; }
    .emp-action-btn { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:9px; border:1px solid transparent; background:transparent; color:#94a3b8; cursor:pointer; transition:all .15s; text-decoration:none; }
    .emp-action-btn:hover { background:#f1f5f9; color:#6366f1; border-color:#e2e8f0; }
    .emp-action-btn.view:hover { color:#6366f1; }
    .emp-action-btn.edit:hover { color:#f59e0b; }
    .emp-action-btn.delete:hover { color:#ef4444; background:#fef2f2; border-color:#fecaca; }
    .emp-action-btn.download:hover { color:#059669; background:#f0fdf4; border-color:#a7f3d0; }

    .emp-empty { text-align:center; padding:56px 24px; color:#94a3b8; }
    .emp-empty svg { width:64px; height:64px; margin-bottom:14px; opacity:.4; }
    .emp-empty h3 { font-size:1.1rem; font-weight:600; color:#64748b; margin:0 0 4px; }
    .emp-empty p { font-size:.9rem; margin:0; }

    .emp-pagination { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-top:1px solid #f1f5f9; }
    .emp-page-info { font-size:.85rem; color:#94a3b8; }
    .emp-page-btns { display:flex; gap:6px; }
    .emp-page-btn { display:inline-flex; align-items:center; justify-content:center; min-width:36px; height:36px; border-radius:9px; border:1.5px solid #e2e8f0; background:#fff; color:#475569; font-size:.85rem; font-weight:600; cursor:pointer; transition:all .15s; padding:0 10px; }
    .emp-page-btn:hover:not(.active) { border-color:#6366f1; color:#6366f1; }
    .emp-page-btn.active { background:#6366f1; border-color:#6366f1; color:#fff; }
    .emp-page-btn:disabled { opacity:.4; cursor:default; }

    .emp-drawer-overlay { position:fixed; inset:0; background:rgba(15,23,42,.5); z-index:1000; animation:empFade .2s ease; }
    .emp-drawer { position:fixed; top:3%; left:3%; right:3%; bottom:3%; background:#fff; z-index:1001; animation:empFade .25s ease; display:flex; flex-direction:column; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .emp-drawer-hdr { display:flex; align-items:center; justify-content:space-between; padding:20px 28px; border-bottom:1px solid #f1f5f9; }
    .emp-drawer-hdr h2 { margin:0; font-size:1.25rem; font-weight:700; color:#0f172a; }
    .emp-drawer-close { width:38px; height:38px; border-radius:9px; border:none; background:#f1f5f9; color:#64748b; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:1.3rem; transition:all .15s; }
    .emp-drawer-close:hover { background:#e2e8f0; color:#0f172a; }
    .emp-drawer-body { flex:1; overflow-y:auto; padding:28px; }
    .emp-drawer-profile { text-align:center; margin-bottom:28px; }
    .emp-drawer-avatar { width:90px; height:90px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:1.8rem; color:#fff; background:linear-gradient(135deg,#6366f1,#8b5cf6); margin-bottom:12px; }
    .emp-drawer-name { font-weight:700; font-size:1.5rem; color:#0f172a; }
    .emp-drawer-role { font-size:.95rem; color:#64748b; }
    .emp-drawer-groups { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:18px; margin-top:6px; }
    .emp-drawer-group { background:#f8fafc; border-radius:14px; padding:18px; }
    .emp-drawer-group h3 { font-size:.82rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; margin:0 0 12px; }
    .emp-drawer-row { display:flex; justify-content:space-between; padding:8px 0; font-size:.92rem; border-bottom:1px solid #f1f5f9; }
    .emp-drawer-row:last-child { border-bottom:none; }
    .emp-drawer-row .lbl { color:#64748b; }
    .emp-drawer-row .val { color:#0f172a; font-weight:500; text-align:right; }

    .emp-table .col-name { width:28%; }
    .emp-table .col-contact { width:20%; }
    .emp-table .col-dept { width:15%; }
    .emp-table .col-status { width:10%; }
    .emp-table .col-joined { width:15%; }
    .emp-table .col-actions { width:12%; }

    @media (max-width:900px) {
      .emp-grid { grid-template-columns:repeat(2,1fr); }
      .emp-table .col-contact, .emp-table .col-joined { display:none; }
    }
`;
