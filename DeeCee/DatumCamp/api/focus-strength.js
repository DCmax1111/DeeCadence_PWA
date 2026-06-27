const { createClient } = require("@supabase/supabase-js");
const { clampBlock, groupFocusStrength } = require("../server/focusStrengthCore.cjs");

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
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

async function getAuthenticatedUser(supabaseAdmin, req) {
  const token = readBearer(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

function cleanText(value, max = 120) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1440, Math.round(n * 100) / 100));
}

async function ensureProfile(supabaseAdmin, user) {
  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: user.id, display_name: user.email || null, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
}

async function recordFocusSession(supabaseAdmin, user, body = {}) {
  const attempted = clampBlock(body.totalBlocksAttempted ?? body.total_blocks_attempted);
  const completed = Math.min(attempted, clampBlock(body.totalBlocksCompleted ?? body.total_blocks_completed));
  const duration = cleanMinutes(body.durationMinutes ?? body.duration_minutes);
  if (attempted < 0 || completed < 0) return { status: 400, body: { error: "Invalid focus block totals" } };

  await ensureProfile(supabaseAdmin, user);
  const row = {
    user_id: user.id,
    total_blocks_attempted: attempted,
    total_blocks_completed: completed,
    duration_minutes: duration,
    target_minutes: cleanMinutes(body.targetMinutes ?? body.target_minutes),
    task: cleanText(body.task),
    difficulty: cleanText(body.difficulty, 40),
    ended_reason: cleanText(body.endedReason ?? body.ended_reason, 40),
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
  };

  const { data, error } = await supabaseAdmin
    .from("focus_sessions")
    .insert([row])
    .select("id, total_blocks_attempted, total_blocks_completed, duration_minutes, created_at")
    .single();
  if (error) throw error;
  return { status: 201, body: { ok: true, session: data } };
}

async function getFocusStrength(supabaseAdmin, user, req) {
  const group = req.query && req.query.group === "month" ? "month" : "week";
  const limit = Math.max(1, Math.min(365, Number(req.query && req.query.limit) || 180));
  const since = new Date(Date.now() - limit * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("focus_sessions")
    .select("total_blocks_attempted, total_blocks_completed, duration_minutes, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const scores = groupFocusStrength(data || [], group);
  return { status: 200, body: { group, scores } };
}

module.exports = async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase server environment is not configured" });
  }

  try {
    const user = await getAuthenticatedUser(supabaseAdmin, req);
    if (!user) return res.status(401).json({ error: "Authentication required" });

    if (req.method === "GET") {
      const result = await getFocusStrength(supabaseAdmin, user, req);
      return res.status(result.status).json(result.body);
    }

    if (req.method === "POST") {
      const result = await recordFocusSession(supabaseAdmin, user, req.body || {});
      return res.status(result.status).json(result.body);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Focus strength request failed", error);
    return res.status(500).json({ error: "Focus strength request failed" });
  }
};
