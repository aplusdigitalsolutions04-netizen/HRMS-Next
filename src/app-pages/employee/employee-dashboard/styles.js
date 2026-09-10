export const empDashboardStyles = `
  .emp-sidebar {
    width: 260px;
    min-width: 260px;
    background: #ffffff;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow-y: auto;
    z-index: 100;
  }
  .emp-sidebar::-webkit-scrollbar { width: 4px; }
  .emp-sidebar::-webkit-scrollbar-track { background: transparent; }
  .emp-sidebar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
  .emp-sidebar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
  .emp-sidebar-brand {
    padding: 20px 16px 12px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .emp-sidebar-brand-logo {
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .emp-sidebar-brand-text {
    display: flex; flex-direction: column; flex: 1; min-width: 0;
  }
  .emp-sidebar-brand-text span:first-child {
    font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.2rem;
    background: linear-gradient(135deg, #4338ca, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1.2;
  }
  .emp-sidebar-brand-text span:last-child {
    font-size: 0.6rem; color: #94a3b8; font-weight: 600;
    letter-spacing: 0.4px; text-transform: uppercase;
  }
  .emp-sidebar-nav {
    flex: 1; padding: 4px 12px 16px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .emp-sidebar-item {
    display: flex; align-items: center; gap: 10px;
    height: 44px; padding: 0 12px; border-radius: 10px;
    color: #64748b; font-size: 0.88rem; font-weight: 500;
    cursor: pointer; transition: all 0.2s ease;
    text-decoration: none; border: none; background: none; width: 100%; text-align: left;
    font-family: 'Inter', sans-serif; position: relative;
  }
  .emp-sidebar-item:hover {
    background: #f1f5f9;
    color: #334155;
  }
  .emp-sidebar-item.active {
    background: #eef2ff;
    color: #4f46e5;
    font-weight: 600;
  }
  .emp-sidebar-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 20px;
    background: #6366f1;
    border-radius: 0 4px 4px 0;
  }
  .emp-sidebar-support {
    margin: 12px; padding: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px; text-align: center;
  }
  .emp-sidebar-support h4 {
    color: #334155; font-size: 13px; font-weight: 600; margin-bottom: 4px;
  }
  .emp-sidebar-support p {
    color: #94a3b8; font-size: 11px; line-height: 1.4; margin-bottom: 10px;
  }
  .emp-sidebar-support button {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff; border: none; padding: 8px 16px; border-radius: 8px;
    font-size: 12px; font-weight: 600; cursor: pointer;
    font-family: inherit; transition: all 0.2s ease;
  }
  .emp-sidebar-support button:hover {
    transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.3);
  }

  .emp-main {
    flex: 1; display: flex; flex-direction: column; min-width: 0;
    overflow-y: auto;
    height: 100vh;
    margin-left: 260px;
  }

  .emp-header {
    height: 68px; background: #fff; border-bottom: 1px solid #e2e8f0;
    display: flex; align-items: center;
    padding: 0 32px; position: sticky; top: 0; z-index: 50;
  }
  .emp-header-left {
    flex: 1; display: flex; align-items: center; gap: 16px;
  }
  .emp-search-bar {
    display: flex; align-items: center; gap: 10px;
    background: #f1f5f9; border-radius: 10px;
    padding: 8px 16px; width: 360px;
  }
  .emp-search-bar input {
    border: none; background: none; outline: none;
    font-size: 13px; color: #0f172a; flex: 1;
    font-family: inherit;
  }
  .emp-search-bar input::placeholder { color: #94a3b8; }
  .emp-search-shortcut {
    font-size: 10px; color: #94a3b8; background: #e2e8f0;
    padding: 2px 6px; border-radius: 4px; font-weight: 600;
  }
  .emp-header-right {
    display: flex; align-items: center; gap: 8px;
  }
  .emp-header-btn {
    width: 40px; height: 40px; border-radius: 10px;
    border: none; background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #64748b; transition: all 0.2s ease; position: relative;
  }
  .emp-header-btn:hover { background: #f1f5f9; color: #0f172a; }
  .emp-notif-badge {
    position: absolute; top: 6px; right: 6px;
    width: 18px; height: 18px; border-radius: 50%;
    background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .emp-header-profile {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 12px 4px 4px; border-radius: 10px;
    cursor: pointer; transition: all 0.2s ease;
    margin-left: 8px; position: relative;
  }
  .emp-header-profile:hover { background: #f1f5f9; }
  .emp-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff; display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif;
    flex-shrink: 0;
  }
  .emp-header-profile-info { line-height: 1.3; }
  .emp-header-profile-info div:first-child {
    font-size: 13px; font-weight: 600; color: #0f172a;
  }
  .emp-header-profile-info div:last-child {
    font-size: 11px; color: #64748b;
  }

  .emp-content {
    flex: 1; padding: 28px 32px; max-width: 1400px;
  }

  .emp-banner {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%);
    border-radius: 20px; padding: 32px 40px;
    position: relative; overflow: hidden; margin-bottom: 28px;
  }
  .emp-banner-content {
    position: relative; z-index: 2;
  }
  .emp-banner h1 {
    color: #fff; font-size: 26px; font-weight: 700;
    font-family: 'Outfit', sans-serif; letter-spacing: -0.02em;
    margin-bottom: 6px;
  }
  .emp-banner p {
    color: rgba(255,255,255,0.8); font-size: 15px;
  }
  .emp-banner-bg {
    position: absolute; right: 0; top: 0; bottom: 0; width: 45%;
    opacity: 0.12;
    background:
      radial-gradient(circle at 80% 30%, #fff 0%, transparent 50%),
      radial-gradient(circle at 60% 70%, #fff 0%, transparent 40%),
      radial-gradient(circle at 90% 50%, #fff 0%, transparent 35%);
    mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M47,-70.9C60.5,-63.1,70.5,-47.7,77.1,-30.8C83.6,-13.9,86.7,4.5,80.3,20.3C73.9,36.1,58,49.3,41.8,59.4C25.6,69.5,9.1,76.5,-7.2,76.1C-23.5,75.7,-39.8,67.9,-53.9,56.4C-68,44.9,-79.9,29.7,-82.5,12.6C-85.1,-4.5,-78.4,-23.6,-67.3,-38.8C-56.2,-54,-40.6,-65.3,-24.8,-71.6C-8.9,-77.9,7.2,-79.1,21,-73.9C34.8,-68.7,33.5,-78.7,47,-70.9Z' fill='white'/%3E%3C/svg%3E");
    -webkit-mask-size: 300px 300px; mask-size: 300px 300px;
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    -webkit-mask-position: right center; mask-position: right center;
  }
  .emp-banner-waves {
    position: absolute; right: 0; top: 0; bottom: 0; width: 50%;
    overflow: hidden;
  }
  .emp-banner-waves::before {
    content: ''; position: absolute; right: -20px; top: -40px;
    width: 280px; height: 280px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
  }
  .emp-banner-waves::after {
    content: ''; position: absolute; right: 40px; bottom: -30px;
    width: 200px; height: 200px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%);
  }

  .emp-stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;
    margin-bottom: 28px;
  }
  .emp-stat-card {
    background: #fff; border-radius: 16px; padding: 22px 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
    transition: all 0.3s ease; cursor: default;
  }
  .emp-stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 30px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04);
  }
  .emp-stat-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px;
  }
  .emp-stat-icon {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
  }
  .emp-stat-value {
    font-size: 24px; font-weight: 700; color: #0f172a;
    font-family: 'Outfit', sans-serif; letter-spacing: -0.02em;
  }
  .emp-stat-label {
    font-size: 13px; color: #64748b; margin-top: 2px;
  }

  .emp-main-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    margin-bottom: 28px;
  }
  .emp-card {
    background: #fff; border-radius: 16px; padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
  }
  .emp-card-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 20px;
  }
  .emp-card-header h3 {
    font-size: 16px; font-weight: 600; color: #0f172a;
    font-family: 'Outfit', sans-serif;
  }
  .emp-card-header select {
    padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
    font-size: 12px; color: #64748b; background: #fff;
    cursor: pointer; outline: none; font-family: inherit;
  }
  .emp-card-link {
    font-size: 13px; color: #6366f1; font-weight: 500;
    cursor: pointer; text-decoration: none; transition: color 0.2s;
  }
  .emp-card-link:hover { color: #4338ca; }

  .att-chart {
    display: flex; align-items: flex-end; gap: 8px; height: 140px;
    padding-top: 10px;
  }
  .att-chart-bar-wrap {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  }
  .att-chart-bars {
    flex: 1; display: flex; align-items: flex-end; gap: 3px; width: 100%;
  }
  .att-chart-bar {
    flex: 1; border-radius: 4px 4px 0 0; min-height: 4px;
    transition: height 0.6s cubic-bezier(0.4,0,0.2,1);
  }
  .att-chart-label {
    font-size: 11px; color: #94a3b8; font-weight: 500;
  }
  .att-legend {
    display: flex; gap: 20px; margin-top: 16px;
    padding-top: 16px; border-top: 1px solid #f1f5f9;
  }
  .att-legend-item {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: #64748b;
  }
  .att-legend-dot {
    width: 10px; height: 10px; border-radius: 4px;
  }

  .notif-feed-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 0; border-bottom: 1px solid #f1f5f9;
  }
  .notif-feed-item:last-child { border-bottom: none; }
  .notif-feed-icon {
    width: 34px; height: 34px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .notif-feed-text {
    flex: 1; font-size: 13px; color: #334155; line-height: 1.4;
  }
  .notif-feed-time {
    font-size: 11px; color: #94a3b8; white-space: nowrap; margin-top: 2px;
  }

  .doc-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  }
  .doc-card {
    display: flex; align-items: center; gap: 10px;
    padding: 12px; border-radius: 10px;
    border: 1px solid #f1f5f9; transition: all 0.2s ease;
  }
  .doc-card:hover {
    border-color: #e0e7ff; background: #fafaff;
  }
  .doc-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: #eef2ff; color: #6366f1;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .doc-info { flex: 1; min-width: 0; }
  .doc-info div:first-child {
    font-size: 12px; font-weight: 600; color: #0f172a;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .doc-info div:last-child {
    font-size: 11px; color: #94a3b8;
  }
  .doc-btn {
    width: 30px; height: 30px; border-radius: 8px;
    border: none; background: #f1f5f9; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #6366f1; transition: all 0.2s; flex-shrink: 0;
  }
  .doc-btn:hover { background: #6366f1; color: #fff; }

  .emp-right-col {
    display: flex; flex-direction: column; gap: 24px;
  }

  .profile-card-det {
    text-align: center; padding-bottom: 8px;
  }
  .profile-card-det .emp-avatar {
    width: 64px; height: 64px; font-size: 24px; margin: 0 auto 12px;
  }
  .profile-card-det h4 {
    font-size: 17px; font-weight: 700; color: #0f172a;
    font-family: 'Outfit', sans-serif;
  }
  .profile-card-det .pcd-designation {
    font-size: 13px; color: #6366f1; font-weight: 500; margin: 2px 0 8px;
  }
  .pcd-status {
    display: inline-block; padding: 3px 12px; border-radius: 20px;
    font-size: 11px; font-weight: 600; margin-bottom: 16px;
  }
  .pcd-details {
    text-align: left; border-top: 1px solid #f1f5f9; padding-top: 14px;
  }
  .pcd-detail-row {
    display: flex; justify-content: space-between; padding: 6px 0;
    font-size: 13px;
  }
  .pcd-detail-row span:first-child { color: #94a3b8; }
  .pcd-detail-row span:last-child { color: #0f172a; font-weight: 500; }

  .event-item {
    display: flex; gap: 14px; padding: 10px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .event-item:last-child { border-bottom: none; }
  .event-date {
    width: 48px; height: 52px; border-radius: 10px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #fff; flex-shrink: 0; line-height: 1.2;
  }
  .event-date .ed-num { font-size: 18px; font-weight: 700; font-family: 'Outfit', sans-serif; }
  .event-date .ed-mo { font-size: 10px; font-weight: 600; text-transform: uppercase; opacity: 0.9; }
  .event-info { flex: 1; }
  .event-info div:first-child {
    font-size: 13px; font-weight: 600; color: #0f172a;
  }
  .event-info div:last-child {
    font-size: 11px; color: #94a3b8;
  }

  .leave-item {
    margin-bottom: 14px;
  }
  .leave-item:last-child { margin-bottom: 0; }
  .leave-header {
    display: flex; justify-content: space-between; margin-bottom: 6px;
  }
  .leave-header span:first-child { font-size: 13px; color: #334155; font-weight: 500; }
  .leave-header span:last-child { font-size: 12px; color: #64748b; }
  .leave-bar-bg {
    height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;
  }
  .leave-bar-fill {
    height: 100%; border-radius: 3px;
    transition: width 0.6s ease;
  }
  .leave-overall {
    margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9;
    display: flex; justify-content: space-between; align-items: center;
  }
  .leave-overall div:first-child { font-size: 13px; color: #64748b; }
  .leave-overall div:last-child { font-size: 18px; font-weight: 700; color: #6366f1; font-family: 'Outfit', sans-serif; }

  .emp-btn {
    display: block; width: 100%; padding: 10px;
    border-radius: 10px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.2s ease;
    font-family: inherit; text-align: center;
  }
  .emp-btn-primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff; border: none;
  }
  .emp-btn-primary:hover {
    box-shadow: 0 4px 15px rgba(99,102,241,0.3);
    transform: translateY(-1px);
  }
  .emp-btn-outline {
    background: none; color: #6366f1;
    border: 1.5px solid #e0e7ff;
  }
  .emp-btn-outline:hover {
    background: #eef2ff; border-color: #6366f1;
  }

  .emp-footer {
    border-top: 1px solid #e2e8f0;
    padding: 16px 32px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12px; color: #94a3b8;
  }

  .emp-dropdown {
    position: absolute; top: calc(100% + 6px); right: 0;
    background: #fff; border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04);
    min-width: 240px; z-index: 200; overflow: hidden;
    animation: ddFadeIn 0.15s ease;
  }
  @keyframes ddFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  .emp-dropdown-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px; font-size: 13px; color: #334155;
    cursor: pointer; transition: background 0.15s;
    border: none; background: none; width: 100%; text-align: left;
    font-family: inherit;
  }
  .emp-dropdown-item:hover { background: #f8fafc; }
  .emp-dropdown-item.logout { color: #ef4444; border-top: 1px solid #f1f5f9; }

  @media (max-width: 1200px) {
    .emp-main-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .emp-sidebar { display: none; }
    .emp-content { padding: 20px 16px; }
    .emp-header { padding: 0 16px; }
    .emp-search-bar { width: 200px; }
    .emp-stats { grid-template-columns: repeat(2, 1fr); }
    .emp-banner { padding: 24px; }
    .emp-banner h1 { font-size: 20px; }
  }
  @media (max-width: 480px) {
    .emp-stats { grid-template-columns: 1fr; }
    .emp-search-bar { width: 140px; }
  }
`;
