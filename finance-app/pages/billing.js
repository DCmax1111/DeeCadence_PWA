import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { supabase } from '../lib/supabaseClient';

const FALLBACK_CONFIG = {
  paymentWindowMinutes: 30,
  usdNgnRate: 1500,
  plans: [
    { id: 'starter', title: 'Starter', amountUsd: 30, description: 'Solo operators - ledger + export' },
    { id: 'growth', title: 'Growth', amountUsd: 65, description: 'SMBs - multi-business + templates' },
    { id: 'operator', title: 'Operator', amountUsd: 120, description: 'Agencies - audit & white-label' }
  ],
  accounts: [
    { id: 'lead_usd', bankName: 'Lead Bank', accountNumber: '101019644', accountName: 'Dominion Chinecherem Clinton', currency: 'USD' },
    { id: 'moniepoint_ngn', bankName: 'Moniepoint MFB', accountNumber: '8085318908', accountName: 'Dominion Chinecherem Clinton', currency: 'NGN' },
    { id: 'paga_ngn', bankName: 'PAGA', accountNumber: '1948013882', accountName: 'Dominion Chinecherem Clinton', currency: 'NGN' }
  ]
};

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2
  }).format(Number(amount || 0));
}

function secondsUntil(expiresAt) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function Billing({ theme, setTheme }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(FALLBACK_CONFIG);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [proof, setProof] = useState({ senderName: '', proofReference: '', userNote: '' });
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    async function init() {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user ?? null);
    }
    init();
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const authHeaders = useCallback(async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadPendingPayment = useCallback(async function loadPendingPayment() {
    setLoading(true);
    try {
      const res = await axios.get('/api/checkout', { headers: await authHeaders() });
      if (res.data.config) setConfig(res.data.config);
      setPayment(res.data.payment || null);
    } catch (err) {
      console.error(err);
      setMessage('Could not load pending payment. You can still contact support after transfer.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!user) return;
    loadPendingPayment();
  }, [user, loadPendingPayment]);

  useEffect(() => {
    if (!payment?.expiresAt) return;
    setRemaining(secondsUntil(payment.expiresAt));
    const timer = setInterval(() => setRemaining(secondsUntil(payment.expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [payment?.expiresAt]);

  const expired = payment && remaining <= 0;

  async function startPayment(planId, accountId) {
    if (!user) {
      setMessage('Please sign in before starting a transfer.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post('/api/checkout', { planId, accountId }, { headers: await authHeaders() });
      if (res.data.config) setConfig(res.data.config);
      setPayment(res.data.payment);
      setProof({ senderName: '', proofReference: '', userNote: '' });
      setMessage(res.data.reused ? 'Existing pending payment restored.' : 'Fresh payment OTP generated. Use it in your transfer description.');
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || 'Checkout failed. Use the fallback account details below and contact support.');
    } finally {
      setLoading(false);
    }
  }

  async function submitProof(event) {
    event.preventDefault();
    if (!payment || expired) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.put('/api/checkout', { paymentId: payment.id, ...proof }, { headers: await authHeaders() });
      setPayment(res.data.payment);
      setMessage('Proof submitted. Your payment is still pending manual confirmation.');
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || 'Could not submit proof yet.');
    } finally {
      setLoading(false);
    }
  }

  const accountsByCurrency = useMemo(() => ({
    USD: config.accounts.filter((account) => account.currency === 'USD'),
    NGN: config.accounts.filter((account) => account.currency === 'NGN')
  }), [config.accounts]);

  return (
    <>
      <Head>
        <title>Billing - DeeCash</title>
      </Head>
      <Header user={user} setTheme={setTheme} theme={theme} />
      <main className="container">
        <h1 className="page-title">Manual transfer checkout</h1>
        <p className="muted">Start a payment request, transfer within 30 minutes, and include the generated OTP in your bank description.</p>

        {message && <div className="notice">{message}</div>}

        {payment && (
          <section className={`card active-payment ${expired ? 'expired' : ''}`}>
            <div className="payment-head">
              <div>
                <span className="eyebrow">Pending transfer</span>
                <h2>{payment.plan?.title} - {formatMoney(payment.amount, payment.currency)}</h2>
              </div>
              <strong className="timer">{expired ? 'Expired' : formatTimer(remaining)}</strong>
            </div>
            <div className="instruction-grid">
              <div><span>Bank</span><b>{payment.account?.bankName}</b></div>
              <div><span>Account</span><b>{payment.account?.accountNumber}</b></div>
              <div><span>Name</span><b>{payment.account?.accountName}</b></div>
              <div><span>Reference</span><b>{payment.reference}</b></div>
              <div className="wide"><span>Transfer description / narration</span><b>{payment.paymentNote}</b></div>
            </div>
            {expired ? (
              <p className="danger-text">This request expired. Start again to receive a fresh OTP.</p>
            ) : (
              <form className="proof-form" onSubmit={submitProof}>
                <input value={proof.senderName} onChange={(e) => setProof({ ...proof, senderName: e.target.value })} placeholder="Sender name used for transfer" />
                <input value={proof.proofReference} onChange={(e) => setProof({ ...proof, proofReference: e.target.value })} placeholder="Transfer reference / proof ID" />
                <input value={proof.userNote} onChange={(e) => setProof({ ...proof, userNote: e.target.value })} placeholder="Optional note" />
                <button className="btn-primary" disabled={loading} type="submit">Submit proof</button>
              </form>
            )}
          </section>
        )}

        <div className="plans">
          {config.plans.map((plan) => {
            const ngnAmount = Math.round(plan.amountUsd * config.usdNgnRate);
            return (
              <div key={plan.id} className="card plan">
                <h3>{plan.title}</h3>
                <p className="muted">{plan.description}</p>
                <div className="price">${plan.amountUsd}/mo</div>
                <small>NGN estimate: {formatMoney(ngnAmount, 'NGN')} at {config.usdNgnRate}/USD</small>
                <div className="pay-options">
                  {accountsByCurrency.USD.map((account) => (
                    <button key={account.id} className="btn-primary" disabled={loading} onClick={() => startPayment(plan.id, account.id)}>
                      Pay USD - {account.bankName}
                    </button>
                  ))}
                  {accountsByCurrency.NGN.map((account) => (
                    <button key={account.id} className="btn-secondary" disabled={loading} onClick={() => startPayment(plan.id, account.id)}>
                      Pay NGN - {account.bankName}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <section className="card fallback">
          <h2>Fallback transfer details</h2>
          <p className="muted">If checkout is unavailable, transfer to one of these accounts and contact support with your plan, sender name, and transfer reference.</p>
          <div className="account-list">
            {config.accounts.map((account) => (
              <article key={account.id}>
                <b>{account.bankName}</b>
                <span>{account.accountNumber} - {account.accountName}</span>
                <em>{account.currency}</em>
              </article>
            ))}
          </div>
        </section>
      </main>

      <style jsx>{`
        .plans { display:grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap:16px; }
        .plan, .active-payment, .fallback { padding:18px; }
        .price { font-weight:800; font-size:1.4rem; margin:10px 0 4px; }
        .pay-options { display:grid; gap:8px; margin-top:14px; }
        .btn-primary, .btn-secondary { padding:10px 14px; border-radius:10px; cursor:pointer; font-weight:800; }
        .btn-primary { background:linear-gradient(135deg,#0ea5ff,#2563eb); color:#fff; border:none; }
        .btn-secondary { background:transparent; color:var(--text); border:1px solid rgba(255,255,255,0.14); }
        .notice { margin:12px 0; border:1px solid rgba(14,165,255,0.22); background:rgba(14,165,255,0.08); padding:12px; border-radius:10px; }
        .payment-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .payment-head h2 { margin:4px 0 0; }
        .eyebrow { color:var(--accent); font-size:0.72rem; font-weight:900; text-transform:uppercase; }
        .timer { color:#67e8f9; font-size:1.4rem; }
        .active-payment.expired { border-color:rgba(248,113,113,0.38); }
        .instruction-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin:14px 0; }
        .instruction-grid div { border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px; }
        .instruction-grid span { display:block; color:var(--muted); font-size:0.78rem; }
        .instruction-grid b { display:block; margin-top:4px; overflow-wrap:anywhere; }
        .wide { grid-column:1 / -1; }
        .proof-form { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
        input { padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:transparent; color:var(--text); }
        .danger-text { color:#fca5a5; }
        .account-list { display:grid; gap:8px; }
        .account-list article { display:grid; grid-template-columns:1fr auto; gap:4px 12px; border-top:1px solid rgba(255,255,255,0.08); padding:10px 0; }
        .account-list span { color:var(--muted); }
        .account-list em { color:var(--accent); font-style:normal; font-weight:800; }
      `}</style>
    </>
  );
}
