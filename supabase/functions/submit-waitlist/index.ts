import { createClient } from "supabase";

type WaitlistPayload = {
  fullName?: string;
  email?: string;
  country?: string;
  roleLabel?: string;
  currentTool?: string;
  biggestStruggle?: string;
  interestScore?: number;
  desiredFeatures?: string[];
  consentContact?: boolean;
  consentResearch?: boolean;
  source?: string;
  honeypot?: string;
  metadata?: Record<string, unknown>;
};

type CleanPayload = {
  full_name: string;
  email: string;
  country: string;
  role_label: string;
  current_tool: string;
  biggest_struggle: string;
  interest_score: number;
  desired_features: string[];
  consent_contact: boolean;
  consent_research: boolean;
  source: string;
  metadata: Record<string, unknown>;
};

class PublicError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseSecretKey = readSecretKey();
let supabaseClient: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn("submit-waitlist is missing SUPABASE_URL or a secret/service-role key.");
}

Deno.serve(async (request: Request) => {
  const cors = corsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!originAllowed(request)) {
    return json({ error: "Origin is not allowed." }, 403, cors);
  }

  if (request.method !== "POST") {
    return json({ error: "Use POST to join the waitlist." }, 405, cors);
  }

  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 12000) throw new PublicError("Submission is too large.", 413);

    const raw = await request.json().catch(() => {
      throw new PublicError("Invalid JSON body.", 400);
    }) as WaitlistPayload;

    if (clean(raw.honeypot).length) {
      return json({ ok: true, status: "accepted" }, 202, cors);
    }

    const cleaned = normalizePayload(raw, request);
    const ipHash = await hashValue(`${clientIp(request)}:${cleaned.email}`);
    cleaned.metadata.ip_hash = ipHash;
    await enforceRateLimit(ipHash, 8, 60 * 60 * 1000);

    const existing = await findExisting(cleaned.email);
    const result = existing
      ? await updateExisting(existing.id, cleaned)
      : await insertNew(cleaned);

    await logEvent(result.id, existing ? "updated_existing_waitlist_submission" : "created_waitlist_submission", {
      duplicate: Boolean(existing),
      country: cleaned.country,
      interest_score: cleaned.interest_score
    });

    return json({
      ok: true,
      id: result.id,
      duplicate: Boolean(existing),
      status: "accepted"
    }, existing ? 200 : 201, cors);
  } catch (error) {
    if (error instanceof PublicError) {
      return json({ error: error.message }, error.status, cors);
    }

    await logServerError(error, request);
    return json({
      error: "Orbit could not save your waitlist response right now. Please try again in a moment."
    }, 500, cors);
  }
});

function normalizePayload(payload: WaitlistPayload, request: Request): CleanPayload {
  const fullName = clean(payload.fullName).slice(0, 120);
  const email = clean(payload.email).toLowerCase().slice(0, 160);
  const country = clean(payload.country).slice(0, 80);
  const roleLabel = clean(payload.roleLabel).slice(0, 80);
  const currentTool = clean(payload.currentTool).slice(0, 120);
  const biggestStruggle = clean(payload.biggestStruggle).slice(0, 600);
  const interestScore = Number(payload.interestScore || 0);
  const desiredFeatures = Array.isArray(payload.desiredFeatures)
    ? payload.desiredFeatures.map(item => clean(item).slice(0, 80)).filter(Boolean).slice(0, 3)
    : [];

  if (fullName.length < 2) throw new PublicError("Please enter your name.", 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PublicError("Please enter a valid email address.", 422);
  if (!country) throw new PublicError("Please choose your country.", 422);
  if (!roleLabel) throw new PublicError("Please choose the closest role.", 422);
  if (!Number.isInteger(interestScore) || interestScore < 1 || interestScore > 5) throw new PublicError("Please choose your interest level.", 422);
  if (!desiredFeatures.length) throw new PublicError("Please choose at least one Orbit priority.", 422);
  if (biggestStruggle.length < 8) throw new PublicError("Please share a little more about what usually breaks your routine.", 422);
  if (payload.consentContact !== true) throw new PublicError("Email consent is required for the waitlist.", 422);

  return {
    full_name: fullName,
    email,
    country,
    role_label: roleLabel,
    current_tool: currentTool,
    biggest_struggle: biggestStruggle,
    interest_score: interestScore,
    desired_features: desiredFeatures,
    consent_contact: true,
    consent_research: payload.consentResearch === true,
    source: clean(payload.source).slice(0, 80) || "orbit_waitlist_public",
    metadata: {
      ...(isPlainObject(payload.metadata) ? payload.metadata : {}),
      received_at: new Date().toISOString(),
      origin: request.headers.get("origin") || "",
      user_agent: request.headers.get("user-agent") || "",
      ip_hash: ""
    }
  };
}

async function findExisting(email: string) {
  const { data, error } = await db()
    .from("waitlist_submissions")
    .select("id,status")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function insertNew(cleaned: CleanPayload) {
  const { data, error } = await db()
    .from("waitlist_submissions")
    .insert(cleaned)
    .select("id,status")
    .single();

  if (error) throw error;
  return data;
}

async function updateExisting(id: string, cleaned: CleanPayload) {
  const { data, error } = await db()
    .from("waitlist_submissions")
    .update({
      full_name: cleaned.full_name,
      country: cleaned.country,
      role_label: cleaned.role_label,
      current_tool: cleaned.current_tool,
      biggest_struggle: cleaned.biggest_struggle,
      interest_score: cleaned.interest_score,
      desired_features: cleaned.desired_features,
      consent_contact: cleaned.consent_contact,
      consent_research: cleaned.consent_research,
      source: cleaned.source,
      metadata: cleaned.metadata
    })
    .eq("id", id)
    .select("id,status")
    .single();

  if (error) throw error;
  return data;
}

async function enforceRateLimit(key: string, maxCount: number, windowMs: number) {
  const now = Date.now();
  const { data, error } = await db()
    .from("waitlist_rate_limits")
    .select("key,window_start,count")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;

  if (!data || now - new Date(data.window_start).getTime() > windowMs) {
    const { error: upsertError } = await db()
      .from("waitlist_rate_limits")
      .upsert({ key, window_start: new Date().toISOString(), count: 1 });
    if (upsertError) throw upsertError;
    return;
  }

  if (Number(data.count) >= maxCount) {
    throw new PublicError("Too many waitlist attempts. Please try again later.", 429);
  }

  const { error: updateError } = await db()
    .from("waitlist_rate_limits")
    .update({ count: Number(data.count) + 1 })
    .eq("key", key);
  if (updateError) throw updateError;
}

async function logEvent(submissionId: string, eventType: string, metadata: Record<string, unknown>) {
  const { error } = await db().from("waitlist_events").insert({
    submission_id: submissionId,
    event_type: eventType,
    metadata
  });
  if (error) console.warn("Could not log waitlist event", error.message);
}

async function logServerError(error: unknown, request: Request) {
  const message = error instanceof Error ? error.message : String(error);
  const { error: logError } = await db().from("waitlist_errors").insert({
    error_message: message.slice(0, 1000),
    metadata: {
      path: new URL(request.url).pathname,
      origin: request.headers.get("origin") || "",
      user_agent: request.headers.get("user-agent") || "",
      at: new Date().toISOString()
    }
  });
  if (logError) console.warn("Could not log waitlist error", logError.message);
}

function json(body: Record<string, unknown>, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" }
  });
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "*";
  const allowed = allowedOrigins();
  const allowOrigin = allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();
  return !origin || allowed.includes("*") || allowed.includes(origin);
}

function allowedOrigins() {
  return (Deno.env.get("ALLOWED_ORIGINS") || "*")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function readSecretKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const jsonValue = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!jsonValue) return "";
  try {
    const parsed = JSON.parse(jsonValue);
    const first = parsed.default || Object.values(parsed)[0];
    return typeof first === "string" ? first : "";
  } catch {
    return "";
  }
}

function db() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new PublicError("Waitlist backend is missing Supabase secrets.", 500);
  }
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return supabaseClient;
}

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

async function hashValue(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
