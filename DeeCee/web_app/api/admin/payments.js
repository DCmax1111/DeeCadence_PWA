const { createClient } = require("@supabase/supabase-js");

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

const { activateSubscription, MANUAL_PROVIDER, normalizePaymentStatus } = require("../../server/paymentCore.cjs");
const { ownerProfile } = require("./me.js");

const VALID_OUTCOMES = new Set(["successful", "failed"]);

async function isOwnerRequest(req, supabaseAdmin) {
  const expectedToken = process.env.OWNER_ADMIN_TOKEN;
  const receivedToken = req.headers["x-owner-token"];
  if (!expectedToken || !receivedToken || receivedToken !== expectedToken) return false;
  const owner = await ownerProfile(req, supabaseAdmin);
  return Boolean(owner.isOwner);
}

function safeNote(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function listPayments(req, res) {
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  const allowedStatuses = ["pending", "successful", "succeeded", "failed", "abandoned", "expired", "refunded"];
  const safeStatus = allowedStatuses.includes(status) ? status : "pending";
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id, user_id, provider_transaction_id, amount, currency, status, metadata, created_at, updated_at")
    .eq("provider", MANUAL_PROVIDER)
    .eq("transaction_type", "subscription")
    .eq("status", safeStatus)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("List manual payments failed", error);
    return res.status(500).json({ error: "Unable to list payments" });
  }

  return res.status(200).json({ payments: data || [] });
}

async function verifyPayment(req, res) {
  const supabaseAdmin = getSupabaseAdmin();
  const { paymentId } = req.body || {};
  const status = normalizePaymentStatus(req.body && req.body.status);
  const ownerNote = safeNote(req.body && req.body.ownerNote);

  if (!paymentId || !VALID_OUTCOMES.has(status)) {
    return res.status(400).json({ error: "paymentId and a valid status are required" });
  }

  const { data: transaction, error: fetchError } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", paymentId)
    .eq("provider", MANUAL_PROVIDER)
    .maybeSingle();

  if (fetchError || !transaction) {
    return res.status(404).json({ error: "Payment not found" });
  }

  const now = new Date().toISOString();
  const metadata = {
    ...(transaction.metadata || {}),
    owner_verification: {
      status,
      note: ownerNote || null,
      verified_at: now
    }
  };

  const { error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({
      status,
      metadata,
      error_message: status === "failed" ? ownerNote || "Manual verification failed" : null,
      updated_at: now
    })
    .eq("id", paymentId)
    .eq("provider", MANUAL_PROVIDER);

  if (updateError) {
    console.error("Manual payment verification failed", updateError);
    return res.status(500).json({ error: "Unable to update payment" });
  }

  let activation = { activated: false };
  if (status === "successful") {
    activation = await activateSubscription(supabaseAdmin, transaction, MANUAL_PROVIDER, ownerNote);
  }

  return res.status(200).json({ ok: true, status, activation });
}

module.exports = async function handler(req, res) {
  if (!getSupabaseAdmin()) {
    return res.status(500).json({ error: "Supabase server environment is not configured" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!await isOwnerRequest(req, supabaseAdmin)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") return listPayments(req, res);
  if (req.method === "POST") return verifyPayment(req, res);

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
};
