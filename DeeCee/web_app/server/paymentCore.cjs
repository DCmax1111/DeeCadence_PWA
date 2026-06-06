const crypto = require("node:crypto");
const {
  PAYMENT_WINDOW_MINUTES,
  PLANS,
  amountFor,
  futureExpiry,
  isExpired,
  makeReference,
  metadataFor,
  paymentView: manualPaymentView,
  publicConfig: manualPublicConfig,
  safeUsdNgnRate,
  validatePlanAndAccount
} = require("./manualCheckoutCore.cjs");

const PAYMENT_STATUSES = Object.freeze(["pending", "successful", "failed", "abandoned", "refunded", "expired"]);
const SANDBOX_PROVIDER = "sandbox_pay";
const MANUAL_PROVIDER = "manual_bank";
const SANDBOX_METHOD = Object.freeze({
  id: "sandbox_card",
  label: "Sandbox Card",
  currency: "USD",
  description: "Test checkout simulator. No real money is moved."
});

function configuredProvider() {
  const provider = String(process.env.PAYMENT_PROVIDER || "sandbox").toLowerCase();
  return provider === "manual_bank" || provider === "manual" ? MANUAL_PROVIDER : SANDBOX_PROVIDER;
}

function publicCheckoutConfig(rawRate, options = {}) {
  if (configuredProvider() === MANUAL_PROVIDER) {
    return {
      ...manualPublicConfig(rawRate, options),
      provider: MANUAL_PROVIDER,
      mode: "manual"
    };
  }

  const manualConfig = manualPublicConfig(rawRate, options);
  return {
    provider: SANDBOX_PROVIDER,
    mode: "sandbox",
    plans: Object.values(PLANS),
    paymentMethods: [SANDBOX_METHOD],
    otherCurrencyAccounts: options.includeOtherCurrency
      ? manualConfig.accounts.filter((account) => account.currency !== "USD")
      : [],
    paymentWindowMinutes: PAYMENT_WINDOW_MINUTES,
    usdNgnRate: safeUsdNgnRate(rawRate)
  };
}

function normalizePaymentStatus(status) {
  const value = String(status || "").toLowerCase().trim();
  if (value === "success" || value === "succeeded" || value === "paid") return "successful";
  if (value === "cancelled" || value === "canceled") return "abandoned";
  if (PAYMENT_STATUSES.includes(value)) return value;
  return "";
}

function validateCheckoutChoice(planId, methodId, rawRate) {
  if (configuredProvider() === MANUAL_PROVIDER || methodId === "lead_usd" || methodId === "moniepoint_ngn" || methodId === "paga_ngn") {
    return validatePlanAndAccount(planId, methodId);
  }

  const plan = PLANS[planId];
  const method = methodId ? SANDBOX_METHOD.id === methodId && SANDBOX_METHOD : SANDBOX_METHOD;
  if (!plan) return { error: "Invalid plan" };
  if (!method) return { error: "Invalid payment method" };
  return {
    plan,
    method,
    account: null,
    amount: plan.amountUsd,
    currency: "USD",
    metadata: {
      plan_id: plan.id,
      plan_title: plan.title,
      plan_description: plan.description,
      price_usd: plan.amountUsd,
      billing_label: plan.billingLabel,
      access_days: plan.accessDays,
      usd_ngn_rate: safeUsdNgnRate(rawRate),
      payment_method: method,
      payment_mode: "sandbox",
      user_notification: "not_sent"
    }
  };
}

function createPaymentMetadata({ plan, account, reference, otp, expiresAt, rawRate, method }) {
  if (configuredProvider() === MANUAL_PROVIDER) {
    return metadataFor({ plan, account, reference, otp, expiresAt, rawRate });
  }
  return {
    plan_id: plan.id,
    plan_title: plan.title,
    plan_description: plan.description,
    price_usd: plan.amountUsd,
    billing_label: plan.billingLabel,
    access_days: plan.accessDays,
    usd_ngn_rate: safeUsdNgnRate(rawRate),
    payment_method: method || SANDBOX_METHOD,
    payment_mode: "sandbox",
    expires_at: expiresAt,
    user_notification: "not_sent"
  };
}

function createCheckoutUrl(reference, status = "successful") {
  const base = String(process.env.PAYMENT_SANDBOX_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002")
    .replace(/\/$/, "");
  const url = new URL(`${base}/sandbox-checkout.html`);
  url.searchParams.set("reference", reference);
  url.searchParams.set("status", status);
  return url.toString();
}

function signWebhookPayload(rawBody, secret) {
  if (!secret) throw new Error("Missing webhook secret");
  return crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function verifyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const expected = signWebhookPayload(rawBody, secret);
  const a = Buffer.from(String(signature), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function paymentView(row) {
  if (!row) return null;
  if (row.provider === MANUAL_PROVIDER) return manualPaymentView(row);
  const metadata = row.metadata || {};
  return {
    id: row.id,
    reference: row.provider_transaction_id,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: metadata.expires_at,
    plan: {
      id: metadata.plan_id,
      title: metadata.plan_title,
      description: metadata.plan_description,
      priceUsd: metadata.price_usd,
      billingLabel: metadata.billing_label,
      accessDays: metadata.access_days
    },
    method: metadata.payment_method || SANDBOX_METHOD,
    authorizationUrl: metadata.authorization_url || "",
    userNotification: metadata.user_notification || "not_sent",
    provider: row.provider
  };
}

async function activateSubscription(supabaseAdmin, transaction, source = SANDBOX_PROVIDER, ownerNote = null) {
  const metadata = transaction.metadata || {};
  const planSlug = metadata.plan_id;
  const { data: plan, error: planError } = await supabaseAdmin
    .from("plans")
    .select("id, tier")
    .eq("product", "deecee")
    .eq("tier", planSlug)
    .maybeSingle();

  if (planError || !plan) {
    return { activated: false, warning: "Payment confirmed, but no matching deecee plan exists." };
  }

  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: transaction.user_id, subscription_plan: plan.tier, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  const accessDays = Number(metadata.access_days || 30);
  periodEnd.setDate(periodEnd.getDate() + Math.max(1, Math.min(36500, accessDays)));

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        user_id: transaction.user_id,
        plan_id: plan.id,
        status: "active",
        provider: source,
        provider_subscription_id: `${source}-${transaction.provider_transaction_id}`,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        metadata: {
          source_transaction_id: transaction.id,
          owner_note: ownerNote,
          confirmed_at: periodStart.toISOString()
        },
        updated_at: periodStart.toISOString()
      },
      { onConflict: "provider,provider_subscription_id" }
    );

  if (error) {
    console.error("Subscription activation failed", error);
    return { activated: false, warning: "Payment confirmed, but subscription activation failed." };
  }
  return { activated: true };
}

async function sendUserPaymentNotification(supabaseAdmin, transaction) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_FROM_EMAIL) return "in_app";
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(transaction.user_id);
    const email = data && data.user && data.user.email;
    if (!email) return "in_app";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_FROM_EMAIL,
        to: email,
        subject: "DeeCee payment confirmed",
        text: `Your DeeCee ${transaction.metadata?.plan_title || "subscription"} payment is confirmed. Reference: ${transaction.provider_transaction_id}.`
      })
    });
    return response.ok ? "email_sent" : "email_failed";
  } catch (error) {
    console.error("User payment notification failed", error);
    return "email_failed";
  }
}

async function recordWebhookEvent(supabaseAdmin, payload, signatureValid) {
  try {
    await supabaseAdmin.from("webhook_events").insert([{
      provider: SANDBOX_PROVIDER,
      event_id: payload.eventId || payload.event_id || null,
      event_type: payload.event || "sandbox.payment.updated",
      signature_valid: signatureValid,
      payload
    }]);
  } catch (error) {
    console.warn("Webhook event was not recorded", error.message);
  }
}

async function processSandboxWebhook({ supabaseAdmin, rawBody, signature }) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const signatureValid = verifyWebhookSignature(rawBody, signature, secret);
  let payload = {};
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    payload = {};
  }
  await recordWebhookEvent(supabaseAdmin, payload, signatureValid);
  if (!signatureValid) return { status: 401, body: { error: "Invalid webhook signature" } };

  const reference = String(payload.reference || "").trim();
  const status = normalizePaymentStatus(payload.status);
  if (!/^DC-[A-Z0-9-]{8,40}$/.test(reference) || !status || status === "pending" || status === "expired") {
    return { status: 400, body: { error: "Invalid webhook payload" } };
  }

  const { data: transaction, error: fetchError } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("provider", SANDBOX_PROVIDER)
    .eq("provider_transaction_id", reference)
    .maybeSingle();
  if (fetchError || !transaction) return { status: 404, body: { error: "Payment not found" } };

  if (transaction.status === "successful" && status === "successful") {
    return { status: 200, body: { ok: true, status: transaction.status, reused: true } };
  }

  const now = new Date().toISOString();
  const nextMetadata = {
    ...(transaction.metadata || {}),
    provider_event: payload,
    provider_confirmed_at: status === "successful" ? now : null
  };
  let activation = { activated: false };
  if (status === "successful") {
    activation = await activateSubscription(supabaseAdmin, transaction, SANDBOX_PROVIDER, "sandbox webhook");
    nextMetadata.user_notification = await sendUserPaymentNotification(supabaseAdmin, transaction);
  }

  const { error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({
      status,
      metadata: nextMetadata,
      error_message: status === "failed" ? "Sandbox payment failed" : null,
      updated_at: now
    })
    .eq("id", transaction.id)
    .eq("provider", SANDBOX_PROVIDER);
  if (updateError) throw updateError;

  return { status: 200, body: { ok: true, status, activation } };
}

module.exports = {
  MANUAL_PROVIDER,
  PAYMENT_STATUSES,
  SANDBOX_METHOD,
  SANDBOX_PROVIDER,
  activateSubscription,
  amountFor,
  configuredProvider,
  createCheckoutUrl,
  createPaymentMetadata,
  futureExpiry,
  isExpired,
  makeReference,
  normalizePaymentStatus,
  paymentView,
  processSandboxWebhook,
  publicCheckoutConfig,
  signWebhookPayload,
  validateCheckoutChoice,
  verifyWebhookSignature
};
