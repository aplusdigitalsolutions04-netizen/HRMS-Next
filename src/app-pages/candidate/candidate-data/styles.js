export const candidateDataStyles = `
    @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }
    @keyframes spin   { to { transform:rotate(360deg); } }
    @keyframes atmSpin { to { transform:rotate(360deg); } }
    @keyframes pulseGreen { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.4);} 50%{box-shadow:0 0 0 8px rgba(16,185,129,0);} }

    button { cursor:pointer; }

    /* ── candidate card ── */
    .candidate-card { background:#fff; padding:22px; border-radius:14px; box-shadow:0 12px 30px rgba(0,0,0,.06); }
    .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
    .header h2 { font-size:22px; font-weight:600; margin:0; }
    table { width:100%; border-collapse:collapse; }
    thead th { background:#f8fafc; font-size:13px; font-weight:600; color:#000; padding:14px; text-align:left; border:1px solid #dee2e6; }
    tbody td { padding:14px; font-size:14px; border-top:1px solid #eee; vertical-align:middle; }
    tbody tr:hover { background:#fafafa; }
    .btn { padding:8px 14px; border-radius:8px; font-size:13px; display:inline-flex; align-items:center; gap:6px; box-shadow:-5px 15px 30px rgb(17 23 77/18%); color:#fff!important; background:linear-gradient(135deg,var(--primary) 0%,var(--accent) 100%); border:none!important; border-radius:50px; transition:all .5s ease-out; }
    .btn:hover { box-shadow:none; background:linear-gradient(135deg,var(--accent) 0%,var(--primary) 100%); }
    .btn.medium { padding:8px 18px; font-size:14px; }
    .action-buttons { display:flex; gap:8px; }
    .status-badge { padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; display:inline-block; }
    .status-badge.scheduled  { background:#e0f2fe; color:#0369a1; }
    .status-badge.completed  { background:#dcfce7; color:#166534; }
    .status-badge.on-hold    { background:#fef3c7; color:#92400e; }
    .status-badge.rejected   { background:#fee2e2; color:#991b1b; }

    /* ── shared modal ── */
    .modal { position:fixed; inset:0; background:rgba(0,0,0,.45); justify-content:center; align-items:center; z-index:1000; }
    .modal-content { background:#fff; width:850px; max-width:92vw; max-height:90vh; overflow-y:auto; border-radius:14px; padding:22px; }
    .modal-content.small { width:420px; max-width:92vw; }
    .modal-actions { display:flex; gap:10px; margin-top:10px; }
    .modal-actions.right { justify-content:flex-end; }
    input, select, textarea { width:100%; padding:9px; border-radius:6px; border:1px solid #ccc; font-size:14px; }
    textarea { resize:vertical; }
    .form-grid  { display:grid; grid-template-columns:repeat(2,1fr); gap:15px; margin-bottom:15px; }
    .full-width { width:100%; margin-bottom:15px; }
    hr { margin:20px 0; border:none; border-top:1px solid #eee; }

    /* ── email modal ── */
    .email-modal-overlay {
        position:fixed; inset:0;
        background:rgba(0,0,0,.55);
        display:flex; justify-content:center; align-items:center;
        z-index:2000;
        animation:fadeUp .25s ease both;
    }
    .email-modal {
        background:#fff;
        border-radius:20px;
        width:680px;
        max-width:92vw;
        max-height:92vh;
        overflow-y:auto;
        box-shadow:0 30px 80px rgba(67,56,202,.25);
        border:1.5px solid #e0e7ff;
        animation:fadeUp .3s cubic-bezier(.16,1,.3,1) both;
    }
    .email-modal-header {
        padding:22px 26px 16px;
        border-bottom:1.5px solid #f1f5f9;
        display:flex; align-items:center; justify-content:space-between;
        background:linear-gradient(135deg,#4338ca 0%,#7c3aed 100%);
        border-radius:18px 18px 0 0;
    }
    .email-modal-title {
        color:#fff; font-family:'Outfit',sans-serif; font-weight:800;
        font-size:1.15rem; display:flex; align-items:center; gap:10px;
    }
    .email-modal-close {
        width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,.2);
        border:none; color:#fff; font-size:16px; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:background .2s; box-shadow:none!important;
    }
    .email-modal-close:hover { background:rgba(255,255,255,.35); }
    .email-modal-body { padding:24px 26px; }
    .em-label {
        display:block; font-size:.78rem; font-weight:700; color:#64748b;
        text-transform:uppercase; letter-spacing:.8px; margin-bottom:6px;
        font-family:'Outfit',sans-serif;
    }
    .em-input {
        width:100%; padding:11px 14px;
        border:1.5px solid #e2e8f0; border-radius:10px;
        font-size:.92rem; color:#0f172a; background:#f8fafc;
        outline:none; transition:all .2s; font-family:'Inter',sans-serif;
    }
    .em-input:focus { border-color:#6366f1; background:#fff; box-shadow:0 0 0 4px rgba(99,102,241,.12); }
    .em-select {
        width:100%; padding:11px 14px;
        border:1.5px solid #e2e8f0; border-radius:10px;
        font-size:.92rem; color:#0f172a; background:#f8fafc;
        outline:none; cursor:pointer; transition:all .2s;
        font-family:'Inter',sans-serif;
    }
    .em-select:focus { border-color:#6366f1; background:#fff; box-shadow:0 0 0 4px rgba(99,102,241,.12); }
    .em-textarea {
        width:100%; padding:12px 14px; min-height:160px;
        border:1.5px solid #e2e8f0; border-radius:10px;
        font-size:.88rem; color:#0f172a; background:#f8fafc;
        outline:none; resize:vertical; line-height:1.65;
        transition:all .2s; font-family:'monospace';
    }
    .em-textarea:focus { border-color:#6366f1; background:#fff; box-shadow:0 0 0 4px rgba(99,102,241,.12); }
    .em-field { margin-bottom:18px; }
    .em-to-badge {
        display:inline-flex; align-items:center; gap:8px;
        background:#ede9fe; color:#5b21b6; border-radius:50px;
        padding:8px 16px; font-size:.88rem; font-weight:600;
        border:1.5px solid #c4b5fd;
    }
    .tpl-selector-info {
        background:linear-gradient(135deg,#f0f4ff,#faf5ff);
        border:1.5px solid #e0e7ff; border-radius:12px;
        padding:14px 16px; margin-bottom:20px;
        font-size:.85rem; color:#475569; line-height:1.6;
    }
    .var-chip-small {
        display:inline-block; padding:2px 9px; border-radius:50px;
        font-size:.72rem; font-weight:700; margin:2px;
    }
    .send-btn {
        display:inline-flex; align-items:center; gap:8px;
        background:linear-gradient(135deg,#4338ca,#7c3aed);
        color:#fff; border:none; border-radius:12px;
        padding:13px 32px; font-size:.95rem; font-weight:700;
        cursor:pointer; box-shadow:0 6px 20px rgba(67,56,202,.3);
        transition:all .25s; font-family:'Outfit',sans-serif;
        flex:1; justify-content:center;
    }
    .send-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 28px rgba(67,56,202,.4); filter:brightness(1.08); }
    .send-btn:disabled { opacity:.65; cursor:not-allowed; }
    .skip-btn {
        display:inline-flex; align-items:center; gap:8px;
        background:transparent; color:#64748b;
        border:1.5px solid #e2e8f0; border-radius:12px;
        padding:13px 24px; font-size:.92rem; font-weight:600;
        cursor:pointer; transition:all .2s; font-family:'Outfit',sans-serif;
    }
    .skip-btn:hover { border-color:#94a3b8; background:#f8fafc; }
    .spinner { width:16px; height:16px; border-radius:50%; border:2.5px solid rgba(255,255,255,.4); border-top-color:#fff; animation:spin .7s linear infinite; display:inline-block; }
    .status-banner {
        padding:12px 16px; border-radius:10px; font-size:.88rem; font-weight:600;
        display:flex; align-items:center; gap:10px; margin-top:14px;
    }
    .status-banner.success { background:#dcfce7; color:#166534; border:1px solid #bbf7d0; animation:pulseGreen 1.5s ease infinite; }
    .status-banner.error   { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
    .status-banner.sending { background:#ede9fe; color:#5b21b6; border:1px solid #c4b5fd; }
    .no-tpl-hint { text-align:center; padding:16px; color:#94a3b8; font-size:.85rem; }

    /* ── Email modal tabs ── */
    .em-tabs { display:flex; gap:0; border-bottom:2px solid #e2e8f0; margin-bottom:20px; }
    .em-tab {
        padding:10px 22px; font-size:.88rem; font-weight:700; cursor:pointer;
        color:#94a3b8; border:none; background:transparent;
        border-bottom:2.5px solid transparent; margin-bottom:-2px;
        transition:all .2s; font-family:'Outfit',sans-serif;
    }
    .em-tab.active { color:#4338ca; border-bottom-color:#4338ca; }
    .em-tab:hover:not(.active) { color:#64748b; }

    /* ── Email history table ── */
    .hist-table { width:100%; border-collapse:collapse; font-size:.82rem; }
    .hist-table th { background:#f8fafc; padding:9px 12px; text-align:left; font-weight:700; color:#475569; border-bottom:1.5px solid #e2e8f0; }
    .hist-table td { padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#334155; vertical-align:top; }
    .hist-table tr:last-child td { border-bottom:none; }
    .hist-status-sent   { display:inline-flex; align-items:center; gap:5px; background:#dcfce7; color:#166534; padding:3px 10px; border-radius:50px; font-weight:700; font-size:.78rem; }
    .hist-status-failed { display:inline-flex; align-items:center; gap:5px; background:#fee2e2; color:#991b1b; padding:3px 10px; border-radius:50px; font-weight:700; font-size:.78rem; }
    .hist-empty { text-align:center; padding:30px; color:#94a3b8; font-size:.88rem; }
    .cc-chip-wrap { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
    .cc-chip {
        display:inline-flex; align-items:center; gap:6px;
        padding:4px 12px; border-radius:50px;
        background:#ede9fe; color:#5b21b6; font-size:.8rem; font-weight:600;
        border:1.5px solid #c4b5fd;
    }
    .cc-chip .chip-remove {
        background:transparent; border:none; cursor:pointer; font-size:11px;
        padding:0 2px; opacity:.6; color:inherit !important;
        box-shadow:none !important;
    }
    .cc-chip .chip-remove:hover { opacity:1; }
`;
