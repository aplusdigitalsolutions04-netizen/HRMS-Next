export const templateManagementStyles = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { 0%,100% { opacity:.5; } 50% { opacity:1; } }
    .tpl-page { animation: fadeUp .5s cubic-bezier(.16,1,.3,1) both; }
    .drop-zone {
        border: 2.5px dashed #c7d2fe;
        border-radius: 16px;
        padding: 44px 24px;
        text-align: center;
        background: #f5f3ff;
        cursor: pointer;
        transition: all .25s ease;
        position: relative;
    }
    .drop-zone.drag-over {
        border-color: #6366f1;
        background: #ede9fe;
        transform: scale(1.01);
        box-shadow: 0 0 0 4px rgba(99,102,241,.15);
    }
    .drop-zone:hover { border-color: #818cf8; background: #eef2ff; }
    .file-pill {
        display: inline-flex; align-items: center; gap: 10px;
        background: #ede9fe; border-radius: 50px;
        padding: 10px 20px; font-weight: 600; color: #5b21b6;
        font-size: .95rem; margin-top: 14px;
        border: 1.5px solid #c4b5fd;
        animation: fadeUp .3s ease both;
    }
    .remove-file {
        width: 22px; height: 22px; border-radius: 50%;
        background: #7c3aed; color: #fff; border: none;
        cursor: pointer; font-size: 12px; display:flex;
        align-items:center; justify-content:center; line-height:1;
        flex-shrink: 0; padding: 0;
        box-shadow: none !important;
        background: #ef4444 !important;
    }
    .remove-file:hover { background: #dc2626 !important; }
    .extract-btn {
        display: inline-flex; align-items: center; gap: 10px;
        background: linear-gradient(135deg, #4338ca, #7c3aed);
        color: #fff; border: none; border-radius: 12px;
        padding: 13px 32px; font-size: 1rem; font-weight: 700;
        cursor: pointer; box-shadow: 0 6px 20px rgba(67,56,202,.3);
        transition: all .25s ease; margin-top: 20px;
        font-family: 'Outfit', sans-serif;
    }
    .extract-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 10px 30px rgba(67,56,202,.4);
        filter: brightness(1.08);
    }
    .extract-btn:disabled { opacity: .65; cursor: not-allowed; transform: none !important; }
    .spinner {
        width: 18px; height: 18px; border-radius: 50%;
        border: 2.5px solid rgba(255,255,255,.4);
        border-top-color: #fff;
        animation: spin .75s linear infinite; display:inline-block;
    }
    .preview-card {
        animation: fadeUp .4s ease both;
        margin-top: 24px;
    }
    .preview-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 22px; flex-wrap: wrap; gap: 12px;
    }
    .ai-badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: linear-gradient(135deg, #ede9fe, #dbeafe);
        color: #4338ca; border-radius: 50px;
        padding: 5px 14px; font-size: .78rem; font-weight: 700;
        letter-spacing: .5px; text-transform: uppercase; border: 1px solid #c7d2fe;
    }
    .field-label {
        font-size: .82rem; font-weight: 700; color: #64748b;
        text-transform: uppercase; letter-spacing: .8px;
        margin-bottom: 6px; font-family: 'Outfit', sans-serif;
    }
    .pfield { margin-bottom: 20px; }
    .pinput {
        width: 100%; padding: 11px 14px;
        border: 1.5px solid #e2e8f0; border-radius: 10px;
        font-size: .95rem; color: #0f172a; background: #f8fafc;
        transition: all .2s; font-family: 'Inter', sans-serif;
        outline: none;
    }
    .pinput:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 4px rgba(99,102,241,.12); }
    .ptextarea {
        width: 100%; padding: 12px 14px;
        border: 1.5px solid #e2e8f0; border-radius: 10px;
        font-size: .9rem; color: #0f172a; background: #f8fafc;
        transition: all .2s; font-family: 'monospace';
        outline: none; resize: vertical; min-height: 180px; line-height: 1.6;
    }
    .ptextarea:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 4px rgba(99,102,241,.12); }
    .var-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 12px; border-radius: 50px;
        font-size: .78rem; font-weight: 700;
        font-family: 'Outfit', monospace; letter-spacing: .3px;
        cursor: default;
    }
    .chip-remove {
        background: transparent; border: none; cursor: pointer;
        font-size: 11px; line-height: 1; padding: 0 2px;
        opacity: .6; transition: opacity .2s;
        box-shadow: none !important;
        color: inherit !important;
        background: transparent !important;
    }
    .chip-remove:hover { opacity: 1; }
    .save-btn {
        display: inline-flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: #fff; border: none; border-radius: 12px;
        padding: 12px 28px; font-size: .95rem; font-weight: 700;
        cursor: pointer; box-shadow: 0 5px 15px rgba(16,185,129,.3);
        transition: all .25s ease; font-family: 'Outfit', sans-serif;
    }
    .save-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(16,185,129,.4); filter: brightness(1.06);
    }
    .save-btn:disabled { opacity: .65; cursor: not-allowed; }
    .reset-btn {
        display: inline-flex; align-items: center; gap: 8px;
        background: transparent; color: #64748b;
        border: 1.5px solid #e2e8f0; border-radius: 12px;
        padding: 12px 24px; font-size: .95rem; font-weight: 600;
        cursor: pointer; transition: all .25s ease;
        font-family: 'Outfit', sans-serif;
    }
    .reset-btn:hover { border-color: #94a3b8; background: #f8fafc; color: #334155; }
    .tpl-table-wrapper {
        background: #fff; border-radius: 18px;
        border: 1px solid #e2e8f0; overflow: hidden;
        margin-top: 32px;
    }
    .tpl-table { width: 100%; border-collapse: collapse; }
    .tpl-table th {
        background: #f8fafc; color: #64748b;
        font-family: 'Outfit', sans-serif; font-weight: 700;
        font-size: .75rem; text-transform: uppercase; letter-spacing: 1px;
        padding: 16px 18px; text-align: left; border-bottom: 1.5px solid #e2e8f0;
    }
    .tpl-table td {
        padding: 16px 18px; font-size: .9rem; color: #1e293b;
        border-bottom: 1px solid #f1f5f9; vertical-align: middle;
    }
    .tpl-table tbody tr:last-child td { border-bottom: none; }
    .tpl-table tbody tr { transition: background .15s; }
    .tpl-table tbody tr:hover { background: #fafaff; }
    .tbl-action {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 6px 14px; border-radius: 8px;
        font-size: .8rem; font-weight: 600; cursor: pointer;
        border: none; transition: all .2s; font-family: 'Outfit', sans-serif;
    }
    .tbl-view {
        background: #ede9fe; color: #5b21b6;
        box-shadow: none !important;
    }
    .tbl-view:hover { background: #ddd6fe; }
    .tbl-del {
        background: #fee2e2; color: #991b1b;
        box-shadow: none !important;
    }
    .tbl-del:hover { background: #fecaca; }
    .expand-row td {
        padding: 0 !important;
        border-bottom: 2px solid #e0e7ff !important;
    }
    .expand-inner {
        padding: 20px 24px;
        background: linear-gradient(135deg, #fafafa, #f0f4ff);
        animation: fadeUp .25s ease both;
    }
    .expand-field { margin-bottom: 14px; }
    .expand-label { font-size: .75rem; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: .7px; margin-bottom: 4px; }
    .expand-value {
        background: #fff; border: 1px solid #e0e7ff; border-radius: 8px;
        padding: 10px 14px; font-size: .88rem; color: #334155;
        white-space: pre-wrap; font-family: 'monospace'; line-height: 1.6;
        max-height: 200px; overflow-y: auto;
    }
    .empty-state {
        text-align: center; padding: 60px 20px;
        color: #94a3b8;
    }
    .empty-state .icon { font-size: 3.5rem; margin-bottom: 12px; opacity: .6; }
    .empty-state p { font-size: 1rem; margin: 0; }
    .section-title {
        font-family: 'Outfit', sans-serif; font-weight: 800;
        font-size: 1.15rem; color: #1e293b;
        display: flex; align-items: center; gap: 10px;
    }
    .step-num {
        width: 28px; height: 28px; border-radius: 50%;
        background: linear-gradient(135deg, #4338ca, #7c3aed);
        color: #fff; font-size: .82rem; font-weight: 800;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
    }
    .supported-types {
        display: flex; gap: 8px; justify-content: center;
        margin-top: 10px; flex-wrap: wrap;
    }
    .type-badge {
        padding: 4px 12px; border-radius: 50px; font-size: .75rem;
        font-weight: 700; letter-spacing: .5px;
    }
    .loading-row td { text-align: center; padding: 40px !important; }
    .skeleton {
        height: 16px; border-radius: 8px;
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite;
    }
    .vars-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
`;
