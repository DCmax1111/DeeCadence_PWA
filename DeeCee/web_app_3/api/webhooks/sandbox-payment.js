const { createClient } = require("@supabase/supabase-js");
const { processSandboxWebhook } = require("../../server/paymentCore.cjs");

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function readRawBody(req) {
  if (typeof req.rawBody === "string") return req.rawBody;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !process.env.PAYMENT_WEBHOOK_SECRET) {
    return res.status(500).json({ error: "Payment webhook environment is not configured" });
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-deecee-signature"];
    const result = await processSandboxWebhook({ supabaseAdmin, rawBody, signature });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Sandbox webhook failed", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};
