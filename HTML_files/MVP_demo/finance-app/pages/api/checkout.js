import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { withStrictRateLimit } from '../../lib/rateLimit.js';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : null;

const PAYMENT_WINDOW_MINUTES = 30;
const USD_NGN_RATE = Number(process.env.USD_NGN_RATE || 1500);
const OWNER_EMAIL = process.env.OWNER_NOTIFICATION_EMAIL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const PLANS = {
  starter: { id: 'starter', title: 'Starter', amountUsd: 30, description: 'Solo operators - ledger + export' },
  growth: { id: 'growth', title: 'Growth', amountUsd: 65, description: 'SMBs - multi-business + templates' },
  operator: { id: 'operator', title: 'Operator', amountUsd: 120, description: 'Agencies - audit & white-label' }
};

const BANK_ACCOUNTS = {
  lead_usd: {
    id: 'lead_usd',
    bankName: 'Lead Bank',
    accountNumber: '101019644',
    accountName: 'Dominion Chinecherem Clinton',
    currency: 'USD'
  },
  moniepoint_ngn: {
    id: 'moniepoint_ngn',
    bankName: 'Moniepoint MFB',
    accountNumber: '8085318908',
    accountName: 'Dominion Chinecherem Clinton',
    currency: 'NGN'
  },
  paga_ngn: {
    id: 'paga_ngn',
    bankName: 'PAGA',
    accountNumber: '1948013882',
    accountName: 'Dominion Chinecherem Clinton',
    currency: 'NGN'
  }
};

async function getAuthenticatedUser(req) {
  if (!supabaseAdmin) return null;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function publicConfig() {
  return {
    plans: Object.values(PLANS),
    accounts: Object.values(BANK_ACCOUNTS),
    paymentWindowMinutes: PAYMENT_WINDOW_MINUTES,
    usdNgnRate: USD_NGN_RATE
  };
}

function randomCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function makeReference() {
  return `DC-${Date.now().toString(36).toUpperCase()}-${randomCode(4)}`;
}

function amountFor(plan, account) {
  if (account.currency === 'USD') return plan.amountUsd;
  return Math.round(plan.amountUsd * USD_NGN_RATE);
}

function normalizeProof(value) {
  const text = String(value || '').trim();
  return text.slice(0, 220);
}

function metadataFor({ plan, account, reference, otp, expiresAt }) {
  return {
    plan_id: plan.id,
    plan_title: plan.title,
    plan_description: plan.description,
    price_usd: plan.amountUsd,
    usd_ngn_rate: USD_NGN_RATE,
    account,
    otp,
    payment_note: `DCASH ${otp} ${reference}`,
    expires_at: expiresAt,
    proof_reference: '',
    sender_name: '',
    user_note: '',
    owner_notification: 'not_sent'
  };
}

function paymentView(row) {
  if (!row) return null;
  const metadata = row.metadata || {};
  return {
    id: row.id,
    reference: row.provider_transaction_id,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    createdAt: row.created_at,
    expiresAt: metadata.expires_at,
    plan: {
      id: metadata.plan_id,
      title: metadata.plan_title,
      description: metadata.plan_description,
      priceUsd: metadata.price_usd
    },
    account: metadata.account,
    otp: metadata.otp,
    paymentNote: metadata.payment_note,
    proofReference: metadata.proof_reference || '',
    senderName: metadata.sender_name || '',
    userNote: metadata.user_note || '',
    usdNgnRate: metadata.usd_ngn_rate
  };
}

function isExpired(row) {
  const expiresAt = row?.metadata?.expires_at;
  return !expiresAt || new Date(expiresAt).getTime() <= Date.now();
}

async function expireOldPending(userId) {
  const { data } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'manual_bank')
    .eq('status', 'pending');

  const expired = (data || []).filter(isExpired);
  await Promise.all(expired.map((row) => supabaseAdmin
    .from('transactions')
    .update({
      status: 'expired',
      error_message: 'Payment window expired before confirmation.',
      updated_at: new Date().toISOString()
    })
    .eq('id', row.id)
    .eq('user_id', userId)));
}

async function findActivePending(userId, planId, accountId) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'manual_bank')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).find((row) => {
    const metadata = row.metadata || {};
    return metadata.plan_id === planId && metadata.account?.id === accountId && !isExpired(row);
  });
}

async function latestPending(userId) {
  await expireOldPending(userId);
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'manual_bank')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function sendOwnerNotification({ user, payment }) {
  if (!OWNER_EMAIL || !RESEND_API_KEY) return 'skipped';
  const subject = `DeeCash payment proof submitted - ${payment.provider_transaction_id}`;
  const metadata = payment.metadata || {};
  const body = [
    `User: ${user.email || user.id}`,
    `Reference: ${payment.provider_transaction_id}`,
    `Plan: ${metadata.plan_title}`,
    `Amount: ${payment.currency} ${payment.amount}`,
    `Account: ${metadata.account?.bankName} ${metadata.account?.accountNumber}`,
    `OTP/narration: ${metadata.payment_note}`,
    `Proof/reference: ${metadata.proof_reference || 'Not supplied'}`,
    `Sender: ${metadata.sender_name || 'Not supplied'}`,
    `Note: ${metadata.user_note || 'None'}`
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL || 'DeeCash <onboarding@resend.dev>',
      to: OWNER_EMAIL,
      subject,
      text: body
    })
  });
  return response.ok ? 'sent' : 'failed';
}

async function createPayment(user, planId, accountId) {
  const plan = PLANS[planId];
  const account = BANK_ACCOUNTS[accountId];
  if (!plan) return { status: 400, body: { error: 'Invalid plan' } };
  if (!account) return { status: 400, body: { error: 'Invalid payment account' } };
  await expireOldPending(user.id);
  const existing = await findActivePending(user.id, plan.id, account.id);
  if (existing) {
    return { status: 200, body: { payment: paymentView(existing), reused: true, config: publicConfig() } };
  }

  const reference = makeReference();
  const otp = randomCode(8);
  const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const amount = amountFor(plan, account);
  const metadata = metadataFor({ plan, account, reference, otp, expiresAt });

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .insert([{
      user_id: user.id,
      provider: 'manual_bank',
      provider_transaction_id: reference,
      amount,
      currency: account.currency,
      status: 'pending',
      transaction_type: 'subscription',
      metadata
    }])
    .select()
    .single();
  if (error) throw error;
  return { status: 201, body: { payment: paymentView(data), reused: false, config: publicConfig() } };
}

async function submitProof(user, body) {
  const paymentId = String(body.paymentId || '');
  if (!paymentId) return { status: 400, body: { error: 'Missing paymentId' } };

  const { data: payment, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .eq('provider', 'manual_bank')
    .single();
  if (error || !payment) return { status: 404, body: { error: 'Payment request not found' } };
  if (payment.status !== 'pending') return { status: 409, body: { error: `Payment is ${payment.status}` } };
  if (isExpired(payment)) {
    await expireOldPending(user.id);
    return { status: 410, body: { error: 'Payment window expired. Start again for a fresh OTP.' } };
  }

  const proofReference = normalizeProof(body.proofReference);
  const senderName = normalizeProof(body.senderName);
  const userNote = normalizeProof(body.userNote);
  if (!proofReference && !senderName) {
    return { status: 400, body: { error: 'Add a transfer reference or sender name to speed confirmation.' } };
  }

  const metadata = {
    ...(payment.metadata || {}),
    proof_reference: proofReference,
    sender_name: senderName,
    user_note: userNote,
    proof_submitted_at: new Date().toISOString()
  };

  const notification = await sendOwnerNotification({ user, payment: { ...payment, metadata } });
  metadata.owner_notification = notification;

  const { data, error: updateError } = await supabaseAdmin
    .from('transactions')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', payment.id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (updateError) throw updateError;
  return { status: 200, body: { payment: paymentView(data), notification } };
}

async function handler(req, res) {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase server environment is not configured' });
    }
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    if (req.method === 'GET') {
      const payment = await latestPending(user.id);
      return res.status(200).json({ payment: paymentView(payment), config: publicConfig() });
    }

    if (req.method === 'POST') {
      const result = await createPayment(user, req.body?.planId, req.body?.accountId);
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'PUT') {
      const result = await submitProof(user, req.body || {});
      return res.status(result.status).json(result.body);
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Checkout request failed' });
  }
}

export default withStrictRateLimit(handler);
