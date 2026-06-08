const { createClient } = require("@supabase/supabase-js");

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : null;

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

function subscriptionView(row) {
  if (!row) return { tier: "free", active: false, status: "free" };
  const tier = row.plans && row.plans.tier ? row.plans.tier : "premium";
  return {
    tier,
    active: row.status === "active",
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    provider: row.provider
  };
}

let betaCache = null;

async function betaTestingActive() {
  const now = Date.now();
  if (betaCache && betaCache.expiresAt > now) return betaCache.value;
  const { data, error } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "beta_testing_active")
    .maybeSingle();
  if (error) {
    console.warn("Beta testing flag lookup failed", error.message);
    betaCache = { value: false, expiresAt: now + 30000 };
    return false;
  }
  const value = Boolean(data && data.value);
  betaCache = { value, expiresAt: now + 30000 };
  return value;
}

module.exports = async function handler(req, res) {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase server environment is not configured" });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });

    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (await betaTestingActive()) {
      return res.status(200).json({
        subscription: {
          tier: "beta_testing",
          active: true,
          status: "active",
          provider: "app_config",
          betaTestingActive: true
        }
      });
    }

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("status, provider, current_period_end, plans(tier)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    return res.status(200).json({ subscription: subscriptionView(data && data[0]) });
  } catch (err) {
    console.error("Subscription request failed", err);
    return res.status(500).json({ error: "Subscription request failed" });
  }
};
