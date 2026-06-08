const { createClient } = require("@supabase/supabase-js");
const {
  isGmailEmail,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  sanitizeAuthPayload,
  validatePassword
} = require("../../server/authCore.cjs");

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : null;

function publicProfile(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name
  };
}

async function passwordGrant(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: payload.error_description || payload.msg || "Invalid login details." };
  }
  return { session: payload };
}

async function profileByIdentifier(identifier) {
  const normalized = normalizeEmail(identifier);
  if (isGmailEmail(normalized)) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,username,display_name")
      .eq("email", normalized)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const username = normalizeUsername(identifier);
  if (!isValidUsername(username)) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,username,display_name")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function handleLogin(req, res) {
  const identifier = String(req.body?.identifier || "").trim();
  const password = String(req.body?.password || "");
  const passwordError = validatePassword(password);
  if (!identifier || passwordError) {
    return res.status(400).json({ error: passwordError || "Enter your Gmail or username." });
  }

  const profile = await profileByIdentifier(identifier);
  if (!profile || !profile.email || !isGmailEmail(profile.email)) {
    return res.status(401).json({ error: "Invalid Gmail/username or password." });
  }

  const result = await passwordGrant(profile.email, password);
  if (result.error) return res.status(401).json({ error: "Invalid Gmail/username or password." });
  return res.status(200).json({ session: result.session, profile: publicProfile(profile) });
}

async function handleRegister(req, res) {
  const { email, username, displayName, password } = sanitizeAuthPayload(req.body || {});
  if (!isGmailEmail(email)) return res.status(400).json({ error: "Use a Gmail address ending in @gmail.com." });
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: "Username must be 3-24 characters using letters, numbers, or underscores." });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("profiles")
    .select("id,email,username")
    .or(`email.eq.${email},username.eq.${username}`)
    .limit(1);
  if (existingError) throw existingError;
  if ((existing || []).length) {
    return res.status(409).json({ error: "That Gmail or username is already registered." });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName
    }
  });
  if (createError || !created?.user) {
    return res.status(400).json({ error: createError?.message || "Could not create account." });
  }

  const row = {
    id: created.user.id,
    email,
    username,
    display_name: displayName,
    updated_at: new Date().toISOString()
  };
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("id,email,username,display_name")
    .single();
  if (profileError) throw profileError;

  const result = await passwordGrant(email, password);
  if (result.error) {
    return res.status(201).json({ profile: publicProfile(profile), message: "Account created. Sign in with your Gmail and password." });
  }
  return res.status(201).json({ session: result.session, profile: publicProfile(profile) });
}

module.exports = async function handler(req, res) {
  try {
    if (!supabaseAdmin || !supabaseUrl || !anonKey) {
      return res.status(500).json({ error: "Supabase auth environment is not configured." });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const action = String(req.body?.action || "login");
    if (action === "register") return handleRegister(req, res);
    return handleLogin(req, res);
  } catch (error) {
    console.error("Password auth failed", error);
    return res.status(500).json({ error: "Account request failed." });
  }
};
