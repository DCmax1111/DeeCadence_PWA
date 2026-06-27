const { createClient } = require("@supabase/supabase-js");
const {
  isValidUsername,
  normalizeDisplayName,
  normalizeEmail,
  normalizeUsername
} = require("../server/authCore.cjs");

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
  if (error || !data?.user) return null;
  return data.user;
}

function publicProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name
  };
}

async function ensureProfile(user) {
  const email = normalizeEmail(user.email || "");
  const metadata = user.user_metadata || {};
  const username = normalizeUsername(metadata.username || email.split("@")[0] || "");
  const displayName = normalizeDisplayName(metadata.display_name || metadata.name || username || "DC");
  const row = {
    id: user.id,
    email,
    display_name: displayName,
    updated_at: new Date().toISOString()
  };
  if (isValidUsername(username)) row.username = username;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("id,email,username,display_name")
    .single();
  if (error) throw error;
  return data;
}

module.exports = async function handler(req, res) {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase server environment is not configured" });
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id,email,username,display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      const profile = data || await ensureProfile(user);
      return res.status(200).json({ profile: publicProfile(profile) });
    }

    if (req.method === "PUT") {
      const username = normalizeUsername(req.body?.username || "");
      const displayName = normalizeDisplayName(req.body?.displayName || req.body?.name || "");
      if (!isValidUsername(username)) {
        return res.status(400).json({ error: "Username must be 3-24 characters using letters, numbers, or underscores." });
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", user.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return res.status(409).json({ error: "That username is already taken." });

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: user.id,
          email: normalizeEmail(user.email || ""),
          username,
          display_name: displayName,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" })
        .select("id,email,username,display_name")
        .single();
      if (error) throw error;
      return res.status(200).json({ profile: publicProfile(data) });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Profile request failed", error);
    return res.status(500).json({ error: "Profile request failed." });
  }
};
