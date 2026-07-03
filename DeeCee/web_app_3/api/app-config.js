const { createClient } = require("@supabase/supabase-js");

const CACHE_MS = 30 * 1000;
let cached = null;

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function readConfig(supabaseAdmin) {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  const { data, error } = await supabaseAdmin
    .from("app_config")
    .select("key, value, updated_at")
    .eq("key", "beta_testing_active")
    .maybeSingle();
  if (error) throw error;
  const value = {
    betaTestingActive: Boolean(data && data.value),
    updatedAt: data && data.updated_at ? data.updated_at : null
  };
  cached = { value, expiresAt: now + CACHE_MS };
  return value;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(200).json({ betaTestingActive: false, updatedAt: null, configured: false });
  }

  try {
    const config = await readConfig(supabaseAdmin);
    return res.status(200).json({ ...config, configured: true });
  } catch (error) {
    console.error("App config request failed", error);
    return res.status(500).json({ error: "App config request failed" });
  }
};
