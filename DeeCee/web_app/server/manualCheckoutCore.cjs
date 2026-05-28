const crypto = require("node:crypto");

const PAYMENT_WINDOW_MINUTES = 30;
const OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MIN_USD_NGN_RATE = 100;
const MAX_USD_NGN_RATE = 10000;

const PLANS = Object.freeze({
  starter: Object.freeze({
    id: "starter",
    title: "Starter",
    amountUsd: 9.99,
    description: "Solo cadence tracking, local backup, and core stats"
  }),
  growth: Object.freeze({
    id: "growth",
    title: "Growth",
    amountUsd: 19.99,
    description: "Advanced quests, richer logs, and priority tools"
  }),
  operator: Object.freeze({
    id: "operator",
    title: "Operator",
    amountUsd: 39.99,
    description: "Full DeeCee operator layer and premium lab access"
  })
});

const BANK_ACCOUNTS = Object.freeze({
  lead_usd: Object.freeze({
    id: "lead_usd",
    bankName: "Lead Bank",
    accountNumber: "101019644",
    accountName: "Dominion Chinecherem Clinton",
    currency: "USD"
  }),
  moniepoint_ngn: Object.freeze({
    id: "moniepoint_ngn",
    bankName: "Moniepoint MFB",
    accountNumber: "8085318908",
    accountName: "Dominion Chinecherem Clinton",
    currency: "NGN"
  }),
  paga_ngn: Object.freeze({
    id: "paga_ngn",
    bankName: "PAGA",
    accountNumber: "1948013882",
    accountName: "Dominion Chinecherem Clinton",
    currency: "NGN"
  })
});

function safeUsdNgnRate(rawRate) {
  const rate = Number(rawRate || 1500);
  if (!Number.isFinite(rate)) return 1500;
  return Math.max(MIN_USD_NGN_RATE, Math.min(MAX_USD_NGN_RATE, Math.round(rate)));
}

function publicConfig(rawRate) {
  return {
    plans: Object.values(PLANS),
    accounts: Object.values(BANK_ACCOUNTS),
    paymentWindowMinutes: PAYMENT_WINDOW_MINUTES,
    usdNgnRate: safeUsdNgnRate(rawRate)
  };
}

function randomCode(length = 8) {
  if (!Number.isInteger(length) || length < 4 || length > 24) {
    throw new Error("Invalid code length");
  }
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => OTP_ALPHABET[byte % OTP_ALPHABET.length]).join("");
}

function makeReference(now = Date.now()) {
  return `DC-${now.toString(36).toUpperCase()}-${randomCode(4)}`;
}

function amountFor(plan, account, rawRate) {
  if (!plan || !account) throw new Error("Missing plan or account");
  if (account.currency === "USD") return plan.amountUsd;
  return Math.round(plan.amountUsd * safeUsdNgnRate(rawRate));
}

function normalizeProof(value, maxLength = 220) {
  const text = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxLength);
}

function metadataFor({ plan, account, reference, otp, expiresAt, rawRate }) {
  const usdNgnRate = safeUsdNgnRate(rawRate);
  return {
    plan_id: plan.id,
    plan_title: plan.title,
    plan_description: plan.description,
    price_usd: plan.amountUsd,
    usd_ngn_rate: usdNgnRate,
    account,
    otp,
    payment_note: `DCEE ${otp} ${reference}`,
    expires_at: expiresAt,
    proof_reference: "",
    sender_name: "",
    user_note: "",
    owner_notification: "not_sent"
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
    proofReference: metadata.proof_reference || "",
    senderName: metadata.sender_name || "",
    userNote: metadata.user_note || "",
    usdNgnRate: metadata.usd_ngn_rate
  };
}

function isExpired(row, now = Date.now()) {
  const expiresAt = row && row.metadata && row.metadata.expires_at;
  return !expiresAt || new Date(expiresAt).getTime() <= now;
}

function futureExpiry(now = Date.now()) {
  return new Date(now + PAYMENT_WINDOW_MINUTES * 60 * 1000).toISOString();
}

function validatePlanAndAccount(planId, accountId) {
  const plan = PLANS[planId];
  const account = BANK_ACCOUNTS[accountId];
  if (!plan) return { error: "Invalid plan" };
  if (!account) return { error: "Invalid payment account" };
  return { plan, account };
}

module.exports = {
  BANK_ACCOUNTS,
  PAYMENT_WINDOW_MINUTES,
  PLANS,
  amountFor,
  futureExpiry,
  isExpired,
  makeReference,
  metadataFor,
  normalizeProof,
  paymentView,
  publicConfig,
  randomCode,
  safeUsdNgnRate,
  validatePlanAndAccount
};
