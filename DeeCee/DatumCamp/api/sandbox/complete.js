const { createClient } = require("@supabase/supabase-js");
const {
  SANDBOX_PROVIDER,
  normalizePaymentStatus,
  processSandboxWebhook,
  signWebhookPayload
} = require("../../server/paymentCore.cjs");

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if ((process.env.PAYMENT_PROVIDER || "sandbox").toLowerCase() !== "sandbox") {
    return res.status(404).json({ error: "Sandbox checkout is disabled" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!supabaseAdmin || !secret) {
    return res.status(500).json({ error: "Sandbox payment environment is not configured" });
  }

  const reference = String((req.body && req.body.reference) || "").trim();
  const status = normalizePaymentStatus(req.body && req.body.status);
  if (!/^DC-[A-Z0-9-]{8,40}$/.test(reference) || !["successful", "failed", "abandoned"].includes(status)) {
    return res.status(400).json({ error: "Invalid sandbox payment request" });
  }

  try {
    const rawBody = JSON.stringify({
      event: `sandbox.payment.${status}`,
      eventId: `${SANDBOX_PROVIDER}-${Date.now()}`,
      provider: SANDBOX_PROVIDER,
      reference,
      status,
      testMode: true,
      occurredAt: new Date().toISOString()
    });
    const signature = signWebhookPayload(rawBody, secret);
    const result = await processSandboxWebhook({ supabaseAdmin, rawBody, signature });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Sandbox payment completion failed", error);
    return res.status(500).json({ error: "Sandbox payment completion failed" });
  }
};
