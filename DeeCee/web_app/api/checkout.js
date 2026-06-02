const { createClient } = require("@supabase/supabase-js");
const {
  MANUAL_PROVIDER,
  SANDBOX_PROVIDER,
  amountFor,
  configuredProvider,
  createCheckoutUrl,
  createPaymentMetadata,
  futureExpiry,
  isExpired,
  makeReference,
  paymentView,
  publicCheckoutConfig,
  validateCheckoutChoice
} = require("../server/paymentCore.cjs");
const { normalizeProof, randomCode } = require("../server/manualCheckoutCore.cjs");

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : null;

const USD_NGN_RATE = process.env.USD_NGN_RATE;
const OWNER_EMAIL = process.env.OWNER_NOTIFICATION_EMAIL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function readBearer(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

async function getAuthenticatedUser(req) {
  if (!supabaseAdmin) return null;
  const token = readBearer(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

async function ensureProfile(user) {
  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: user.id, display_name: user.email || null, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
}

async function expireOldPending(userId) {
  const provider = configuredProvider();
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "pending");

  if (error) throw error;
  const expired = (data || []).filter((row) => isExpired(row));
  await Promise.all(expired.map((row) => supabaseAdmin
    .from("transactions")
    .update({
      status: "expired",
      error_message: "Payment window expired before confirmation.",
      updated_at: new Date().toISOString()
    })
    .eq("id", row.id)
    .eq("user_id", userId)
    .eq("provider", provider)));
}

async function findActivePending(userId, planId, accountId) {
  const provider = configuredProvider();
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).find((row) => {
    const metadata = row.metadata || {};
    const chosen = provider === MANUAL_PROVIDER ? metadata.account && metadata.account.id : metadata.payment_method && metadata.payment_method.id;
    return metadata.plan_id === planId && chosen === accountId && !isExpired(row);
  });
}

async function latestPayment(userId) {
  await expireOldPending(userId);
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", configuredProvider())
    .in("status", ["pending", "successful", "failed", "abandoned", "refunded", "expired", "succeeded"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

async function sendOwnerNotification({ user, payment }) {
  if (!OWNER_EMAIL || !RESEND_API_KEY) return "skipped";
  const metadata = payment.metadata || {};
  const body = [
    `User: ${user.email || user.id}`,
    `Reference: ${payment.provider_transaction_id}`,
    `Plan: ${metadata.plan_title}`,
    `Amount: ${payment.currency} ${payment.amount}`,
    `Account: ${metadata.account && metadata.account.bankName} ${metadata.account && metadata.account.accountNumber}`,
    `OTP/narration: ${metadata.payment_note}`,
    `Proof/reference: ${metadata.proof_reference || "Not supplied"}`,
    `Sender: ${metadata.sender_name || "Not supplied"}`,
    `Note: ${metadata.user_note || "None"}`
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL || "DeeCee <onboarding@resend.dev>",
      to: OWNER_EMAIL,
      subject: `DeeCee payment proof submitted - ${payment.provider_transaction_id}`,
      text: body
    })
  });
  return response.ok ? "sent" : "failed";
}

async function createPayment(user, planId, accountId) {
  const provider = configuredProvider();
  const validation = validateCheckoutChoice(planId, accountId, USD_NGN_RATE);
  if (validation.error) return { status: 400, body: { error: validation.error } };

  const { plan, account, method } = validation;
  await ensureProfile(user);
  await expireOldPending(user.id);
  const existing = await findActivePending(user.id, plan.id, provider === MANUAL_PROVIDER ? account.id : method.id);
  if (existing) {
    return { status: 200, body: { payment: paymentView(existing), reused: true, config: publicCheckoutConfig(USD_NGN_RATE) } };
  }

  const reference = makeReference();
  const otp = randomCode(8);
  const expiresAt = futureExpiry();
  const amount = provider === MANUAL_PROVIDER ? amountFor(plan, account, USD_NGN_RATE) : plan.amountUsd;
  const currency = provider === MANUAL_PROVIDER ? account.currency : "USD";
  const metadata = createPaymentMetadata({ plan, account, method, reference, otp, expiresAt, rawRate: USD_NGN_RATE });
  if (provider === SANDBOX_PROVIDER) metadata.authorization_url = createCheckoutUrl(reference);

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .insert([{
      user_id: user.id,
      provider,
      provider_transaction_id: reference,
      amount,
      currency,
      status: "pending",
      transaction_type: "subscription",
      metadata
    }])
    .select()
    .single();
  if (error) throw error;
  return { status: 201, body: { payment: paymentView(data), reused: false, config: publicCheckoutConfig(USD_NGN_RATE), authorizationUrl: metadata.authorization_url || "" } };
}

async function submitProof(user, body) {
  if (configuredProvider() !== MANUAL_PROVIDER) {
    return { status: 400, body: { error: "Proof upload is only used by manual bank transfer checkout." } };
  }
  const paymentId = String((body && body.paymentId) || "");
  if (!paymentId) return { status: 400, body: { error: "Missing paymentId" } };

  const { data: payment, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", paymentId)
    .eq("user_id", user.id)
    .eq("provider", MANUAL_PROVIDER)
    .single();
  if (error || !payment) return { status: 404, body: { error: "Payment request not found" } };
  if (payment.status !== "pending") return { status: 409, body: { error: `Payment is ${payment.status}` } };
  if (isExpired(payment)) {
    await expireOldPending(user.id);
    return { status: 410, body: { error: "Payment window expired. Start again for a fresh OTP." } };
  }

  const proofReference = normalizeProof(body.proofReference);
  const senderName = normalizeProof(body.senderName);
  const userNote = normalizeProof(body.userNote);
  if (!proofReference && !senderName) {
    return { status: 400, body: { error: "Add a transfer reference or sender name to speed confirmation." } };
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
    .from("transactions")
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("user_id", user.id)
    .eq("provider", MANUAL_PROVIDER)
    .select()
    .single();
  if (updateError) throw updateError;
  return { status: 200, body: { payment: paymentView(data), notification } };
}

module.exports = async function handler(req, res) {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase server environment is not configured" });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });

    if (req.method === "GET") {
      const payment = await latestPayment(user.id);
      return res.status(200).json({ payment: paymentView(payment), config: publicCheckoutConfig(USD_NGN_RATE) });
    }

    if (req.method === "POST") {
      const result = await createPayment(user, req.body && req.body.planId, req.body && req.body.accountId);
      return res.status(result.status).json(result.body);
    }

    if (req.method === "PUT") {
      const result = await submitProof(user, req.body || {});
      return res.status(result.status).json(result.body);
    }

    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err) {
    console.error("Checkout request failed", err);
    return res.status(500).json({ error: "Checkout request failed" });
  }
};
