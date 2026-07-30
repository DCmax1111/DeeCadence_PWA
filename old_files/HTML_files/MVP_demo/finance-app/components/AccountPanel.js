import React from 'react';

export default function AccountPanel({ user, entries = [] }) {
  const income = entries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);
  const expense = entries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = income + expense;

  return (
    <div className="account-panel" role="region" aria-label="Account summary">
      <div className="account-left" role="group" aria-label="User profile">
        <div className="avatar" aria-hidden="true" />
        <div>
          <div className="acct-name">{user?.email ?? 'Guest'}</div>
          <div className="acct-sub">{user ? 'Member' : 'Not signed in'}</div>
        </div>
      </div>
      <div className="account-right" aria-label="Current balance">
        <div className="small">Balance</div>
        <div className="big">${balance.toFixed(2)}</div>
      </div>

      <style jsx>{`
        .account-panel { display:flex; justify-content:space-between; align-items:center; gap:18px; padding:14px; border-radius:12px; background:linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border:1px solid rgba(255,255,255,0.04); margin-bottom:14px; }
        .account-left { display:flex; gap:12px; align-items:center; }
        @media (max-width:720px) {
          .account-panel { flex-direction:column; align-items:flex-start; }
          .account-right { width:100%; text-align:left; }
        }
        .avatar { width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#0ea5ff,#2563eb); box-shadow:0 8px 20px rgba(14,165,255,0.12); }
        .acct-name { font-weight:700; }
        .acct-sub { font-size:0.9rem; color:var(--muted); }
        .account-right { text-align:right; }
        .small { font-size:0.85rem; color:var(--muted); }
        .big { font-size:1.15rem; font-weight:800; }
      `}</style>
    </div>
  );
}
