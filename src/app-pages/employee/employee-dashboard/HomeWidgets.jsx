import React, { useState, useEffect } from 'react';
import { textToHtml, localYmd } from '@/lib/rich-text';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const when = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`);
const dm = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }); };

function Card({ title, action, children, wide }) {
  return (
    <div className={`emp-card hw-card${wide ? ' wide' : ''}`}>
      <div className="emp-card-header"><h3>{title}</h3>{action}</div>
      {children}
    </div>
  );
}
const Empty = ({ children }) => <div className="hw-empty">{children}</div>;

// The extra cards on the employee home page. A card with nothing to say is left out, except the ones everyone needs.
export default function HomeWidgets({ goTo }) {
  const [d, setD] = useState(null);
  const [notices, setNotices] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetch(`${API}/employee-home`, { headers: auth() }).then(r => r.json()).then(j => { if (j && j.employee) setD(j); }).catch(() => {});
    fetch(`${API}/announcements`, { headers: auth() }).then(r => r.json()).then(j => setNotices(j.announcements || [])).catch(() => {});
  }, []);

  if (!d) return null;
  const link = (key, label) => <button type="button" className="hw-link" onClick={() => goTo(key)}>{label}</button>;
  const away = d.on_leave.length + d.wfh_today.length;

  return (
    <>
      <style>{css}</style>
      {notices.length > 0 && (
        <Card title="Notice Board" wide>
          {notices.map(n => (
            <div key={n.id} className="hw-notice">
              <div className="hw-notice-h">
                {n.is_pinned ? <span className="hw-pin" title="Pinned">Pinned</span> : null}
                <b>{n.title}</b>
                <span className="hw-muted">{dm(localYmd(n.created_at))}</span>
              </div>
              {n.body && <div className="hw-notice-b open" dangerouslySetInnerHTML={{ __html: textToHtml(n.body) }} />}
            </div>
          ))}
        </Card>
      )}

      <div className="hw-grid">
        <Card title="Leave Balance" action={link('leave', 'Apply')}>
          {d.balances.length === 0 ? <Empty>No leave balance has been set yet.</Empty> : d.balances.map(b => {
            const pct = b.total > 0 ? Math.min(100, Math.round((b.used / b.total) * 100)) : 0;
            return (
              <div key={b.leave_type} className="hw-bal">
                <div className="hw-bal-h"><span>{b.leave_type}</span><b>{b.remaining} <small>of {b.total} left</small></b></div>
                <div className="hw-bar"><i style={{ width: pct + '%' }} /></div>
              </div>
            );
          })}
        </Card>

        <Card title="Latest Payslip" action={link('payslips', 'All payslips')}>
          {d.payslip ? (
            <div className="hw-slip">
              <span className="hw-muted">{MONTHS[d.payslip.month - 1]} {d.payslip.year}</span>
              <b>{money(d.payslip.net_salary)}</b>
              <span className="hw-muted">Net salary</span>
              <button type="button" className="hw-btn" onClick={() => goTo('payslips')}>View and download</button>
            </div>
          ) : <Empty>Your payslip will show here once HR approves it.</Empty>}
        </Card>

        {d.profile.percent < 100 && (
          <Card title="Complete Your Profile" action={link('profile', 'Open profile')}>
            <div className="hw-ring-row">
              <div className="hw-ring" style={{ '--p': d.profile.percent }}><b>{d.profile.percent}%</b></div>
              <div className="hw-missing">
                <span className="hw-muted">Still missing</span>
                {d.profile.missing.slice(0, 5).map(m => <div key={m}>{m}</div>)}
                {d.profile.missing.length > 5 && <div className="hw-muted">and {d.profile.missing.length - 5} more</div>}
              </div>
            </div>
          </Card>
        )}

        <Card title="Away Today" action={link('directory', 'Directory')}>
          {away === 0 ? <Empty>Everyone is available today.</Empty> : (
            <>
              {d.on_leave.map((p, i) => <div key={'l' + i} className="hw-row"><span>{p.full_name}</span><em className="hw-tag leave">{p.leave_type}</em><span className="hw-muted">till {dm(p.until)}</span></div>)}
              {d.wfh_today.map((p, i) => <div key={'w' + i} className="hw-row"><span>{p}</span><em className="hw-tag wfh">Work from home</em></div>)}
            </>
          )}
        </Card>

        {d.team.length > 0 && (
          <Card title="My Team">
            {d.team.map((p, i) => <div key={i} className="hw-row"><span>{p.full_name}</span><span className="hw-muted">{p.designation || ''}</span></div>)}
          </Card>
        )}

        {d.celebrations.length > 0 && (
          <Card title="This Week">
            {d.celebrations.map((c, i) => (
              <div key={i} className="hw-row">
                <span>{c.name}</span>
                <em className={`hw-tag ${c.kind}`}>{c.kind === 'birthday' ? 'Birthday' : `${c.years} yr${c.years > 1 ? 's' : ''} with us`}</em>
                <span className="hw-muted">{when(c.in_days)}</span>
              </div>
            ))}
          </Card>
        )}

        {d.expiring.length > 0 && (
          <Card title="Document Expiry" action={link('documents', 'Documents')}>
            {d.expiring.map((x, i) => (
              <div key={i} className="hw-row">
                <span>{x.document_type}</span>
                <em className={`hw-tag ${x.days_left < 0 ? 'bad' : 'warn'}`}>{x.days_left < 0 ? `Expired ${-x.days_left}d ago` : `${x.days_left}d left`}</em>
                <span className="hw-muted">{dm(x.expiry_date)}</span>
              </div>
            ))}
          </Card>
        )}

        {d.assets.length > 0 && (
          <Card title="My Assets">
            {d.assets.map((a, i) => (
              <div key={i} className="hw-row"><span>{a.name}</span><span className="hw-muted">{a.asset_type} &middot; {a.asset_tag}</span></div>
            ))}
          </Card>
        )}

        {d.tickets.length > 0 && (
          <Card title="Help Desk" action={link('helpdesk', 'Open')}>
            {d.tickets.map(t => (
              <div key={t.id} className="hw-row">
                <span>{t.subject}</span>
                <em className={`hw-tag ${t.last_from === 'hr' ? 'ok' : 'warn'}`}>{t.last_from === 'hr' ? 'HR replied' : t.status}</em>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}

const css = `
.hw-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); gap:16px; margin-bottom:20px; align-items:start; }
.hw-card { margin-bottom:0 !important; }
.hw-card.wide { margin-bottom:16px !important; }
.hw-link { background:none; border:none; padding:0; color:var(--brand); font-size:.78rem; font-weight:600; cursor:pointer; font-family:inherit; }
.hw-link:hover { text-decoration:underline; }
.hw-muted { color:#94a3b8; font-size:.76rem; }
.hw-empty { color:#94a3b8; font-size:13px; padding:12px 0 4px; }
.hw-row { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--glass-line, #f1f5f9); font-size:.84rem; }
.hw-row:last-child { border-bottom:none; }
.hw-row > span:first-child { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
.hw-tag { font-style:normal; font-size:.68rem; font-weight:700; padding:2px 8px; border-radius:20px; background:var(--brand-soft-2); color:var(--brand-dark); white-space:nowrap; }
.hw-tag.leave { background:#fef3c7; color:#b45309; } .hw-tag.wfh { background:#dbeafe; color:#1d4ed8; }
.hw-tag.birthday { background:#fce7f3; color:#be185d; } .hw-tag.anniversary { background:#ede9fe; color:#6d28d9; }
.hw-tag.warn { background:#fef3c7; color:#b45309; } .hw-tag.bad { background:#fee2e2; color:#b91c1c; } .hw-tag.ok { background:#dcfce7; color:#15803d; }
.hw-bal { padding:7px 0; }
.hw-bal-h { display:flex; justify-content:space-between; font-size:.84rem; margin-bottom:5px; }
.hw-bal-h b { font-weight:700; } .hw-bal-h small { font-weight:500; color:#94a3b8; }
.hw-bar { height:6px; border-radius:6px; background:var(--brand-soft-2); overflow:hidden; }
.hw-bar i { display:block; height:100%; border-radius:6px; background:linear-gradient(90deg,var(--brand),var(--brand-mid)); }
.hw-slip { display:flex; flex-direction:column; gap:2px; padding-top:6px; }
.hw-slip b { font-family:'Outfit',sans-serif; font-size:1.6rem; }
.hw-btn { margin-top:10px; align-self:flex-start; padding:7px 14px; border-radius:9px; border:1px solid var(--brand-line); background:var(--brand-soft); color:var(--brand-dark); font-weight:600; font-size:.8rem; cursor:pointer; font-family:inherit; }
.hw-btn:hover { background:var(--brand-soft-2); }
.hw-ring-row { display:flex; align-items:center; gap:18px; padding-top:6px; }
.hw-ring { width:78px; height:78px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; position:relative; }
.hw-ring:before { content:''; position:absolute; inset:0; border-radius:50%; background:conic-gradient(var(--brand) calc(var(--p) * 1%), var(--brand-soft-2) 0); -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 8px)); mask:radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 8px)); }
.hw-ring b { position:relative; font-family:'Outfit',sans-serif; font-size:1.05rem; }
.hw-missing { font-size:.82rem; display:flex; flex-direction:column; gap:3px; }
.hw-notice { padding:10px 2px; border-bottom:1px solid var(--glass-line, #f1f5f9); }
.hw-notice:last-child { border-bottom:none; }
.hw-notice-h { display:flex; align-items:center; gap:10px; } .hw-notice-h b { flex:1; font-size:.9rem; }
.hw-pin { font-size:.64rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; padding:2px 7px; border-radius:6px; background:var(--brand); color:#fff; }
.hw-notice-b { font-size:.84rem; color:#64748b; margin-top:5px; white-space:pre-wrap; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.hw-notice-b.open { display:block; }
`;
