const { createClient } = require("@supabase/supabase-js");
const { normalizeEmail, normalizeUsername } = require("../../server/authCore.cjs");

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

function readBearer(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

async function getAuthenticatedUser(req, supabaseAdmin) {
  const token = readBearer(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function ownerProfile(req, supabaseAdmin) {
  const user = await getAuthenticatedUser(req, supabaseAdmin);
  if (!user) return { user: null, profile: null, isOwner: false };

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,username,display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  const expectedEmail = normalizeEmail(process.env.OWNER_GMAIL || process.env.OWNER_EMAIL || process.env.OWNER_NOTIFICATION_EMAIL || "");
  const expectedUsername = normalizeUsername(process.env.OWNER_USERNAME || "");
  const userEmail = normalizeEmail(profile?.email || user.email || "");
  const userUsername = normalizeUsername(profile?.username || "");
  const emailMatches = Boolean(expectedEmail && userEmail === expectedEmail);
  const usernameMatches = Boolean(expectedUsername && userUsername === expectedUsername);
  const isOwner = expectedUsername ? emailMatches && usernameMatches : emailMatches;

  return { user, profile, isOwner };
}

module.exports = async function handler(req, res) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase server environment is not configured" });
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ error: "Method not allowed" });
    }
    const { profile, isOwner } = await ownerProfile(req, supabaseAdmin);
    return res.status(200).json({
      isOwner,
      profile: profile ? {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        displayName: profile.display_name
      } : null
    });
  } catch (error) {
    console.error("Owner check failed", error);
    return res.status(500).json({ error: "Owner check failed" });
  }
};

module.exports.ownerProfile = ownerProfile;
module.exports.getSupabaseAdmin = getSupabaseAdmin;
