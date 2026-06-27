const STORAGE_KEY = "dc_web_state_v1";
const BACKUP_SCHEMA_VERSION = 1;
const MAX_LOGS_PER_MODULE = 240;
const MAX_ACTIVITY_ITEMS = 100;
const MAX_FOCUS_SESSIONS = 160;

const STAT_NAMES = ["Body", "Mind", "Spirit", "Knowledge", "Financial", "Dexterity"];

const MODULES = [
  { id: "financial", name: "Financial", stat: "Financial", color: "financial", desc: "Income, expenses, and cashflow" },
  { id: "spirit", name: "Spirit", stat: "Spirit", color: "spirit", desc: "Prayer, Bible, reflection, and leadership" },
  { id: "mind", name: "Mind", stat: "Mind", color: "mind", desc: "Focus, mood, and DeeCee" },
  { id: "energy", name: "Energy", stat: "Body", color: "energy", desc: "Sleep, water, exercise, and body care" },
  { id: "knowledge", name: "Knowledge", stat: "Knowledge", color: "knowledge", desc: "Reading, vocabulary, and skill practice" },
  { id: "dexterity", name: "Dexterity", stat: "Dexterity", color: "dexterity", desc: "Creative skill, craft, and VoxScope" }
];

const ONBOARDING_MODES = {
  Balanced: {
    modules: ["financial", "mind", "knowledge"],
    note: "Balanced keeps money clarity, focus, and learning close to the surface."
  },
  Focus: {
    modules: ["mind", "energy", "knowledge"],
    note: "Focus prioritizes attention, body fuel, and learning momentum."
  },
  Wellness: {
    modules: ["mind", "energy", "spirit"],
    note: "Wellness keeps Mind constant while lifting body care and reflection."
  },
  Creative: {
    modules: ["mind", "dexterity", "knowledge"],
    note: "Creative supports focus, skill practice, and original output."
  },
  Scholar: {
    modules: ["mind", "knowledge", "spirit"],
    note: "Scholar keeps focus, study, and reflection in the foreground."
  }
};

const QUESTS = [
  { id: "financial", title: "Log one expense", module: "Financial", route: "financial", target: 1 },
  { id: "spirit", title: "Log one prayer/reflection", module: "Spirit", route: "spirit", target: 1 },
  { id: "mind", title: "Complete one focus checkpoint", module: "Mind", route: "focus", target: 1 },
  { id: "energy", title: "Log water, sleep, or exercise", module: "Energy", route: "energy", target: 1 },
  { id: "knowledge", title: "Save one word or reading log", module: "Knowledge", route: "knowledge", target: 1 },
  { id: "dexterity", title: "Log one creative action", module: "Dexterity", route: "dexterity", target: 1 }
];

const PREMIUM_FEATURES = [
  "Cloud sync and account recovery",
  "Advanced trend analytics",
  "Expanded DeeCodex quizzes",
  "Full VoxScope training plans"
];

const PUBLIC_PLANS = [
  { id: "six_day", title: "6-Day Pass", amountUsd: 0.99, billingLabel: "6 days", description: "Short trial access for testing DeeCee's premium layer" },
  { id: "monthly", title: "Monthly", amountUsd: 3.99, billingLabel: "month", description: "Monthly DeeCee premium access" },
  { id: "yearly", title: "Yearly", amountUsd: 39.99, billingLabel: "year", description: "Annual DeeCee premium access" },
  { id: "lifetime", title: "One-Time", amountUsd: 99.99, billingLabel: "one-time", description: "One-time DeeCee premium access" }
];

const DEFAULT_STATE = {
  route: "home",
  theme: localStorage.getItem("dc_theme") || "system",
  settings: {
    name: localStorage.getItem("dc_name") || "DC",
    onboardingComplete: false,
    tutorialComplete: false,
    priorityModules: [],
    mode: "Balanced"
  },
  subscription: { tier: "free", active: false },
  auth: {
    ready: false,
    configured: false,
    user: null,
    profile: null,
    isOwner: false,
    message: ""
  },
  checkout: {
    config: null,
    payment: null,
    message: "",
    loading: false,
    remaining: 0,
    adminPayments: [],
    adminMessage: ""
  },
  appConfig: {
    betaTestingActive: false,
    loaded: false
  },
  focusStrength: {
    group: "week",
    scores: [],
    loading: false,
    message: ""
  },
  stats: { Body: 1, Mind: 1, Spirit: 1, Knowledge: 1, Financial: 1, Dexterity: 1 },
  logs: {
    financial: [],
    spirit: [],
    mind: [],
    energy: [],
    knowledge: [],
    dexterity: []
  },
  focusSessions: [],
  focusDebt: 0,
  activeFocus: null,
  activity: [],
  ui: {
    ledger: "personal",
    focusDuration: 25,
    focusDifficulty: "Medium",
    focusTaskDraft: "",
    showFocusForm: false,
    knowledgeMode: "browse",
    vocabSearch: "",
    flashIndex: 0,
    flashShow: false,
    quizIndex: 0,
    quizFeedback: "",
    activityExpanded: false,
    selectedPlanId: "",
    otherCurrencyPlanId: "",
    authEmail: "",
    authIdentifier: "",
    authUsername: "",
    authDisplayName: "",
    authMode: "register"
  }
};

const screen = document.querySelector("#screen");
const title = document.querySelector("#screenTitle");
const themeToggle = document.querySelector("#themeToggle");
const activeFocusPill = document.querySelector("#activeFocusPill");
const publicConfig = window.DEECEE_CONFIG || {};

let state = loadState();
let shouldScrollTop = false;
let focusTimerInterval = null;
let checkoutTimerInterval = null;
let supabaseClient = null;
let authDraft = {
  registerPassword: "",
  registerConfirm: "",
  loginPassword: ""
};

function loadState() {
  const saved = safeJson(localStorage.getItem(STORAGE_KEY));
  const migratedStats = safeJson(localStorage.getItem("dc_stats"));
  const base = clone(DEFAULT_STATE);
  if (migratedStats) base.stats = { ...base.stats, ...migratedStats };
  return mergeState(base, unwrapBackup(saved) || {});
}

function mergeState(base, patch) {
  const mergedLogs = { ...base.logs };
  Object.keys(base.logs).forEach((key) => {
    mergedLogs[key] = Array.isArray(patch.logs?.[key]) ? patch.logs[key].slice(-MAX_LOGS_PER_MODULE) : base.logs[key];
  });
  const mergedStats = { ...base.stats };
  STAT_NAMES.forEach((name) => {
    const value = Number(patch.stats?.[name]);
    if (Number.isFinite(value)) mergedStats[name] = clampStat(value);
  });
  return {
    ...base,
    ...patch,
    settings: { ...base.settings, ...(patch.settings || {}) },
    subscription: { ...base.subscription, ...(patch.subscription || {}) },
    auth: { ...base.auth },
    checkout: { ...base.checkout },
    appConfig: { ...base.appConfig },
    focusStrength: { ...base.focusStrength },
    stats: mergedStats,
    logs: mergedLogs,
    ui: { ...base.ui, ...(patch.ui || {}) },
    activity: Array.isArray(patch.activity) ? patch.activity.slice(0, MAX_ACTIVITY_ITEMS) : base.activity,
    focusSessions: Array.isArray(patch.focusSessions) ? patch.focusSessions.slice(-MAX_FOCUS_SESSIONS) : base.focusSessions,
    focusDebt: Number.isFinite(patch.focusDebt) ? patch.focusDebt : base.focusDebt,
    activeFocus: patch.activeFocus || base.activeFocus
  };
}

function saveState() {
  trimState();
  try {
    const persisted = clone(state);
    persisted.auth = clone(DEFAULT_STATE.auth);
    persisted.checkout = clone(DEFAULT_STATE.checkout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch (error) {
    console.warn("DeeCee could not save local state.", error);
  }
}

function trimState() {
  Object.keys(state.logs || {}).forEach((key) => {
    if (Array.isArray(state.logs[key])) state.logs[key] = state.logs[key].slice(-MAX_LOGS_PER_MODULE);
  });
  if (Array.isArray(state.activity)) state.activity = state.activity.slice(0, MAX_ACTIVITY_ITEMS);
  if (Array.isArray(state.focusSessions)) state.focusSessions = state.focusSessions.slice(-MAX_FOCUS_SESSIONS);
}

function safeJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unwrapBackup(value) {
  if (!value) return null;
  return value.state && value.meta ? value.state : value;
}

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toLocaleDateString("en-GB");
}

function nowIso() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clampStat(value) {
  return Math.max(1, Math.min(100, Math.round(value * 100) / 100));
}

function formatStat(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function rank(value) {
  if (value >= 95) return "SS";
  if (value >= 80) return "S";
  if (value >= 65) return "A";
  if (value >= 50) return "B";
  if (value >= 35) return "C";
  if (value >= 20) return "D";
  return "E";
}

function nextRankTarget(value) {
  if (value < 20) return 20;
  if (value < 35) return 35;
  if (value < 50) return 50;
  if (value < 65) return 65;
  if (value < 80) return 80;
  if (value < 95) return 95;
  return 100;
}

function currentRankFloor(value) {
  if (value >= 95) return 95;
  if (value >= 80) return 80;
  if (value >= 65) return 65;
  if (value >= 50) return 50;
  if (value >= 35) return 35;
  if (value >= 20) return 20;
  return 1;
}

function rankProgress(value) {
  const floor = currentRankFloor(value);
  const target = nextRankTarget(value);
  if (target === floor) return 100;
  return Math.max(0, Math.min(100, ((value - floor) / (target - floor)) * 100));
}

function averageStats() {
  const values = Object.values(state.stats);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bestStat() {
  return Object.entries(state.stats).sort((a, b) => b[1] - a[1])[0];
}

function weakestStat() {
  return Object.entries(state.stats).sort((a, b) => a[1] - b[1])[0];
}

function moduleByStat(stat) {
  return MODULES.find((mod) => mod.stat === stat) || MODULES[0];
}

function routeAccent(route) {
  const module = MODULES.find((mod) => mod.id === route);
  if (module) return `var(--${module.color})`;
  if (route === "focus") return "var(--focus)";
  if (route === "deecodex") return "var(--knowledge)";
  if (route === "stats") return "var(--gold)";
  return "var(--accent)";
}

function formatNaira(value) {
  return `NGN ${Number(value || 0).toLocaleString()}`;
}

function formatMoney(value, currency) {
  const amount = Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return currency === "USD" ? `$${amount}` : `NGN ${amount}`;
}

function hasSupabaseConfig() {
  return Boolean(publicConfig.supabaseUrl && publicConfig.supabaseAnonKey && window.supabase);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isGmailEmail(email) {
  return /^[a-z0-9._%+-]+@gmail\.com$/i.test(normalizeEmail(email));
}

function gmailOnlyMessage(email) {
  if (!String(email || "").trim()) return "Enter your Gmail address to continue.";
  return "DeeCee currently accepts Gmail addresses only. Please use an address ending in @gmail.com.";
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase().replace(/^@+/, "");
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,24}$/.test(normalizeUsername(username));
}

function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey);
  }
  return supabaseClient;
}

async function authHeaders() {
  const client = getSupabaseClient();
  if (!client) return {};
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(await authHeaders())
  };
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

async function passwordAuthRequest(payload) {
  const response = await fetch("/api/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Account request failed.");
  return body;
}

function checkoutPaymentExpired() {
  const expiresAt = state.checkout.payment?.expiresAt;
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function paymentStatusMessage(payment) {
  if (!payment) return "";
  if (payment.status === "successful") return "Payment confirmed. Your DeeCee subscription is unlocked.";
  if (payment.status === "failed") return "Payment failed. Choose a plan again to retry safely.";
  if (payment.status === "abandoned") return "Payment abandoned. Choose a plan again when you are ready.";
  if (payment.status === "refunded") return "Payment was refunded. Your subscription access may change after review.";
  if (payment.status === "expired") return "Payment window expired. Start again for a fresh checkout.";
  return "";
}

async function initAuth() {
  const client = getSupabaseClient();
  state.auth.configured = Boolean(client);
  if (!client) {
    state.auth.ready = true;
    state.auth.message = "Add Supabase URL and anon key in src/config.js to enable hosted checkout.";
    render();
    return;
  }

  const { data } = await client.auth.getSession();
  syncAuthSession(data?.session || null);
  client.auth.onAuthStateChange((event, session) => {
    syncAuthSession(session);
    if (event === "SIGNED_IN") {
      loadProfile();
      loadCloudState();
    }
    if (event === "SIGNED_OUT") {
      state.subscription = { tier: "free", active: false };
      state.checkout = { ...DEFAULT_STATE.checkout };
      state.auth.profile = null;
      state.auth.isOwner = false;
      saveState();
      render();
    }
  });
  state.auth.ready = true;
  saveState();
  render();
  if (state.auth.user) loadCloudState();
  if (state.auth.user) loadProfile();
}

function syncAuthSession(session) {
  state.auth.configured = true;
  state.auth.ready = true;
  state.auth.user = session?.user ? {
    id: session.user.id,
    email: session.user.email || ""
  } : null;
  state.auth.message = "";
}

async function signInWithEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!isGmailEmail(normalizedEmail)) {
    state.auth.message = gmailOnlyMessage(normalizedEmail);
    saveState();
    render();
    return;
  }
  const client = getSupabaseClient();
  if (!client) {
    state.auth.message = "Supabase is not configured yet.";
    saveState();
    render();
    return;
  }
  state.auth.message = "Sending secure sign-in link...";
  render();
  const redirectTo = publicConfig.appUrl || window.location.href.split("#")[0];
  const { error } = await client.auth.signInWithOtp({ email: normalizedEmail, options: { emailRedirectTo: redirectTo } });
  state.auth.message = error ? error.message : "Check your email for the sign-in link.";
  saveState();
  render();
}

async function applyAuthSession(session, profile = null) {
  const client = getSupabaseClient();
  if (!client || !session?.access_token || !session?.refresh_token) {
    state.auth.message = "Account created. Sign in with your Gmail and password.";
    saveState();
    render();
    return;
  }
  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });
  if (error) throw error;
  syncAuthSession({ user: session.user });
  if (profile) applyProfile(profile);
  await loadCloudState();
}

function applyProfile(profile) {
  if (!profile) return;
  state.auth.profile = profile;
  if (profile.displayName) {
    state.settings.name = profile.displayName;
    localStorage.setItem("dc_name", profile.displayName);
  }
  state.ui.authUsername = profile.username || state.ui.authUsername || "";
  state.ui.authDisplayName = profile.displayName || state.ui.authDisplayName || "";
}

async function loadProfile() {
  if (!state.auth.user) return;
  try {
    const payload = await apiRequest("/api/profile");
    applyProfile(payload.profile);
  } catch (error) {
    state.auth.message = error.message;
  }
  saveState();
  render();
}

async function registerWithPassword(form) {
  const data = new FormData(form);
  const email = normalizeEmail(data.get("email"));
  const username = normalizeUsername(data.get("username"));
  const displayName = String(data.get("displayName") || username || "DC").trim();
  const password = String(data.get("password") || "");
  const confirm = String(data.get("confirmPassword") || "");
  if (!isGmailEmail(email)) return setAuthMessage(gmailOnlyMessage(email));
  if (!isValidUsername(username)) return setAuthMessage("Username must be 3-24 characters using letters, numbers, or underscores.");
  if (password.length < 8) return setAuthMessage("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return setAuthMessage("Password must include letters, numbers, and at least one symbol.");
  }
  if (password !== confirm) return setAuthMessage("Passwords do not match.");

  state.auth.message = "Creating your DeeCee account...";
  saveState();
  render();
  try {
    const payload = await passwordAuthRequest({ action: "register", email, username, displayName, password });
    applyProfile(payload.profile);
    authDraft = { registerPassword: "", registerConfirm: "", loginPassword: "" };
    state.ui.authMode = "login";
    state.ui.authIdentifier = username || email;
    state.auth.message = payload.message || "Account created. Sign in with your Gmail or username and password.";
    saveState();
    render();
  } catch (error) {
    setAuthMessage(error.message);
  }
}

async function loginWithPassword(form) {
  const data = new FormData(form);
  const identifier = String(data.get("identifier") || "").trim();
  const password = String(data.get("password") || "");
  const normalizedIdentifier = normalizeEmail(identifier);
  const looksLikeEmail = identifier.includes("@");
  if (looksLikeEmail && !isGmailEmail(normalizedIdentifier)) return setAuthMessage(gmailOnlyMessage(normalizedIdentifier));
  if (!looksLikeEmail && !isValidUsername(identifier)) return setAuthMessage("Enter your Gmail or a valid username.");
  if (password.length < 8) return setAuthMessage("Password must be at least 8 characters.");

  state.auth.message = "Signing you in...";
  saveState();
  render();
  try {
    const payload = await passwordAuthRequest({ action: "login", identifier, password });
    await applyAuthSession(payload.session, payload.profile);
    state.auth.message = "Signed in successfully.";
    state.route = "home";
    saveState();
    setRoute("home");
  } catch (error) {
    setAuthMessage(error.message);
  }
}

function setAuthMessage(message) {
  state.auth.message = message;
  saveState();
  render();
}

async function signOut() {
  const client = getSupabaseClient();
  if (client) await client.auth.signOut();
}

async function loadCloudState() {
  if (!state.auth.user) return;
  await Promise.allSettled([loadSubscription(), loadCheckout(), loadFocusStrength(), loadOwnerAccess()]);
}

async function loadOwnerAccess() {
  if (!state.auth.user) {
    state.auth.isOwner = false;
    return;
  }
  try {
    const payload = await apiRequest("/api/admin/me");
    state.auth.isOwner = Boolean(payload.isOwner);
    if (payload.profile) applyProfile(payload.profile);
  } catch {
    state.auth.isOwner = false;
  }
  saveState();
  render();
}

async function loadSubscription() {
  try {
    const payload = await apiRequest("/api/subscription");
    state.subscription = payload.subscription || { tier: "free", active: false };
  } catch (error) {
    state.auth.message = error.message;
  }
  saveState();
  render();
}

async function loadCheckout() {
  if (!state.auth.user) return;
  state.checkout.loading = true;
  render();
  try {
    const payload = await apiRequest(`/api/checkout${state.ui.otherCurrencyPlanId ? "?otherCurrency=1" : ""}`);
    state.checkout.config = payload.config || state.checkout.config;
    state.checkout.payment = payload.payment || null;
    state.checkout.message = paymentStatusMessage(state.checkout.payment);
  } catch (error) {
    state.checkout.message = error.message;
  } finally {
    state.checkout.loading = false;
    saveState();
    render();
  }
}

async function loadAppConfig() {
  try {
    const response = await fetch("/api/app-config");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load app config");
    state.appConfig = {
      betaTestingActive: Boolean(payload.betaTestingActive),
      loaded: true,
      updatedAt: payload.updatedAt || null
    };
  } catch (error) {
    state.appConfig = { betaTestingActive: false, loaded: true, error: error.message };
  }
  saveState();
  render();
}

async function loadFocusStrength(group = state.focusStrength.group || "week") {
  if (!state.auth.user) return;
  state.focusStrength.loading = true;
  state.focusStrength.group = group;
  render();
  try {
    const payload = await apiRequest(`/api/focus-strength?group=${encodeURIComponent(group)}`);
    state.focusStrength.scores = Array.isArray(payload.scores) ? payload.scores : [];
    state.focusStrength.message = "";
  } catch (error) {
    state.focusStrength.message = error.message;
  } finally {
    state.focusStrength.loading = false;
    saveState();
    render();
  }
}

async function recordCloudFocusSession(session) {
  if (!state.auth.user || !session) return;
  const attempted = Math.max(0, Math.min(4, Number(session.endedOnBlock || session.completedBlocks || 0)));
  const completed = Math.max(0, Math.min(attempted, Number(session.completedBlocks || session.bankedSegments || 0)));
  try {
    await apiRequest("/api/focus-strength", {
      method: "POST",
      body: JSON.stringify({
        totalBlocksAttempted: attempted,
        totalBlocksCompleted: completed,
        durationMinutes: session.minutes || 0,
        targetMinutes: session.targetMinutes || session.minutes || 0,
        task: session.task || "",
        difficulty: session.difficulty || "",
        endedReason: session.endedReason || "local",
        metadata: {
          localId: session.id,
          blockLabel: session.blockLabel || "",
          creditedMinutes: session.creditedMinutes || 0,
          cancelled: Boolean(session.cancelled)
        }
      })
    });
    loadFocusStrength();
  } catch (error) {
    console.warn("Cloud focus session sync failed", error);
  }
}

async function loadOtherCurrency(planId) {
  state.ui.otherCurrencyPlanId = state.ui.otherCurrencyPlanId === planId ? "" : planId;
  saveState();
  await loadCheckout();
}

function isLikelyNigeria() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const language = navigator.language || "";
  return timezone === "Africa/Lagos" || language.toLowerCase().includes("-ng");
}

async function startCheckout(planId, accountId) {
  if (!state.auth.user) {
    state.checkout.message = "Sign in before starting checkout.";
    saveState();
    render();
    return;
  }
  state.checkout.loading = true;
  state.checkout.message = "";
  render();
  try {
    const payload = await apiRequest("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ planId, accountId })
    });
    state.checkout.config = payload.config || state.checkout.config;
    state.checkout.payment = payload.payment;
    state.checkout.message = payload.reused
      ? "Existing pending checkout restored."
      : (payload.authorizationUrl ? "Sandbox checkout opened. Complete the test payment there." : "Fresh OTP generated. Use it in your transfer description.");
    if (payload.authorizationUrl) {
      window.location.href = payload.authorizationUrl;
      return;
    }
  } catch (error) {
    state.checkout.message = error.message;
  } finally {
    state.checkout.loading = false;
    saveState();
    render();
  }
}

async function submitCheckoutProof(form) {
  if (!state.checkout.payment) return;
  const data = new FormData(form);
  state.checkout.loading = true;
  state.checkout.message = "";
  render();
  try {
    const payload = await apiRequest("/api/checkout", {
      method: "PUT",
      body: JSON.stringify({
        paymentId: state.checkout.payment.id,
        senderName: data.get("senderName"),
        proofReference: data.get("proofReference"),
        userNote: data.get("userNote")
      })
    });
    state.checkout.payment = payload.payment;
    state.checkout.message = "Proof submitted. Your plan is pending owner confirmation.";
  } catch (error) {
    state.checkout.message = error.message;
  } finally {
    state.checkout.loading = false;
    saveState();
    render();
  }
}

async function loadAdminPayments(token) {
  state.checkout.adminMessage = "Loading pending payments...";
  render();
  try {
    const headers = await authHeaders();
    const response = await fetch("/api/admin/payments?status=pending", {
      headers: { ...headers, "x-owner-token": token }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load admin payments");
    state.checkout.adminPayments = payload.payments || [];
    state.checkout.adminMessage = `${state.checkout.adminPayments.length} pending payment${state.checkout.adminPayments.length === 1 ? "" : "s"}.`;
    sessionStorage.setItem("dc_owner_token", token);
  } catch (error) {
    state.checkout.adminMessage = error.message;
  }
  saveState();
  render();
}

async function verifyAdminPayment(paymentId, status) {
  const token = sessionStorage.getItem("dc_owner_token") || "";
  if (!token) {
    state.checkout.adminMessage = "Enter owner token first.";
    saveState();
    render();
    return;
  }
  try {
    const headers = await authHeaders();
    const response = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", "x-owner-token": token },
      body: JSON.stringify({ paymentId, status })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not verify payment");
    state.checkout.adminMessage = status === "successful" ? "Payment approved." : "Payment failed.";
    await loadAdminPayments(token);
  } catch (error) {
    state.checkout.adminMessage = error.message;
    saveState();
    render();
  }
}

function statDelta(effects) {
  Object.entries(effects || {}).forEach(([name, delta]) => {
    if (!STAT_NAMES.includes(name)) return;
    state.stats[name] = clampStat((state.stats[name] || 1) + delta);
  });
}

function applyAction(action) {
  const effects = normalizeEffects(action);
  statDelta(effects);
  queueFloaters(effects);

  if (action.logKey) {
    state.logs[action.logKey].push({
      id: uid(),
      type: action.type,
      label: action.label,
      date: today(),
      createdAt: nowIso(),
      ...(action.payload || {})
    });
  }

  state.activity.unshift({
    id: uid(),
    module: action.module,
    label: action.label,
    effects,
    date: today(),
    createdAt: nowIso()
  });
  state.activity = state.activity.slice(0, MAX_ACTIVITY_ITEMS);
  saveState();
  render();
}

function normalizeEffects(action) {
  const effects = { ...(action.effects || {}) };
  if (effects.Mind > 0 && !["Mind", "DeeCee Focus"].includes(action.module)) {
    effects.Mind = Math.max(0.1, Math.round(effects.Mind * 25) / 100);
  }
  return effects;
}

function attentionScore() {
  const todayKey = new Date().toDateString();
  const todayMins = state.focusSessions
    .filter((session) => new Date(session.createdAt).toDateString() === todayKey)
    .reduce((sum, session) => sum + (session.minutes || 0), 0);
  return Math.max(0, Math.min(100, (todayMins * 2) - Math.floor(state.focusDebt / 3)));
}

function suggestedAction() {
  const openQuest = dailyQuests().find((quest) => !quest.done);
  if (openQuest) return openQuest.title;
  const priority = state.settings.priorityModules || [];
  if (priority.length) {
    const first = MODULES.find((mod) => mod.id === priority[0]);
    if (first) return `Give ${first.name} a priority win today.`;
  }
  if (state.focusDebt > 0) return "Clear a little focus debt with a DeeCee session.";
  const [name] = weakestStat();
  const mod = moduleByStat(name);
  return `Give ${mod.name} a small win today.`;
}

function setRoute(route, pushHash = true) {
  state.route = route;
  state.ui.activityExpanded = false;
  shouldScrollTop = true;
  if (pushHash && location.hash.slice(1) !== route) {
    location.hash = route;
    return;
  }
  saveState();
  render();
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem("dc_theme", theme);
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : theme;
  document.body.classList.toggle("light", resolved === "light");
  document.body.dataset.themeChoice = theme;
  themeToggle.textContent = theme === "system" ? "System" : theme === "light" ? "Light" : "Dark";
}

function setTitle(value) {
  title.textContent = value;
}

function render() {
  setTheme(state.theme);
  if (!state.settings.onboardingComplete && state.route !== "onboarding") {
    state.route = "onboarding";
  } else if (state.settings.onboardingComplete && !state.settings.tutorialComplete && state.route !== "tutorial") {
    state.route = "tutorial";
  } else if (!state.auth.user && state.route === "settings") {
    state.route = "account";
  }
  document.body.dataset.route = state.route;
  document.body.dataset.auth = state.auth.user ? "signed-in" : "signed-out";
  document.body.dataset.owner = state.auth.isOwner ? "true" : "false";
  document.body.style.setProperty("--route-accent", routeAccent(state.route));
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === state.route);
  });

  const routes = {
    home: renderHome,
    onboarding: renderOnboarding,
    tutorial: renderTutorial,
    account: renderAccount,
    stats: renderStats,
    focus: renderFocus,
    settings: renderSettings,
    financial: () => renderFinancial(),
    spirit: () => renderSpirit(),
    mind: () => renderMind(),
    energy: () => renderEnergy(),
    knowledge: () => renderKnowledge(),
    deecodex: () => renderDeeCodex(),
    dexterity: () => renderDexterity()
  };

  (routes[state.route] || renderHome)();
  afterRender();
}

function afterRender() {
  if (shouldScrollTop) {
    shouldScrollTop = false;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      screen.scrollTop = 0;
    });
  }
  if (state.route === "focus" && state.ui.showFocusForm && !state.activeFocus) {
    requestAnimationFrame(() => {
      const taskInput = document.querySelector("[data-focus-task]");
      if (taskInput && document.activeElement !== taskInput && !state.ui.focusTaskDraft) {
        taskInput.focus();
      }
    });
  }
  updateFocusPill();
  syncFocusTimer();
  syncCheckoutTimer();
}

function queueFloaters(effects) {
  const entries = Object.entries(effects || {}).filter(([, delta]) => delta !== 0);
  if (!entries.length) return;
  const layer = document.querySelector(".float-layer") || createFloatLayer();
  entries.forEach(([name, delta], index) => {
    const chip = document.createElement("div");
    chip.className = `stat-floater ${delta > 0 ? "gain" : "loss"}`;
    chip.textContent = `${name} ${delta > 0 ? "+" : ""}${formatStat(delta)}`;
    chip.style.left = `${50 + ((index % 3) - 1) * 16}%`;
    chip.style.animationDelay = `${index * 80}ms`;
    layer.appendChild(chip);
    setTimeout(() => chip.remove(), 1800);
  });
}

function createFloatLayer() {
  const layer = document.createElement("div");
  layer.className = "float-layer";
  document.body.appendChild(layer);
  return layer;
}

function focusRemainingSeconds() {
  if (!state.activeFocus) return 0;
  const total = (state.activeFocus.minutes || 0) * 60;
  const elapsed = focusElapsedSeconds();
  return Math.max(0, total - elapsed);
}

function focusElapsedSeconds() {
  if (!state.activeFocus) return 0;
  const now = state.activeFocus.paused ? new Date(state.activeFocus.pausedAt).getTime() : Date.now();
  const pausedTotal = state.activeFocus.pausedTotalMs || 0;
  return Math.max(0, Math.floor((now - new Date(state.activeFocus.startedAt).getTime() - pausedTotal) / 1000));
}

function focusMindGain(minutes) {
  return minutes >= 45 ? 3 : minutes >= 25 ? 2 : 1;
}

function focusSegmentInfo() {
  if (!state.activeFocus) return { completed: 0, banked: 0, bankable: 0, current: 1, total: 4, elapsedSeconds: 0, totalSeconds: 1 };
  const totalSeconds = Math.max(1, (state.activeFocus.minutes || 1) * 60);
  const elapsedSeconds = Math.min(totalSeconds, focusElapsedSeconds());
  const completed = Math.min(4, Math.floor(elapsedSeconds / (totalSeconds / 4)));
  const banked = Math.min(4, state.activeFocus.bankedSegments || 0);
  const current = completed >= 4 ? 4 : Math.max(1, completed + 1);
  return { completed, banked, bankable: Math.max(0, completed - banked), current, total: 4, elapsedSeconds, totalSeconds };
}

function focusBlockSummary(segment = focusSegmentInfo()) {
  return `Block ${segment.current}/4`;
}

function focusElapsedMinutes(segment = focusSegmentInfo()) {
  return Math.round((segment.elapsedSeconds / 60) * 100) / 100;
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function syncFocusTimer() {
  if (focusTimerInterval) {
    clearInterval(focusTimerInterval);
    focusTimerInterval = null;
  }
  updateFocusTimer();
  if (state.activeFocus && state.route === "focus") {
    focusTimerInterval = setInterval(updateFocusTimer, 1000);
  } else if (state.activeFocus) {
    focusTimerInterval = setInterval(updateFocusPill, 1000);
  }
}

function syncCheckoutTimer() {
  if (checkoutTimerInterval) {
    clearInterval(checkoutTimerInterval);
    checkoutTimerInterval = null;
  }
  updateCheckoutTimer();
  if (state.checkout.payment && state.route === "settings") {
    checkoutTimerInterval = setInterval(updateCheckoutTimer, 1000);
  }
}

function updateCheckoutTimer() {
  const payment = state.checkout.payment;
  if (!payment?.expiresAt) return;
  state.checkout.remaining = Math.max(0, Math.floor((new Date(payment.expiresAt).getTime() - Date.now()) / 1000));
  const node = document.querySelector("[data-checkout-timer]");
  if (node) node.textContent = state.checkout.remaining <= 0 ? "Expired" : formatTimer(state.checkout.remaining);
}

function updateFocusTimer() {
  const timer = document.querySelector("[data-focus-timer]");
  const progress = document.querySelector("[data-focus-progress]");
  updateFocusPill();
  if (!timer || !state.activeFocus) return;
  const remaining = focusRemainingSeconds();
  const total = Math.max(1, (state.activeFocus.minutes || 1) * 60);
  const elapsedPct = Math.min(100, ((total - remaining) / total) * 100);
  timer.textContent = formatTimer(remaining);
  if (progress) progress.style.width = `${elapsedPct}%`;
  const segment = focusSegmentInfo();
  if (segment.bankable > 0 && !state.activeFocus.paused) {
    bankFocusSegments(segment.bankable, "checkpoint");
    return;
  }
  if (remaining <= 0 && !state.activeFocus.paused) autoCompleteFocus();
}

function updateFocusPill() {
  if (!activeFocusPill) return;
  const shouldShow = Boolean(state.activeFocus && state.route !== "focus");
  activeFocusPill.hidden = !shouldShow;
  if (!shouldShow) return;
  const timer = activeFocusPill.querySelector("[data-focus-pill-timer]");
  const label = activeFocusPill.querySelector("span");
  const remaining = focusRemainingSeconds();
  if (timer) timer.textContent = formatTimer(remaining);
  if (label) label.textContent = state.activeFocus.task || "Focus Running";
  const segment = focusSegmentInfo();
  if (segment.bankable > 0 && !state.activeFocus.paused) {
    bankFocusSegments(segment.bankable, "checkpoint");
    return;
  }
  if (remaining <= 0 && !state.activeFocus.paused) autoCompleteFocus();
}

function autoCompleteFocus() {
  if (!state.activeFocus || state.activeFocus.completing) return;
  state.activeFocus.completing = true;
  saveState();
  completeFocus("auto");
}

function shellGrid(main, side = "") {
  return `<div class="content-grid"><div class="stack">${main}</div>${side ? `<aside class="stack">${side}</aside>` : ""}</div>`;
}

function backButton() {
  return `<button class="ghost small" type="button" data-route="home">Back Home</button>`;
}

function activityList(limit = 8) {
  if (!state.activity.length) {
    return `<div class="empty">No activity yet. Log one small action to wake the system up.</div>`;
  }
  return state.activity.slice(0, limit).map((item) => {
    const effects = Object.entries(item.effects || {})
      .map(([name, delta]) => `${name} ${delta > 0 ? "+" : ""}${formatStat(delta)}`)
      .join(" / ");
    return `
      <article class="log-row">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.module)} - ${escapeHtml(item.date)}</span>
        </div>
        <b>${escapeHtml(effects)}</b>
      </article>
    `;
  }).join("");
}

function statBar(name, value = state.stats[name]) {
  const mod = moduleByStat(name);
  return `
    <article class="stat-row">
      <div class="stat-row-head">
        <strong>${name}</strong>
        <span style="color: var(--${mod.color})">${formatStat(value)} - Rank ${rank(value)}</span>
      </div>
      <div class="bar"><span style="width:${value}%; background: var(--${mod.color})"></span></div>
    </article>
  `;
}

function orderedModules() {
  const priority = state.settings.priorityModules || [];
  const selected = priority
    .map((id) => MODULES.find((mod) => mod.id === id))
    .filter(Boolean);
  const rest = MODULES.filter((mod) => !priority.includes(mod.id));
  return [...selected, ...rest];
}

function moduleCard(mod) {
  const value = state.stats[mod.stat] || 1;
  const recent = state.logs[mod.id]?.filter((entry) => entry.date === today()).length || 0;
  return `
    <button class="module-card" type="button" data-route="${mod.id}" style="--module-color: var(--${mod.color})">
      <span>${mod.name}</span>
      <small>${mod.desc}</small>
      <b>${formatStat(value)} - Rank ${rank(value)}</b>
      <em>${recent} today</em>
      <i class="bar"><span style="width:${value}%"></span></i>
    </button>
  `;
}

function dailyQuests() {
  const date = today();
  const financial = state.logs.financial.filter((entry) => entry.date === date && entry.kind === "expense").length;
  const spirit = state.logs.spirit.filter((entry) => entry.date === date && ["prayer", "bible"].includes(entry.type)).length;
  const focusMinutes = state.focusSessions
    .filter((session) => session.date === date)
    .reduce((sum, session) => sum + (session.minutes || 0), 0);
  const mind = Math.min(1, (state.focusSessions.filter((session) => session.date === date && session.bankedSegments > 0).length || 0) + (focusMinutes >= 15 ? 1 : 0));
  const energy = state.logs.energy.filter((entry) => entry.date === date && ["water", "sleep", "exercise"].includes(entry.type)).length;
  const knowledge = state.logs.knowledge.filter((entry) => entry.date === date && ["vocab", "reading"].includes(entry.type)).length;
  const dexterity = state.logs.dexterity.filter((entry) => entry.date === date).length;
  const progress = { financial, spirit, mind, energy, knowledge, dexterity };
  const priority = state.settings.priorityModules || [];
  const chosen = priority.length ? priority : ["mind", "knowledge", "financial"];
  const chosenQuestIds = chosen.map((id) => id === "focus" ? "mind" : id);
  return QUESTS.filter((quest) => chosenQuestIds.includes(quest.id)).slice(0, 3).map((quest) => ({
    ...quest,
    progress: Math.min(quest.target, progress[quest.id] || 0),
    done: (progress[quest.id] || 0) >= quest.target
  }));
}

function questSection() {
  const quests = dailyQuests();
  return `
    <section class="card quest-panel flat">
      <div class="card-head">
        <div>
          <h2>Daily Quests</h2>
          <p>${quests.filter((quest) => quest.done).length} / ${quests.length} cleared today</p>
        </div>
      </div>
      <div class="quest-list">
        ${quests.map((quest) => `
          <button class="quest-line ${quest.done ? "done" : ""}" type="button" data-route="${quest.route}" style="--module-color: ${routeAccent(quest.route)}">
            <i></i>
            <span>
              <small>${escapeHtml(quest.module)}</small>
              <strong>${escapeHtml(quest.title)}</strong>
            </span>
            <em>${quest.progress}/${quest.target}</em>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function rankPlate(value) {
  const currentRank = rank(value);
  const target = nextRankTarget(value);
  return `
    <section class="rank-plate">
      <div class="rank-badge">
        <span>Rank</span>
        <strong>${currentRank}</strong>
      </div>
      <div class="exp-panel">
        <div class="exp-head">
          <span>EXP ${formatStat(value)} / ${target}</span>
          <b>${formatStat(rankProgress(value))}%</b>
        </div>
        <div class="exp-bar"><span style="width:${rankProgress(value)}%"></span></div>
      </div>
    </section>
  `;
}

function renderHome() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const avg = averageStats();
  const [weakName, weakValue] = weakestStat();
  const [bestName, bestValue] = bestStat();
  setTitle("Today");

  const main = `
    ${betaBanner()}
    ${!state.auth.user ? signInFirstBanner() : ""}
    <section class="hero-card">
      <p>${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <h2>${greeting}, ${escapeHtml(state.settings.name || "DC")}</h2>
      ${rankPlate(avg)}
    </section>
    <section class="insight-strip">
      <article><span>Weakest</span><strong>${weakName} ${formatStat(weakValue)}</strong></article>
      <article><span>Strongest</span><strong>${bestName} ${formatStat(bestValue)}</strong></article>
      <article><span>Attention</span><strong>${attentionScore()}</strong></article>
    </section>
    <section class="module-grid">
      ${orderedModules().map(moduleCard).join("")}
    </section>
    ${focusStrengthCard()}
  `;

  const expanded = Boolean(state.ui.activityExpanded);
  const side = `
    ${questSection()}
    <section class="card next-move-card">
      <h2>Next Best Move</h2>
      <p>${suggestedAction()}</p>
    </section>
    <section class="card recent-panel ${expanded ? "expanded" : ""}">
      <div class="card-head">
        <div>
          <h2>Recent Activity</h2>
          <p>${expanded ? "Expanded feed" : "Latest 5"}</p>
        </div>
        <button class="ghost small" type="button" data-toggle-activity>${expanded ? "Collapse" : "View All"}</button>
      </div>
      <div class="stack tight">${activityList(expanded ? 18 : 5)}</div>
    </section>
    ${expanded ? `<button class="to-top" type="button" data-scroll-top>Top</button>` : ""}
  `;

  screen.innerHTML = shellGrid(main, side);
}

function signInFirstBanner() {
  return `
    <section class="card signin-banner">
      <div>
        <h2>Sign in first</h2>
        <p>You can preview DeeCee with default values, but sign-in is required for personal cloud subscription state and checkout.</p>
      </div>
      <button class="action" type="button" data-route="account">Sign In / Create Account</button>
    </section>
  `;
}

function betaBanner() {
  if (!state.appConfig?.betaTestingActive) return "";
  return `
    <section class="beta-marquee" aria-label="Beta testing notice">
      <span>Beta Testing Mode Active. Your feedback helps build DeeCadence!</span>
      <span aria-hidden="true">Beta Testing Mode Active. Your feedback helps build DeeCadence!</span>
    </section>
  `;
}

function focusStrengthCard() {
  const scores = state.focusStrength.scores || [];
  const latest = scores[scores.length - 1] || null;
  const latestScore = latest ? latest.focusStrengthScore : 0;
  const message = latest
    ? latest.message
    : "Complete one focus block to start building your Focus Strength graph.";
  return `
    <section class="card focus-strength-card">
      <div class="card-head">
        <div>
          <h2>Focus Strength</h2>
          <p>${escapeHtml(message)}</p>
        </div>
        <strong>${latest ? `${latestScore}/100` : "--"}</strong>
      </div>
      <div class="segmented mini-tabs" role="group" aria-label="Focus Strength range">
        ${["week", "month"].map((group) => `
          <button type="button" class="${state.focusStrength.group === group ? "selected" : ""}" data-focus-strength-group="${group}">
            ${group === "week" ? "Weekly" : "Monthly"}
          </button>
        `).join("")}
      </div>
      ${focusStrengthGraph(scores)}
      <div class="focus-strength-meta">
        <span>Completion ${latest ? latest.completionRate : 0}%</span>
        <span>Consistency ${latest ? latest.consistencyRate : 0}%</span>
        <span>${state.focusStrength.loading ? "Loading..." : `${scores.length} points`}</span>
      </div>
      ${state.auth.user ? "" : `<p class="notice-text">Sign in to sync Focus Strength across devices.</p>`}
    </section>
  `;
}

function focusStrengthGraph(scores = []) {
  const width = 640;
  const height = 220;
  const pad = 28;
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  if (!scores.length) {
    return `
      <div class="focus-chart empty-chart">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Empty Focus Strength chart">
          <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
          <text x="${width / 2}" y="${height / 2}" text-anchor="middle">No cloud focus data yet</text>
        </svg>
      </div>
    `;
  }
  const points = scores.map((item, index) => {
    const x = scores.length === 1 ? width / 2 : pad + (index / (scores.length - 1)) * usableWidth;
    const y = height - pad - (Number(item.focusStrengthScore || 0) / 100) * usableHeight;
    return { x, y, item };
  });
  const path = points.map((point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const prev = points[index - 1];
    const midX = (prev.x + point.x) / 2;
    return `C ${midX.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
  const area = `${path} L ${points[points.length - 1].x.toFixed(2)} ${height - pad} L ${points[0].x.toFixed(2)} ${height - pad} Z`;
  return `
    <div class="focus-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Focus Strength over time">
        <defs>
          <linearGradient id="focusStrengthFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.22" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
        <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" />
        <path class="chart-area" d="${area}" />
        <path class="chart-line" d="${path}" />
        ${points.map((point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4"><title>${escapeHtml(point.item.periodStart)}: ${point.item.focusStrengthScore}/100</title></circle>`).join("")}
      </svg>
    </div>
  `;
}

function renderOnboarding() {
  setTitle("Welcome");
  const selected = state.settings.priorityModules || [];
  const modes = Object.keys(ONBOARDING_MODES);
  const currentMode = ONBOARDING_MODES[state.settings.mode] ? state.settings.mode : "Balanced";
  screen.innerHTML = `
    <section class="onboarding-panel">
      <h2>Shape your cadence</h2>
      <p>Choose the modules DeeCee should keep closest to the surface. You can change this later.</p>
      <form class="stack" data-form="onboarding">
        <input class="field" name="name" value="${escapeHtml(state.settings.name || "")}" placeholder="What should DeeCee call you?" data-onboarding-name>
        <div class="choice-grid">
          ${MODULES.map((mod) => `
            <button class="choice-card ${selected.includes(mod.id) ? "selected" : ""}" type="button" data-onboard-module="${mod.id}" style="--module-color: var(--${mod.color})">
              <span>${mod.name}</span>
              <small>${mod.desc}</small>
            </button>
          `).join("")}
        </div>
        <label class="field-label">
          <span>Preferred cadence</span>
          <select class="field" name="mode" data-onboarding-mode>
            ${modes.map((mode) => `<option ${currentMode === mode ? "selected" : ""}>${mode}</option>`).join("")}
          </select>
        </label>
        <p class="mode-note">${escapeHtml(ONBOARDING_MODES[currentMode].note)}</p>
        <div class="button-row two">
          <button class="action" type="button" data-continue-onboarding>Continue</button>
          <button class="ghost" type="button" data-skip-onboarding>Skip</button>
        </div>
      </form>
    </section>
  `;
}

function renderTutorial() {
  setTitle("How It Works");
  screen.innerHTML = `
    <section class="onboarding-panel">
      <h2>DeeCee works like a living system</h2>
      <p>Log real actions, earn EXP, clear daily quests, and let one module strengthen another. Your local dashboard is usable immediately; account sign-in comes next for cloud subscription and checkout state.</p>
      <div class="choice-grid tutorial-grid">
        <article class="choice-card selected">
          <span>1. Log</span>
          <small>Income, focus, words, prayer, sleep, and creative actions all create traceable records.</small>
        </article>
        <article class="choice-card selected">
          <span>2. Compound</span>
          <small>Each action updates its main stat and small connected bonuses across the system.</small>
        </article>
        <article class="choice-card selected">
          <span>3. Unlock</span>
          <small>Sign in after the tutorial to keep subscription and payment state safely in Supabase.</small>
        </article>
      </div>
      <div class="button-row two">
        <button class="action" type="button" data-finish-tutorial>Continue to Account</button>
        <button class="ghost" type="button" data-preview-dashboard>Preview Dashboard</button>
      </div>
    </section>
  `;
}

function renderAccount() {
  setTitle("Account");
  const mode = state.ui.authMode || "register";
  screen.innerHTML = `
    <section class="onboarding-panel account-panel">
      <h2>${mode === "login" ? "Welcome back" : "Create your DeeCee account"}</h2>
      <p>${mode === "login"
        ? "Sign in with your Gmail or username and password."
        : "Use Gmail, choose a username, and create a password. DeeCee stores your profile while Supabase protects the password."}</p>
      <div class="segmented" role="group" aria-label="Account mode">
        <button type="button" class="${mode === "register" ? "selected" : ""}" data-auth-mode="register">Create Account</button>
        <button type="button" class="${mode === "login" ? "selected" : ""}" data-auth-mode="login">Sign In</button>
      </div>
      ${mode === "login" ? loginForm() : registerForm()}
      ${state.auth.message ? `<p class="notice-text">${escapeHtml(state.auth.message)}</p>` : ""}
      <p class="mode-note">Gmail only for now. Usernames are saved to DeeCee profiles; passwords are handled by Supabase Auth.</p>
    </section>
  `;
}

function registerForm() {
  const password = authDraft.registerPassword || "";
  const confirm = authDraft.registerConfirm || "";
  return `
    <form class="stack" data-form="auth-register">
      <input class="field" name="displayName" placeholder="Display name" value="${escapeHtml(state.ui.authDisplayName || state.settings.name || "")}" data-auth-display-name autocomplete="name">
      <input class="field" name="username" placeholder="Username" value="${escapeHtml(state.ui.authUsername || "")}" data-auth-username autocomplete="username" required>
      <input class="field" name="email" type="email" inputmode="email" autocomplete="email" placeholder="yourname@gmail.com" pattern="^[A-Za-z0-9._%+-]+@gmail\\.com$" title="Use a Gmail address ending in @gmail.com" value="${escapeHtml(state.ui.authEmail || "")}" data-auth-email required>
      <div class="field-row">
        <input class="field" name="password" type="password" autocomplete="new-password" placeholder="Password: 8+ chars, letters, numbers, symbol" value="${escapeHtml(password)}" data-auth-password="register" required>
        <input class="field" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Confirm password" value="${escapeHtml(confirm)}" data-auth-confirm-password required>
      </div>
      ${passwordChecklist(password, confirm)}
      <button class="action" type="submit">Create Account</button>
    </form>
  `;
}

function loginForm() {
  return `
    <form class="stack" data-form="auth-login">
      <input class="field" name="identifier" placeholder="Gmail or username" value="${escapeHtml(state.ui.authIdentifier || "")}" data-auth-identifier autocomplete="username" required>
      <input class="field" name="password" type="password" autocomplete="current-password" placeholder="Password" value="${escapeHtml(authDraft.loginPassword || "")}" data-auth-password="login" required>
      <button class="action" type="submit">Sign In</button>
    </form>
  `;
}

function passwordChecklist(password, confirm) {
  const checks = [
    { ok: password.length >= 8, label: "8 or more characters" },
    { ok: /[A-Za-z]/.test(password), label: "Has a letter" },
    { ok: /[0-9]/.test(password), label: "Has a number" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "Has a symbol" },
    { ok: Boolean(password) && password === confirm, label: "Passwords match" }
  ];
  return `
    <div class="password-rules" aria-live="polite">
      ${checks.map((check) => `<span class="${check.ok ? "ok" : ""}"><i></i>${escapeHtml(check.label)}</span>`).join("")}
    </div>
  `;
}

function syncPasswordFields() {
  const password = authDraft.registerPassword || "";
  const confirm = authDraft.registerConfirm || "";
  const passwordInput = document.querySelector("[data-auth-password='register']");
  const confirmInput = document.querySelector("[data-auth-confirm-password]");
  const mismatch = Boolean(confirm) && password !== confirm;
  if (confirmInput) {
    confirmInput.classList.toggle("invalid", mismatch);
    confirmInput.setAttribute("aria-invalid", mismatch ? "true" : "false");
    confirmInput.setCustomValidity(mismatch ? "Passwords do not match." : "");
  }
  if (passwordInput) {
    const invalid = Boolean(password) && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password) || password.length < 8);
    passwordInput.classList.toggle("invalid", invalid);
    passwordInput.setAttribute("aria-invalid", invalid ? "true" : "false");
  }
  const rules = document.querySelectorAll(".password-rules span");
  const checks = [
    password.length >= 8,
    /[A-Za-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
    Boolean(password) && password === confirm
  ];
  rules.forEach((rule, index) => rule.classList.toggle("ok", Boolean(checks[index])));
}

function renderStats() {
  const avg = averageStats();
  const [weakName, weakValue] = weakestStat();
  const [bestName, bestValue] = bestStat();
  setTitle("Stats");
  screen.innerHTML = shellGrid(`
    <section class="hero-card compact">
      <p>Overall</p>
      <h2>Rank ${rank(avg)}</h2>
      ${rankPlate(avg)}
    </section>
    <section class="insight-strip">
      <article><span>Best</span><strong>${bestName} ${formatStat(bestValue)}</strong></article>
      <article><span>Needs care</span><strong>${weakName} ${formatStat(weakValue)}</strong></article>
      <article><span>Actions</span><strong>${state.activity.length}</strong></article>
    </section>
    <section class="card">
      <h2>All Stats</h2>
      <div class="stack tight">${STAT_NAMES.map((name) => statBar(name)).join("")}</div>
    </section>
  `, `
    <section class="card activity-feed-card recent-panel ${state.ui.activityExpanded ? "expanded" : ""}">
      <div class="card-head">
        <div>
          <h2>Activity Feed</h2>
          <p>${state.ui.activityExpanded ? "Expanded feed" : "Latest 5"}</p>
        </div>
        <button class="ghost small" type="button" data-toggle-activity>${state.ui.activityExpanded ? "Collapse" : "View All"}</button>
      </div>
      <div class="stack tight">${activityList(state.ui.activityExpanded ? 18 : 5)}</div>
    </section>
    ${state.ui.activityExpanded ? `<button class="to-top" type="button" data-scroll-top>Top</button>` : ""}
  `);
}

function renderFinancial() {
  setTitle("Financial");
  const txns = state.logs.financial.filter((entry) => entry.ledger === state.ui.ledger);
  const income = txns.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const expense = txns.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const cashflow = income - expense;

  screen.innerHTML = shellGrid(`
    ${backButton()}
    <section class="insight-strip">
      <article><span>Income</span><strong>${formatNaira(income)}</strong></article>
      <article><span>Expense</span><strong>${formatNaira(expense)}</strong></article>
      <article><span>Cashflow</span><strong>${formatNaira(cashflow)}</strong></article>
    </section>
    <section class="card">
      <h2>Add Transaction</h2>
      <div class="segmented" role="group" aria-label="Ledger">
        <button type="button" class="${state.ui.ledger === "personal" ? "selected" : ""}" data-ledger="personal">Personal</button>
        <button type="button" class="${state.ui.ledger === "business" ? "selected" : ""}" data-ledger="business">Business</button>
      </div>
      <form class="stack" data-form="financial">
        <div class="field-row">
          <select name="kind" class="field">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <input name="amount" class="field" type="number" min="1" placeholder="Amount">
        </div>
        <input name="category" class="field" placeholder="Category">
        <input name="note" class="field" placeholder="Note optional">
        <button class="action" type="submit">Save Transaction</button>
      </form>
    </section>
  `, `
    <section class="card">
      <h2>Recent Transactions</h2>
      <div class="stack tight">${logRows(txns, "No transactions yet.")}</div>
    </section>
  `);
}

function renderSpirit() {
  setTitle("Spirit");
  const todaysPrayer = state.logs.spirit.filter((entry) => entry.type === "prayer" && entry.date === today()).length;
  const todaysBible = state.logs.spirit.filter((entry) => entry.type === "bible" && entry.date === today()).length;
  screen.innerHTML = shellGrid(`
    ${backButton()}
    <section class="insight-strip">
      <article><span>Prayers</span><strong>${todaysPrayer}</strong></article>
      <article><span>Reflection</span><strong>${todaysBible}</strong></article>
    </section>
    <section class="card">
      <h2>Prayer</h2>
      <div class="button-row">
        <button class="action" type="button" data-spirit-prayer="Morning Prayer">Morning</button>
        <button class="action" type="button" data-spirit-prayer="Night Prayer">Night</button>
        <button class="action" type="button" data-spirit-prayer="Prayer">Other</button>
      </div>
    </section>
    <section class="card">
      <h2>Bible / Reflection</h2>
      <form class="stack" data-form="bible">
        <input class="field" name="passage" placeholder="Passage or reflection">
        <button class="action" type="submit">Log Reflection</button>
      </form>
    </section>
  `, moduleRecent("spirit", "No spirit logs yet."));
}

function renderMind() {
  setTitle("Mind");
  screen.innerHTML = shellGrid(`
    ${backButton()}
    <button class="feature-card" type="button" data-route="focus">
      <span>DeeCee Focus</span>
      <strong>Attention ${attentionScore()} - Debt ${state.focusDebt}m</strong>
      <small>Focus sessions, distraction logs, and attention recovery.</small>
    </button>
    <section class="card">
      <h2>Quick Focus Log</h2>
      <form class="stack" data-form="mind-focus">
        <div class="field-row">
          <input class="field" name="minutes" type="number" min="1" placeholder="Minutes">
          <select class="field" name="focusType">
            <option>Deep Work</option>
            <option>Study</option>
            <option>Reading</option>
            <option>Creative</option>
            <option>Planning</option>
          </select>
        </div>
        <button class="action" type="submit">Log Focus</button>
      </form>
    </section>
    <section class="card">
      <h2>Mood Check</h2>
      <div class="button-row five">
        ${["Low", "OK", "Good", "Great", "Peak"].map((mood) => `<button class="ghost" type="button" data-mood="${mood}">${mood}</button>`).join("")}
      </div>
    </section>
  `, moduleRecent("mind", "No mind logs yet."));
}

function renderEnergy() {
  setTitle("Energy");
  const water = state.logs.energy.filter((entry) => entry.type === "water" && entry.date === today()).reduce((sum, entry) => sum + entry.glasses, 0);
  const sleep = state.logs.energy.find((entry) => entry.type === "sleep" && entry.date === today());
  const exercise = state.logs.energy.filter((entry) => entry.type === "exercise" && entry.date === today()).reduce((sum, entry) => sum + entry.minutes, 0);
  screen.innerHTML = shellGrid(`
    ${backButton()}
    <section class="insight-strip">
      <article><span>Sleep</span><strong>${sleep ? `${sleep.hours}h` : "-"}</strong></article>
      <article><span>Water</span><strong>${water} glasses</strong></article>
      <article><span>Exercise</span><strong>${exercise || "-"}m</strong></article>
    </section>
    <section class="card">
      <h2>Sleep</h2>
      <form class="stack" data-form="sleep">
        <div class="field-row">
          <input class="field" name="hours" type="number" step="0.5" min="0.5" placeholder="Hours">
          <input class="field" name="quality" type="number" min="1" max="5" placeholder="Quality 1-5">
        </div>
        <button class="action" type="submit">Log Sleep</button>
      </form>
    </section>
    <section class="card">
      <h2>Water</h2>
      <div class="button-row">
        <button class="action" type="button" data-water="1">+1 Glass</button>
        <button class="action" type="button" data-water="2">+2 Glasses</button>
        <button class="action" type="button" data-water="3">+3 Glasses</button>
      </div>
    </section>
    <section class="card">
      <h2>Exercise</h2>
      <form class="stack" data-form="exercise">
        <div class="field-row">
          <select class="field" name="kind"><option>Walking</option><option>Running</option><option>Gym</option><option>HIIT</option><option>Other</option></select>
          <input class="field" name="minutes" type="number" min="1" placeholder="Minutes">
        </div>
        <button class="action" type="submit">Log Exercise</button>
      </form>
    </section>
  `, moduleRecent("energy", "No energy logs yet."));
}

function renderKnowledge() {
  setTitle("Knowledge");
  const wordCount = vocabEntries().length;
  const quoteCount = quoteEntries().length;
  screen.innerHTML = shellGrid(`
    ${backButton()}
    <button class="feature-card knowledge-entry" type="button" data-route="deecodex">
      <span>DeeCodex</span>
      <strong>${wordCount} words - ${quoteCount} quotes</strong>
      <small>Dictionary, flashcards, quizzes, and saved ideas in one focused space.</small>
    </button>
    <section class="card">
      <h2>Reading</h2>
      <form class="stack" data-form="reading">
        <input class="field" name="title" placeholder="Book or article title">
        <input class="field" name="pages" type="number" min="0" placeholder="Pages optional">
        <button class="action" type="submit">Log Reading</button>
      </form>
    </section>
    <section class="card">
      <h2>Vocabulary</h2>
      <form class="stack" data-form="vocab">
        <input class="field" name="word" placeholder="Word">
        <input class="field" name="meaning" placeholder="Meaning">
        <button class="action" type="submit">Add Word</button>
      </form>
    </section>
    <section class="card">
      <h2>Skill Practice</h2>
      <form class="stack" data-form="skill">
        <input class="field" name="skill" placeholder="Skill">
        <input class="field" name="minutes" type="number" min="1" placeholder="Minutes">
        <button class="action" type="submit">Log Practice</button>
      </form>
    </section>
  `, `
    ${moduleRecent("knowledge", "No knowledge logs yet.")}
  `);
}

function renderDeeCodex() {
  setTitle("DeeCodex");
  screen.innerHTML = shellGrid(`
    ${backButton()}
    ${knowledgeLab()}
  `, `
    ${moduleRecent("knowledge", "No knowledge logs yet.")}
  `);
}

function renderDexterity() {
  setTitle("Dexterity");
  screen.innerHTML = shellGrid(`
    ${backButton()}
    <section class="feature-card static voxscope-card">
      <span>VoxScope</span>
      <strong>Voice range intelligence for creative growth</strong>
      <small>Range analysis, pitch mapping, XP progression, warmups, and artist comparison from the previous build.</small>
      <div class="feature-grid">
        <article><b>Range Analyzer</b><small>Find floor, ceiling, midpoint, and octave span.</small></article>
        <article><b>Pitch Detection</b><small>Map live notes to MIDI names and vocal zones.</small></article>
        <article><b>46 Artists</b><small>Compare your range with singers from Cash to Carey.</small></article>
        <article><b>Warmup Guides</b><small>Lip trills, sirens, humming scales, vowels, octave jumps.</small></article>
        <article><b>XP System</b><small>Practice sessions feed rank, streak, and craft momentum.</small></article>
        <article><b>Exercise Timer</b><small>Step-by-step drills for full range, mid range, and high notes.</small></article>
      </div>
    </section>
    <section class="card">
      <h2>Creative Session</h2>
      <form class="stack" data-form="dexterity">
        <div class="field-row">
          <select class="field" name="kind"><option>Drawing</option><option>Design</option><option>Writing</option><option>Music Practice</option><option>Vocal Practice</option><option>Other</option></select>
          <input class="field" name="minutes" type="number" min="1" placeholder="Minutes">
        </div>
        <textarea class="field" name="note" placeholder="What did you work on?"></textarea>
        <button class="action" type="submit">Log Session</button>
      </form>
    </section>
    <section class="card">
      <h2>Quick Log</h2>
      <div class="button-row">
        <button class="action" type="button" data-quick-dex="Sketching|15">Sketch 15m</button>
        <button class="action" type="button" data-quick-dex="Design|30">Design 30m</button>
        <button class="action" type="button" data-quick-dex="Writing|20">Write 20m</button>
      </div>
    </section>
  `, moduleRecent("dexterity", "No dexterity logs yet."));
}

function renderFocus() {
  setTitle("Focus");
  const active = state.activeFocus;
  const segment = focusSegmentInfo();
  const startLauncher = active ? "" : `
    <button class="feature-card" type="button" data-toggle-focus-form>
      <span>New Focus Session</span>
      <strong>${state.ui.focusDuration}m - ${state.ui.focusDifficulty}</strong>
      <small>Tap to choose task, duration, and difficulty.</small>
    </button>
  `;
  const startForm = active || !state.ui.showFocusForm ? "" : `
    <section class="card">
      <h2>Start Focus Session</h2>
      <form class="stack" data-form="start-focus">
        <input class="field" name="task" data-focus-task value="${escapeHtml(state.ui.focusTaskDraft || "")}" placeholder="What are you working on?" autocomplete="off">
        <div class="segmented" role="group" aria-label="Duration">
          ${[15, 25, 45, 90].map((mins) => `<button type="button" class="${state.ui.focusDuration === mins ? "selected" : ""}" data-focus-duration="${mins}">${mins}m</button>`).join("")}
        </div>
        <div class="segmented" role="group" aria-label="Difficulty">
          ${["Easy", "Medium", "Hard"].map((difficulty) => `<button type="button" class="${state.ui.focusDifficulty === difficulty ? "selected" : ""}" data-focus-difficulty="${difficulty}">${difficulty}</button>`).join("")}
        </div>
        <button class="action" type="button" data-start-focus>Begin Session</button>
      </form>
    </section>
  `;
  const activeHtml = active ? `
    <section class="hero-card compact focus-live">
      <p>${escapeHtml(active.difficulty)} focus${active.paused ? " - paused" : ""}</p>
      <h2>${escapeHtml(active.task)}</h2>
      <div class="focus-block-status">
        <strong>${focusBlockSummary(segment)}</strong>
        <span>${segment.completed}/4 complete - ${segment.banked}/4 banked</span>
      </div>
      <div class="timer-num" data-focus-timer>${formatTimer(focusRemainingSeconds())}</div>
      <div class="timer-track"><span data-focus-progress></span></div>
      ${focusCheckpointTrack(segment)}
      <div class="hero-metrics">
        <span>${active.minutes}m target</span>
        <span>Started ${new Date(active.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
        <span>${focusElapsedMinutes(segment)}m elapsed</span>
      </div>
      <div class="button-row focus-actions">
        <button class="ghost" type="button" data-pause-focus>${active.paused ? "Resume" : "Pause"}</button>
        <button class="ghost" type="button" data-abandon-focus>Abandon</button>
        <button class="action danger" type="button" data-complete-focus>End Session</button>
      </div>
    </section>
  ` : "";

  screen.innerHTML = shellGrid(`
    ${backButton()}
    <section class="insight-strip">
      <article><span>Attention</span><strong>${attentionScore()}</strong></article>
      <article><span>Debt</span><strong>${state.focusDebt}m</strong></article>
      <article><span>Sessions</span><strong>${state.focusSessions.length}</strong></article>
    </section>
    ${activeHtml}
    ${startLauncher}
    ${startForm}
    <section class="card">
      <h2>Log Distraction</h2>
      <form class="stack" data-form="distraction">
        <div class="field-row">
          <select class="field" name="kind"><option>Social Media</option><option>YouTube</option><option>Gaming</option><option>Phone browsing</option><option>Daydreaming</option><option>Other</option></select>
          <input class="field" name="hours" type="number" min="0.25" step="0.25" placeholder="Hours lost">
        </div>
        <button class="action danger" type="submit">Log Distraction</button>
      </form>
    </section>
  `, `
    <section class="card">
      <h2>Recent Sessions</h2>
      <div class="stack tight">${focusRows()}</div>
    </section>
  `);
}

function focusCheckpointTrack(segment = focusSegmentInfo()) {
  return `
    <div class="checkpoint-row" aria-label="Focus checkpoints">
      ${[1, 2, 3, 4].map((step) => `
        <span class="${segment.banked >= step ? "done" : segment.completed >= step ? "ready" : ""}">
          <b>Block ${step}</b>
          <small>${step}/4</small>
        </span>
      `).join("")}
    </div>
  `;
}

function renderSettings() {
  setTitle("Settings");
  screen.innerHTML = shellGrid(`
    ${authPanel()}
    ${subscriptionPanel()}
    ${checkoutPanel()}
    <section class="card">
      <h2>Display Name</h2>
      <form class="stack" data-form="settings-name">
        <input class="field" name="name" value="${escapeHtml(state.settings.name || "")}" placeholder="Your name">
        <button class="action" type="submit">Save Name</button>
      </form>
    </section>
    <section class="card">
      <h2>Theme</h2>
      <div class="button-row">
        <button class="action" type="button" data-theme="system">System</button>
        <button class="action" type="button" data-theme="dark">Dark</button>
        <button class="action" type="button" data-theme="light">Light</button>
      </div>
    </section>
    <section class="card">
      <div class="card-head">
        <div>
          <h2>Backup</h2>
          <p>Export before major changes. Import replaces this browser's local DeeCee data after validation.</p>
        </div>
      </div>
      <div class="button-row">
        <button class="action" type="button" data-export>Export JSON</button>
        <label class="action import-action">Import JSON<input type="file" data-import-file accept="application/json,.json"></label>
        <button class="action danger" type="button" data-reset>Reset Local Data</button>
      </div>
    </section>
    <section class="card">
      <h2>Onboarding</h2>
      <p>Update your name, priority modules, and preferred mode.</p>
      <button class="ghost" type="button" data-redo-onboarding>Redo Onboarding</button>
    </section>
  `, `
    <section class="card">
      <h2>Local First</h2>
      <p>Your stats, logs, and focus history stay in this browser. Account, checkout, and subscription state come from Supabase when configured.</p>
    </section>
    ${state.auth.isOwner ? adminPanel() : ""}
  `);
}

function moduleRecent(key, empty) {
  return `
    <section class="card">
      <h2>Recent</h2>
      <div class="stack tight">${logRows(state.logs[key], empty)}</div>
    </section>
  `;
}

function knowledgeLab() {
  const mode = state.ui.knowledgeMode || "browse";
  return `
    <section class="card knowledge-lab">
      <div class="card-head">
        <div>
          <h2>Knowledge Lab</h2>
          <p>Browse saved words and quotes, or rehearse them as flashcards and quizzes.</p>
        </div>
      </div>
      <div class="segmented lab-tabs" role="group" aria-label="Knowledge Lab modes">
        ${["browse", "flashcards", "quiz", "quotes"].map((item) => `
          <button type="button" class="${mode === item ? "selected" : ""}" data-knowledge-mode="${item}">
            ${item[0].toUpperCase()}${item.slice(1)}
          </button>
        `).join("")}
      </div>
      ${knowledgeLabBody(mode)}
    </section>
  `;
}

function knowledgeLabBody(mode) {
  if (mode === "flashcards") return flashcardMode();
  if (mode === "quiz") return quizMode();
  if (mode === "quotes") return quoteMode();
  return browseMode();
}

function vocabEntries() {
  return state.logs.knowledge
    .filter((entry) => entry.type === "vocab")
    .map(parseVocabEntry);
}

function quoteEntries() {
  return state.logs.knowledge.filter((entry) => entry.type === "quote");
}

function browseMode() {
  const search = (state.ui.vocabSearch || "").trim().toLowerCase();
  const words = vocabEntries().filter((entry) => {
    const haystack = `${entry.word} ${entry.meaning} ${entry.label || ""}`.toLowerCase();
    return !search || haystack.includes(search);
  }).slice().reverse();
  const quotes = quoteEntries().slice(-5).reverse();
  return `
    <div class="stack lab-body">
      <input class="field" data-vocab-search value="${escapeHtml(state.ui.vocabSearch || "")}" placeholder="Search dictionary">
      <div class="dictionary-list">
        ${words.length ? words.map(dictionaryEntry).join("") : `<div class="empty">No saved words match that search.</div>`}
      </div>
      <div class="quote-preview">
        <h3>Saved Quotes</h3>
        ${quotes.length ? quotes.map(quoteEntry).join("") : `<div class="empty">Saved quotes will appear here.</div>`}
      </div>
    </div>
  `;
}

function flashcardMode() {
  const words = vocabEntries();
  if (!words.length) return `<div class="empty">Add vocabulary first, then flashcards will appear here.</div>`;
  const index = clampIndex(state.ui.flashIndex, words.length);
  const entry = words[index];
  return `
    <button class="flashcard ${state.ui.flashShow ? "flipped" : ""}" type="button" data-flash-toggle aria-label="Flip flashcard">
      <span>${index + 1} / ${words.length}</span>
      <div class="flashcard-inner">
        <div class="flash-face flash-front">
          ${state.ui.flashShow ? "" : `<strong>${escapeHtml(entry.word)}</strong><p>Tap card to reveal meaning.</p>`}
        </div>
        <div class="flash-face flash-back">
          ${state.ui.flashShow ? `<strong>${escapeHtml(entry.word)}</strong><p>${escapeHtml(entry.meaning || "No meaning saved yet.")}</p>` : ""}
        </div>
      </div>
    </button>
    <div class="button-row two">
      <button class="ghost" type="button" data-flash-prev>Previous</button>
      <button class="ghost" type="button" data-flash-next>Next</button>
    </div>
  `;
}

function quizMode() {
  const words = vocabEntries();
  if (words.length < 2) return `<div class="empty">Add at least two vocabulary words to unlock quiz mode.</div>`;
  const index = clampIndex(state.ui.quizIndex, words.length);
  const entry = words[index];
  const choices = quizChoices(words, index);
  return `
    <div class="quiz-card">
      <span>Choose the meaning</span>
      <strong>${escapeHtml(entry.word)}</strong>
      ${state.ui.quizFeedback ? `<p>${escapeHtml(state.ui.quizFeedback)}</p>` : ""}
    </div>
    <div class="stack tight">
      ${choices.map((choice) => `
        <button class="ghost quiz-choice" type="button" data-quiz-choice="${choice.correct ? "1" : "0"}">
          ${escapeHtml(choice.text)}
        </button>
      `).join("")}
    </div>
  `;
}

function quoteMode() {
  const quotes = quoteEntries().slice().reverse();
  return `
    <form class="stack" data-form="quote">
      <textarea class="field" name="quote" placeholder="Save a quote, idea, or line worth remembering"></textarea>
      <input class="field" name="source" placeholder="Source optional">
      <button class="action" type="submit">Save Quote</button>
    </form>
    <div class="dictionary-list quotes-list">
      ${quotes.length ? quotes.map(quoteEntry).join("") : `<div class="empty">No quotes saved yet.</div>`}
    </div>
  `;
}

function dictionaryEntry(entry) {
  return `
    <article>
      <strong>${escapeHtml(entry.word)}</strong>
      <span>${escapeHtml(entry.meaning || "")}</span>
    </article>
  `;
}

function parseVocabEntry(entry) {
  const label = String(entry.label || "");
  const parts = label.split(":");
  const word = String(entry.word || parts[0] || "").trim();
  const meaning = String(entry.meaning || parts.slice(1).join(":") || "").trim();
  return { ...entry, word, meaning };
}

function quoteEntry(entry) {
  return `
    <article>
      <strong>${escapeHtml(truncate(entry.quote || entry.label, 90))}</strong>
      <span>${escapeHtml(entry.source || entry.date || "")}</span>
    </article>
  `;
}

function clampIndex(index, length) {
  if (!length) return 0;
  const n = Number(index) || 0;
  return ((n % length) + length) % length;
}

function quizChoices(words, answerIndex) {
  const answer = words[answerIndex];
  const others = words.filter((_, index) => index !== answerIndex).slice(0, 3);
  const choices = [
    { text: answer.meaning || answer.label, correct: true },
    ...others.map((entry) => ({ text: entry.meaning || entry.label, correct: false }))
  ];
  return choices.sort((a, b) => a.text.localeCompare(b.text));
}

function logRows(rows, empty) {
  if (!rows.length) return `<div class="empty">${empty}</div>`;
  return rows.slice(-8).reverse().map((entry) => `
    <article class="log-row">
      <div>
        <strong title="${escapeHtml(entry.label)}">${escapeHtml(formatLogTitle(entry))}</strong>
        <span>${escapeHtml(entry.date)}</span>
      </div>
      ${entry.amount ? `<b>${formatNaira(entry.amount)}</b>` : ""}
    </article>
  `).join("");
}

function formatLogTitle(entry) {
  if (entry.type === "vocab") {
    const parsed = parseVocabEntry(entry);
    return `${parsed.word}: ${truncate(parsed.meaning, 42)}`;
  }
  return entry.label;
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function focusRows() {
  if (!state.focusSessions.length) return `<div class="empty">No focus sessions yet.</div>`;
  return state.focusSessions.slice(-8).reverse().map((session) => `
    <article class="log-row">
      <div>
        <strong>${escapeHtml(session.task)}</strong>
        <span>${session.minutes}m - ${escapeHtml(session.difficulty)} - ${escapeHtml(session.blockLabel || "")}${session.blockLabel ? " - " : ""}${escapeHtml(session.date)}</span>
      </div>
      <b>${session.cancelled ? "No XP" : `Mind +${formatStat(session.mindGain ?? focusMindGain(session.minutes))}`}</b>
    </article>
  `).join("");
}

function authPanel() {
  if (!state.auth.configured) {
    return `
      <section class="card subscription-card">
        <h2>Account Login</h2>
        <p>Supabase is not configured yet. Add your public Supabase URL and anon key in <code>src/config.js</code>, then deploy with server env vars.</p>
      </section>
    `;
  }

  if (state.auth.user) {
    const profile = state.auth.profile || {};
    return `
      <section class="card subscription-card">
        <div class="card-head">
          <div>
            <h2>Account</h2>
            <p>${escapeHtml(profile.displayName || state.settings.name || "Signed in")} ${profile.username ? `@${escapeHtml(profile.username)}` : ""}</p>
            <p>${escapeHtml(profile.email || state.auth.user.email || "")}</p>
          </div>
          <button class="ghost small" type="button" data-sign-out>Sign Out</button>
        </div>
        ${state.auth.message ? `<p class="notice-text">${escapeHtml(state.auth.message)}</p>` : ""}
      </section>
    `;
  }

  return `
    <section class="card subscription-card">
      <h2>Account Login</h2>
      <p>Create an account or sign in with Gmail/username before checkout so payment and subscription state survive refreshes.</p>
      <button class="action" type="button" data-route="account">Open Account Portal</button>
      ${state.auth.message ? `<p class="notice-text">${escapeHtml(state.auth.message)}</p>` : ""}
    </section>
  `;
}

function subscriptionPanel() {
  const tier = state.subscription?.tier || "free";
  const status = state.subscription?.active ? "Active" : "Free";
  return `
    <section class="card tier-card subscription-card">
      <div class="card-head">
        <div>
          <h2>Subscription</h2>
          <p>${status} tier: ${escapeHtml(tier).toUpperCase()}</p>
        </div>
        <span class="locked-badge">${state.subscription?.active ? "Unlocked" : "Locked"}</span>
      </div>
      <div class="stack tight">
        ${PREMIUM_FEATURES.map((feature) => `<article class="locked-row"><span>${escapeHtml(feature)}</span><b>${state.subscription?.active ? "Open" : "Locked"}</b></article>`).join("")}
      </div>
    </section>
  `;
}

function checkoutPanel() {
  const config = state.checkout.config || {};
  const plans = config.plans || PUBLIC_PLANS;
  const methods = config.mode === "sandbox" ? (config.paymentMethods || []) : (config.accounts || []);
  const payment = state.checkout.payment;
  const selectedPlan = plans.find((plan) => plan.id === state.ui.selectedPlanId) || null;
  const modeLabel = config.mode === "manual" ? "Manual transfer fallback" : "Sandbox checkout";
  return `
    <section class="card checkout-card">
      <div class="card-head">
        <div>
          <h2>Checkout</h2>
          <p>${modeLabel}. Test mode first; server webhooks confirm status.</p>
        </div>
        <button class="ghost small" type="button" data-refresh-checkout ${!state.auth.user ? "disabled" : ""}>Refresh</button>
      </div>
      ${state.checkout.message ? `<p class="notice-text">${escapeHtml(state.checkout.message)}</p>` : ""}
      ${payment ? pendingPaymentPanel(payment) : ""}
      <div class="plan-grid">
        ${plans.map((plan) => planCard(plan, methods, config, selectedPlan?.id === plan.id)).join("")}
      </div>
    </section>
  `;
}

function planCard(plan, methods, config = {}, selected = false) {
  const isSandbox = config.mode !== "manual";
  const usdNgnRate = Number(config.usdNgnRate || 1500);
  const ngn = Math.round(Number(plan.amountUsd || 0) * usdNgnRate);
  const showOtherCurrency = selected && (state.ui.otherCurrencyPlanId === plan.id || isLikelyNigeria());
  const otherAccounts = showOtherCurrency ? (config.otherCurrencyAccounts || []) : [];
  const buttons = selected && methods.length
    ? methods.map((method) => `
      <button class="ghost" type="button" data-start-checkout="${escapeHtml(plan.id)}|${escapeHtml(method.id)}" ${state.checkout.loading ? "disabled" : ""}>
        ${isSandbox ? "Pay in Sandbox" : `${method.currency} - ${escapeHtml(method.bankName)}`}
      </button>
    `).join("")
    : "";
  const billingLabel = plan.billingLabel || (plan.id === "lifetime" ? "one-time" : "period");
  return `
    <article class="plan-card ${selected ? "selected" : ""}">
      <span>${escapeHtml(plan.title)}</span>
      <strong>$${Number(plan.amountUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${billingLabel === "one-time" ? "" : `/${escapeHtml(billingLabel)}`}</strong>
      <small>${escapeHtml(plan.description || "")}</small>
      ${selected ? `<em>${isSandbox ? "Sandbox mode: no real charge. " : ""}USD-only checkout.</em>` : ""}
      <button class="${selected ? "action" : "ghost"}" type="button" data-select-plan="${escapeHtml(plan.id)}" ${!state.auth.user ? "disabled" : ""}>
        ${!state.auth.user ? "Sign in first" : selected ? "Selected" : "Choose Plan"}
      </button>
      ${selected ? `<div class="stack tight">${buttons || `<button class="ghost" type="button" disabled>Refresh checkout methods</button>`}</div>` : ""}
      ${selected ? `
        <button class="ghost" type="button" data-other-currency="${escapeHtml(plan.id)}" ${!state.auth.user || state.checkout.loading ? "disabled" : ""}>
          ${showOtherCurrency ? "Hide Other Currency" : "Other Currency"}
        </button>
      ` : ""}
      ${showOtherCurrency ? `
        <div class="stack tight">
          <em>NGN estimate: ${formatMoney(ngn, "NGN")} at ${usdNgnRate.toLocaleString()}/USD.</em>
          ${otherAccounts.length ? otherAccounts.map((account) => `
            <button class="ghost" type="button" data-start-checkout="${escapeHtml(plan.id)}|${escapeHtml(account.id)}" ${state.checkout.loading ? "disabled" : ""}>
              ${formatMoney(ngn, "NGN")} - ${escapeHtml(account.bankName)}
            </button>
          `).join("") : `<button class="ghost" type="button" disabled>Loading local transfer accounts...</button>`}
        </div>
      ` : ""}
    </article>
  `;
}

function pendingPaymentPanel(payment) {
  const expired = checkoutPaymentExpired();
  const account = payment.account || {};
  const method = payment.method || {};
  const terminal = ["successful", "failed", "abandoned", "refunded", "expired"].includes(payment.status);
  if (payment.provider === "sandbox_pay") {
    return `
      <article class="pending-payment ${terminal ? payment.status : ""}">
        <div class="card-head">
          <div>
            <h3>${escapeHtml(payment.plan?.title || "Sandbox checkout")} - ${formatMoney(payment.amount, payment.currency)}</h3>
            <p>Status: ${escapeHtml(payment.status || "pending")}${payment.status === "pending" ? ` - <span data-checkout-timer>${formatTimer(state.checkout.remaining || 0)}</span>` : ""}</p>
          </div>
          <strong>${escapeHtml(method.label || "Sandbox")}</strong>
        </div>
        <div class="payment-grid">
          <span><b>Provider</b>Sandbox Pay</span>
          <span><b>Reference</b>${escapeHtml(payment.reference || "")}</span>
          <span><b>Mode</b>Test only</span>
          <span><b>Notice</b>${escapeHtml(payment.userNotification || "in_app")}</span>
        </div>
        ${payment.status === "pending" && payment.authorizationUrl ? `<button class="action" type="button" data-open-checkout="${escapeHtml(payment.authorizationUrl)}">Open Sandbox Checkout</button>` : ""}
      </article>
    `;
  }
  return `
    <article class="pending-payment ${expired ? "expired" : ""}">
      <div class="card-head">
        <div>
          <h3>${escapeHtml(payment.plan?.title || "Pending transfer")} - ${formatMoney(payment.amount, payment.currency)}</h3>
          <p>${expired ? "Expired. Start again for a fresh OTP." : `Time left: <span data-checkout-timer>${formatTimer(state.checkout.remaining || 0)}</span>`}</p>
        </div>
        <strong>${escapeHtml(payment.otp || "")}</strong>
      </div>
      <div class="payment-grid">
        <span><b>Bank</b>${escapeHtml(account.bankName || "")}</span>
        <span><b>Account</b>${escapeHtml(account.accountNumber || "")}</span>
        <span><b>Name</b>${escapeHtml(account.accountName || "")}</span>
        <span><b>Reference</b>${escapeHtml(payment.reference || "")}</span>
        <span class="wide"><b>Transfer description</b>${escapeHtml(payment.paymentNote || "")}</span>
      </div>
      ${expired ? "" : `
        <form class="stack" data-form="checkout-proof">
          <div class="field-row">
            <input class="field" name="senderName" placeholder="Sender name" value="${escapeHtml(payment.senderName || "")}">
            <input class="field" name="proofReference" placeholder="Transfer reference / proof ID" value="${escapeHtml(payment.proofReference || "")}">
          </div>
          <input class="field" name="userNote" placeholder="Optional note" value="${escapeHtml(payment.userNote || "")}">
          <button class="action" type="submit" ${state.checkout.loading ? "disabled" : ""}>Submit Proof</button>
        </form>
      `}
    </article>
  `;
}

function adminPanel() {
  const payments = state.checkout.adminPayments || [];
  return `
    <section class="card admin-card">
      <h2>Owner Confirmation</h2>
      <p>Use the owner token to review pending manual transfers and activate paid plans.</p>
      <form class="stack" data-form="admin-token">
        <input class="field" name="token" type="password" placeholder="Owner admin token">
        <button class="action" type="submit">Load Pending</button>
      </form>
      ${state.checkout.adminMessage ? `<p class="notice-text">${escapeHtml(state.checkout.adminMessage)}</p>` : ""}
      <div class="stack tight">
        ${payments.length ? payments.map(adminPaymentRow).join("") : `<div class="empty">No pending payments loaded.</div>`}
      </div>
    </section>
  `;
}

function adminPaymentRow(payment) {
  const metadata = payment.metadata || {};
  return `
    <article class="admin-payment-row">
      <div>
        <strong>${escapeHtml(metadata.plan_title || payment.provider_transaction_id)}</strong>
        <span>${formatMoney(payment.amount, payment.currency)} - ${escapeHtml(metadata.sender_name || "No sender yet")}</span>
        <small>${escapeHtml(metadata.proof_reference || "No proof reference yet")}</small>
      </div>
      <div class="button-row two">
        <button class="ghost" type="button" data-admin-verify="${escapeHtml(payment.id)}|successful">Approve</button>
        <button class="ghost" type="button" data-admin-verify="${escapeHtml(payment.id)}|failed">Fail</button>
      </div>
    </article>
  `;
}

function handleForm(form) {
  const data = new FormData(form);
  const type = form.dataset.form;

  if (type === "financial") {
    const kind = data.get("kind");
    const amount = Number(data.get("amount"));
    const category = String(data.get("category") || (kind === "income" ? "Income" : "Expense")).trim();
    if (!amount || amount <= 0) return;
    applyAction({
      module: "Financial",
      type: kind,
      label: `${kind === "income" ? "Income" : "Expense"} - ${category}`,
      logKey: "financial",
      effects: kind === "income" ? { Financial: 2, Mind: 1 } : { Financial: -1, Mind: 1 },
      payload: { kind, amount, category, note: data.get("note"), ledger: state.ui.ledger }
    });
  }

  if (type === "bible") {
    const passage = String(data.get("passage") || "").trim();
    if (!passage) return;
    applyAction({ module: "Spirit", type: "bible", label: `Reflection - ${passage}`, logKey: "spirit", effects: { Spirit: 2, Knowledge: 1 } });
  }

  if (type === "mind-focus") {
    const minutes = Number(data.get("minutes"));
    const focusType = String(data.get("focusType"));
    if (!minutes || minutes <= 0) return;
    const effects = { Mind: Math.min(3, Math.max(0.5, Math.round((minutes / 20) * 10) / 10)) };
    if (["Study", "Reading"].includes(focusType)) effects.Knowledge = 1;
    if (focusType === "Creative") effects.Dexterity = 1;
    applyAction({ module: "Mind", type: "focus", label: `${focusType} - ${minutes}m`, logKey: "mind", effects, payload: { minutes, focusType } });
  }

  if (type === "sleep") {
    const hours = Number(data.get("hours"));
    const quality = Number(data.get("quality") || 3);
    if (!hours || hours <= 0) return;
    applyAction({ module: "Energy", type: "sleep", label: `Sleep - ${hours}h`, logKey: "energy", effects: { Body: 3, Mind: 1 }, payload: { hours, quality } });
  }

  if (type === "exercise") {
    const minutes = Number(data.get("minutes"));
    const kind = String(data.get("kind"));
    if (!minutes || minutes <= 0) return;
    applyAction({ module: "Energy", type: "exercise", label: `${kind} - ${minutes}m`, logKey: "energy", effects: { Body: 4, Mind: 1 }, payload: { minutes, kind } });
  }

  if (type === "reading") {
    const book = String(data.get("title") || "").trim();
    const pages = Number(data.get("pages") || 0);
    if (!book) return;
    applyAction({ module: "Knowledge", type: "reading", label: `${book}${pages ? ` - ${pages}p` : ""}`, logKey: "knowledge", effects: { Knowledge: 3, Mind: 1 }, payload: { pages } });
  }

  if (type === "vocab") {
    const word = String(data.get("word") || "").trim();
    const meaning = String(data.get("meaning") || "").trim();
    if (!word || !meaning) return;
    applyAction({ module: "Knowledge", type: "vocab", label: `${word}: ${meaning}`, logKey: "knowledge", effects: { Knowledge: 2 }, payload: { word, meaning } });
  }

  if (type === "quote") {
    const quote = String(data.get("quote") || "").trim();
    const source = String(data.get("source") || "").trim();
    if (!quote) return;
    applyAction({ module: "Knowledge", type: "quote", label: `Quote - ${truncate(quote, 54)}`, logKey: "knowledge", effects: { Knowledge: 1, Mind: 1 }, payload: { quote, source } });
  }

  if (type === "skill") {
    const skill = String(data.get("skill") || "").trim();
    const minutes = Number(data.get("minutes"));
    if (!skill || !minutes) return;
    applyAction({ module: "Knowledge", type: "skill", label: `${skill} - ${minutes}m practice`, logKey: "knowledge", effects: { Knowledge: 2, Dexterity: 1 }, payload: { minutes } });
  }

  if (type === "dexterity") {
    const kind = String(data.get("kind"));
    const minutes = Number(data.get("minutes"));
    const note = String(data.get("note") || "").trim();
    if (!minutes || minutes <= 0) return;
    applyAction({
      module: "Dexterity",
      type: "creative",
      label: `${kind} - ${minutes}m${note ? ` - ${note}` : ""}`,
      logKey: "dexterity",
      effects: { Dexterity: Math.min(5, Math.max(1, Math.floor(minutes / 10))), Mind: 1 },
      payload: { minutes, kind, note }
    });
  }

  if (type === "start-focus") {
    startFocusSession(String(data.get("task") || ""));
  }

  if (type === "distraction") {
    const hours = Number(data.get("hours"));
    const kind = String(data.get("kind"));
    if (!hours || hours <= 0) return;
    const minutes = Math.round(hours * 60);
    state.focusDebt += minutes;
    state.activity.unshift({ id: uid(), module: "DeeCee Focus", label: `Distraction - ${kind} (${minutes}m debt)`, effects: {}, date: today(), createdAt: nowIso() });
    saveState();
    render();
  }

  if (type === "settings-name") {
    const name = String(data.get("name") || "DC").trim() || "DC";
    state.settings.name = name;
    localStorage.setItem("dc_name", name);
    saveState();
    render();
  }

  if (type === "auth-email") {
    const email = String(data.get("email") || "").trim();
    state.ui.authEmail = email;
    if (email) signInWithEmail(email);
  }

  if (type === "auth-register") {
    registerWithPassword(form);
  }

  if (type === "auth-login") {
    loginWithPassword(form);
  }

  if (type === "checkout-proof") {
    submitCheckoutProof(form);
  }

  if (type === "admin-token") {
    const token = String(data.get("token") || "").trim();
    if (token) loadAdminPayments(token);
  }

  if (type === "onboarding") {
    finishOnboarding(form);
  }
}

function completeFocus(mode = "manual") {
  if (!state.activeFocus) return;
  const active = state.activeFocus;
  const segment = focusSegmentInfo();
  const bankedSegments = Math.min(4, state.activeFocus.bankedSegments || 0);
  const completedBlocks = mode === "auto" ? 4 : segment.completed;
  const newSegments = Math.min(4 - bankedSegments, Math.max(0, completedBlocks - bankedSegments));
  const creditedMinutes = Math.round(((active.minutes / 4) * newSegments) * 100) / 100;
  const elapsedMinutes = mode === "auto" ? active.minutes : focusElapsedMinutes(segment);
  const mindGain = Math.round((focusMindGain(active.minutes) * (newSegments / 4)) * 100) / 100;
  const blockLabel = mode === "auto" ? "Block 4/4" : focusBlockSummary(segment);
  const session = {
    id: uid(),
    task: active.task,
    minutes: elapsedMinutes,
    creditedMinutes,
    targetMinutes: active.minutes,
    difficulty: active.difficulty,
    mindGain,
    bankedSegments: bankedSegments + newSegments,
    completedBlocks,
    endedOnBlock: mode === "auto" ? 4 : segment.current,
    blockLabel,
    endedReason: mode,
    createdAt: nowIso(),
    date: today()
  };
  state.focusSessions.push(session);
  state.focusDebt = Math.max(0, state.focusDebt - creditedMinutes);
  state.activeFocus = null;
  applyAction({
    module: "DeeCee Focus",
    type: mode === "auto" || completedBlocks >= 4 ? "complete" : "ended",
    label: `${mode === "auto" ? "Auto-completed" : "Ended"} focus - ${session.task} (${blockLabel}, ${formatStat(elapsedMinutes)}m)`,
    effects: mindGain > 0 ? { Mind: mindGain } : {}
  });
  recordCloudFocusSession(session);
}

function startFocusSession(rawTask) {
  const task = String(rawTask || state.ui.focusTaskDraft || "Focus Work").trim().slice(0, 80) || "Focus Work";
  state.activeFocus = {
    task,
    minutes: state.ui.focusDuration,
    difficulty: state.ui.focusDifficulty,
    startedAt: nowIso(),
    paused: false,
    pausedAt: null,
    pausedTotalMs: 0,
    bankedSegments: 0
  };
  state.ui.showFocusForm = false;
  state.ui.focusTaskDraft = "";
  applyAction({ module: "DeeCee Focus", type: "start", label: `Started focus - ${task}`, effects: {} });
}

function pauseFocus() {
  if (!state.activeFocus) return;
  if (state.activeFocus.paused) {
    const pausedAt = new Date(state.activeFocus.pausedAt).getTime();
    state.activeFocus.pausedTotalMs = (state.activeFocus.pausedTotalMs || 0) + Math.max(0, Date.now() - pausedAt);
    state.activeFocus.paused = false;
    state.activeFocus.pausedAt = null;
  } else {
    const segment = focusSegmentInfo();
    if (segment.bankable > 0 && confirm(`Bank ${segment.bankable} focus quarter${segment.bankable > 1 ? "s" : ""} before pausing? This awards proportional Mind EXP now.`)) {
      bankFocusSegments(segment.bankable);
    }
    state.activeFocus.paused = true;
    state.activeFocus.pausedAt = nowIso();
  }
  saveState();
  render();
}

function bankFocusSegments(count, reason = "manual") {
  if (!state.activeFocus || count <= 0) return;
  const target = state.activeFocus.minutes || 1;
  const segments = Math.min(count, 4 - (state.activeFocus.bankedSegments || 0));
  if (segments <= 0) return;
  const minutes = Math.round((target / 4) * segments * 100) / 100;
  const mindGain = Math.round((focusMindGain(target) * (segments / 4)) * 100) / 100;
  state.activeFocus.bankedSegments = (state.activeFocus.bankedSegments || 0) + segments;
  const bankedTotal = state.activeFocus.bankedSegments;
  const task = state.activeFocus.task;
  const difficulty = state.activeFocus.difficulty;
  state.focusDebt = Math.max(0, state.focusDebt - minutes);
  state.focusSessions.push({
    id: uid(),
    task: `${task} - checkpoint ${bankedTotal}/4`,
    minutes,
    creditedMinutes: minutes,
    targetMinutes: target,
    difficulty,
    mindGain,
    bankedSegments: segments,
    partial: true,
    checkpoint: bankedTotal,
    completedBlocks: bankedTotal,
    endedOnBlock: bankedTotal,
    blockLabel: `Block ${bankedTotal}/4`,
    endedReason: reason,
    createdAt: nowIso(),
    date: today()
  });
  if (bankedTotal >= 4) {
    recordCloudFocusSession({
      id: uid(),
      task,
      minutes: target,
      creditedMinutes: target,
      targetMinutes: target,
      difficulty,
      mindGain: focusMindGain(target),
      bankedSegments: 4,
      completedBlocks: 4,
      endedOnBlock: 4,
      blockLabel: "Block 4/4",
      endedReason: reason === "checkpoint" ? "auto" : reason,
      createdAt: nowIso(),
      date: today()
    });
    state.activeFocus = null;
  }
  applyAction({
    module: "DeeCee Focus",
    type: bankedTotal >= 4 ? "complete" : "focus-checkpoint",
    label: bankedTotal >= 4
      ? `${reason === "checkpoint" ? "Auto-completed" : "Completed"} focus - ${task} (${target}m)`
      : `Focus checkpoint - ${task} (${bankedTotal}/4)`,
    effects: { Mind: mindGain }
  });
}

function abandonFocus() {
  if (!state.activeFocus) return;
  if (!confirm("Abandon this focus session? It will not add Mind XP.")) return;
  const active = state.activeFocus;
  const segment = focusSegmentInfo();
  const elapsedMinutes = focusElapsedMinutes(segment);
  const blockLabel = focusBlockSummary(segment);
  state.activeFocus = null;
  state.focusSessions.push({
    id: uid(),
    task: active.task,
    minutes: elapsedMinutes,
    creditedMinutes: 0,
    targetMinutes: active.minutes,
    difficulty: active.difficulty,
    mindGain: 0,
    bankedSegments: active.bankedSegments || 0,
    completedBlocks: segment.completed,
    endedOnBlock: segment.current,
    blockLabel,
    endedReason: "abandoned",
    cancelled: true,
    createdAt: nowIso(),
    date: today()
  });
  state.activity.unshift({ id: uid(), module: "DeeCee Focus", label: `Abandoned focus - ${active.task} (${blockLabel}, ${formatStat(elapsedMinutes)}m)`, effects: {}, date: today(), createdAt: nowIso() });
  state.activity = state.activity.slice(0, MAX_ACTIVITY_ITEMS);
  state.focusSessions = state.focusSessions.slice(-MAX_FOCUS_SESSIONS);
  saveState();
  render();
  recordCloudFocusSession(state.focusSessions[state.focusSessions.length - 1]);
}

function exportData() {
  const backup = {
    meta: {
      app: "DeeCee",
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: nowIso()
    },
    state
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `deecadence-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = unwrapBackup(safeJson(String(reader.result || "")));
    if (!isValidBackupState(parsed)) {
      alert("That file does not look like a DeeCee backup.");
      return;
    }
    if (!confirm("Import this backup and replace local DeeCee data in this browser?")) return;
    state = mergeState(clone(DEFAULT_STATE), parsed);
    saveState();
    setRoute("home");
  };
  reader.readAsText(file);
}

function isValidBackupState(value) {
  if (!value || typeof value !== "object") return false;
  if (!value.stats || typeof value.stats !== "object") return false;
  if (!value.logs || typeof value.logs !== "object") return false;
  return STAT_NAMES.every((name) => Number.isFinite(Number(value.stats[name] ?? 1)));
}

function resetData() {
  if (!confirm("Reset local DeeCee data on this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = clone(DEFAULT_STATE);
  saveState();
  setRoute("home");
}

function applyOnboardingMode(mode) {
  const preset = ONBOARDING_MODES[mode] || ONBOARDING_MODES.Balanced;
  state.settings.mode = ONBOARDING_MODES[mode] ? mode : "Balanced";
  state.settings.priorityModules = [...preset.modules];
  saveState();
  render();
}

function finishOnboarding(form) {
  const data = form ? new FormData(form) : new FormData();
  const name = String(data.get("name") || state.settings.name || "DC").trim() || "DC";
  const mode = String(data.get("mode") || state.settings.mode || "Balanced");
  state.settings.name = name;
  state.settings.mode = ONBOARDING_MODES[mode] ? mode : "Balanced";
  if (!(state.settings.priorityModules || []).length) {
    state.settings.priorityModules = [...ONBOARDING_MODES[state.settings.mode].modules];
  }
  state.settings.onboardingComplete = true;
  state.settings.tutorialComplete = false;
  localStorage.setItem("dc_name", name);
  state.route = "tutorial";
  saveState();
  setRoute("tutorial");
}

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select, option")) return;

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) setRoute(routeButton.dataset.route);

  const ledgerButton = event.target.closest("[data-ledger]");
  if (ledgerButton) {
    state.ui.ledger = ledgerButton.dataset.ledger;
    saveState();
    render();
  }

  const durationButton = event.target.closest("[data-focus-duration]");
  if (durationButton) {
    state.ui.focusDuration = Number(durationButton.dataset.focusDuration);
    saveState();
    render();
  }

  const difficultyButton = event.target.closest("[data-focus-difficulty]");
  if (difficultyButton) {
    state.ui.focusDifficulty = difficultyButton.dataset.focusDifficulty;
    saveState();
    render();
  }

  const prayerButton = event.target.closest("[data-spirit-prayer]");
  if (prayerButton) {
    applyAction({ module: "Spirit", type: "prayer", label: prayerButton.dataset.spiritPrayer, logKey: "spirit", effects: { Spirit: 3, Mind: 1 } });
  }

  const moodButton = event.target.closest("[data-mood]");
  if (moodButton) {
    const mood = moodButton.dataset.mood;
    const effects = { Mind: 1 };
    if (["Good", "Great", "Peak"].includes(mood)) effects.Body = 1;
    applyAction({ module: "Mind", type: "mood", label: `Mood - ${mood}`, logKey: "mind", effects });
  }

  const waterButton = event.target.closest("[data-water]");
  if (waterButton) {
    const glasses = Number(waterButton.dataset.water);
    applyAction({ module: "Energy", type: "water", label: `Water - ${glasses} glass${glasses > 1 ? "es" : ""}`, logKey: "energy", effects: { Body: 1 }, payload: { glasses } });
  }

  const quickDexButton = event.target.closest("[data-quick-dex]");
  if (quickDexButton) {
    const [kind, minutesRaw] = quickDexButton.dataset.quickDex.split("|");
    const minutes = Number(minutesRaw);
    applyAction({ module: "Dexterity", type: "quick", label: `${kind} - ${minutes}m`, logKey: "dexterity", effects: { Dexterity: 2, Mind: 1 }, payload: { kind, minutes } });
  }

  if (event.target.closest("[data-complete-focus]")) completeFocus();
  if (event.target.closest("[data-pause-focus]")) pauseFocus();
  if (event.target.closest("[data-abandon-focus]")) abandonFocus();
  const startFocusButton = event.target.closest("[data-start-focus]");
  if (startFocusButton) {
    const form = startFocusButton.closest("[data-form='start-focus']");
    const data = form ? new FormData(form) : null;
    startFocusSession(data ? data.get("task") : "");
  }
  if (event.target.closest("[data-toggle-focus-form]")) {
    state.ui.showFocusForm = !state.ui.showFocusForm;
    saveState();
    render();
  }
  if (event.target.closest("[data-export]")) exportData();
  if (event.target.closest("[data-reset]")) resetData();
  if (event.target.closest("[data-sign-out]")) signOut();
  if (event.target.closest("[data-refresh-checkout]")) loadCloudState();

  const checkoutButton = event.target.closest("[data-start-checkout]");
  if (checkoutButton) {
    const [planId, accountId] = checkoutButton.dataset.startCheckout.split("|");
    startCheckout(planId, accountId);
  }

  const otherCurrencyButton = event.target.closest("[data-other-currency]");
  if (otherCurrencyButton) {
    loadOtherCurrency(otherCurrencyButton.dataset.otherCurrency);
  }

  const openCheckoutButton = event.target.closest("[data-open-checkout]");
  if (openCheckoutButton) {
    window.location.href = openCheckoutButton.dataset.openCheckout;
  }

  const planButton = event.target.closest("[data-select-plan]");
  if (planButton) {
    state.ui.selectedPlanId = planButton.dataset.selectPlan;
    if (isLikelyNigeria()) state.ui.otherCurrencyPlanId = planButton.dataset.selectPlan;
    saveState();
    render();
    if (state.auth.user && (!state.checkout.config || state.ui.otherCurrencyPlanId)) loadCheckout();
  }

  const verifyButton = event.target.closest("[data-admin-verify]");
  if (verifyButton) {
    const [paymentId, status] = verifyButton.dataset.adminVerify.split("|");
    verifyAdminPayment(paymentId, status);
  }

  if (event.target.closest("[data-toggle-activity]")) {
    state.ui.activityExpanded = !state.ui.activityExpanded;
    saveState();
    render();
  }

  if (event.target.closest("[data-scroll-top]")) {
    state.ui.activityExpanded = false;
    saveState();
    render();
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
  }

  const focusStrengthGroup = event.target.closest("[data-focus-strength-group]");
  if (focusStrengthGroup) {
    loadFocusStrength(focusStrengthGroup.dataset.focusStrengthGroup);
  }

  const onboardButton = event.target.closest("[data-onboard-module]");
  if (onboardButton) {
    const id = onboardButton.dataset.onboardModule;
    const selected = state.settings.priorityModules || [];
    state.settings.priorityModules = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id].slice(0, 3);
    saveState();
    render();
  }

  const continueOnboarding = event.target.closest("[data-continue-onboarding]");
  if (continueOnboarding) {
    finishOnboarding(continueOnboarding.closest("[data-form='onboarding']"));
  }

  if (event.target.closest("[data-skip-onboarding]")) {
    state.settings.onboardingComplete = true;
    state.settings.tutorialComplete = false;
    state.route = "tutorial";
    saveState();
    setRoute("tutorial");
  }

  if (event.target.closest("[data-finish-tutorial]")) {
    state.settings.tutorialComplete = true;
    state.route = "account";
    saveState();
    setRoute("account");
  }

  if (event.target.closest("[data-preview-dashboard]")) {
    state.settings.tutorialComplete = true;
    state.route = "home";
    saveState();
    setRoute("home");
  }

  if (event.target.closest("[data-redo-onboarding]")) {
    state.settings.onboardingComplete = false;
    state.settings.tutorialComplete = false;
    saveState();
    setRoute("onboarding");
  }

  const themeButton = event.target.closest("[data-theme]");
  if (themeButton) {
    state.theme = themeButton.dataset.theme;
    saveState();
    render();
  }

  const authModeButton = event.target.closest("[data-auth-mode]");
  if (authModeButton) {
    state.ui.authMode = authModeButton.dataset.authMode;
    state.auth.message = "";
    saveState();
    render();
  }

  const modeButton = event.target.closest("[data-knowledge-mode]");
  if (modeButton) {
    state.ui.knowledgeMode = modeButton.dataset.knowledgeMode;
    state.ui.flashShow = false;
    state.ui.quizFeedback = "";
    saveState();
    render();
  }

  if (event.target.closest("[data-flash-prev]")) {
    state.ui.flashIndex -= 1;
    state.ui.flashShow = false;
    saveState();
    render();
  }

  if (event.target.closest("[data-flash-next]")) {
    state.ui.flashIndex += 1;
    state.ui.flashShow = false;
    saveState();
    render();
  }

  if (event.target.closest("[data-flash-toggle]")) {
    state.ui.flashShow = !state.ui.flashShow;
    saveState();
    render();
  }

  const quizChoice = event.target.closest("[data-quiz-choice]");
  if (quizChoice) {
    const correct = quizChoice.dataset.quizChoice === "1";
    state.ui.quizFeedback = correct ? "Correct. One more memory thread tied down." : "Not quite. Review it once, then try another.";
    if (correct) {
      state.ui.quizIndex += 1;
      applyAction({ module: "Knowledge", type: "quiz", label: "Vocabulary quiz correct", effects: { Knowledge: 1, Mind: 1 } });
    } else {
      saveState();
      render();
    }
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  handleForm(form);
});

document.addEventListener("input", (event) => {
  const onboardingName = event.target.closest("[data-onboarding-name]");
  if (onboardingName) {
    state.settings.name = onboardingName.value;
    localStorage.setItem("dc_name", onboardingName.value || "DC");
    saveState();
    return;
  }

  const focusTask = event.target.closest("[data-focus-task]");
  if (focusTask) {
    state.ui.focusTaskDraft = focusTask.value;
    saveState();
    return;
  }

  const authEmail = event.target.closest("[data-auth-email]");
  if (authEmail) {
    state.ui.authEmail = authEmail.value;
    const value = normalizeEmail(authEmail.value);
    const invalid = Boolean(value) && !isGmailEmail(value);
    authEmail.classList.toggle("invalid", invalid);
    authEmail.setAttribute("aria-invalid", invalid ? "true" : "false");
    authEmail.setCustomValidity(invalid ? gmailOnlyMessage(value) : "");
    saveState();
    return;
  }

  const authIdentifier = event.target.closest("[data-auth-identifier]");
  if (authIdentifier) {
    state.ui.authIdentifier = authIdentifier.value;
    saveState();
    return;
  }

  const authUsername = event.target.closest("[data-auth-username]");
  if (authUsername) {
    const value = normalizeUsername(authUsername.value);
    state.ui.authUsername = value;
    const invalid = Boolean(value) && !isValidUsername(value);
    authUsername.classList.toggle("invalid", invalid);
    authUsername.setAttribute("aria-invalid", invalid ? "true" : "false");
    authUsername.setCustomValidity(invalid ? "Username must be 3-24 characters using letters, numbers, or underscores." : "");
    saveState();
    return;
  }

  const authDisplayName = event.target.closest("[data-auth-display-name]");
  if (authDisplayName) {
    state.ui.authDisplayName = authDisplayName.value;
    saveState();
    return;
  }

  const authPassword = event.target.closest("[data-auth-password]");
  if (authPassword) {
    if (authPassword.dataset.authPassword === "login") {
      authDraft.loginPassword = authPassword.value;
      return;
    }
    authDraft.registerPassword = authPassword.value;
    syncPasswordFields();
    return;
  }

  const authConfirm = event.target.closest("[data-auth-confirm-password]");
  if (authConfirm) {
    authDraft.registerConfirm = authConfirm.value;
    syncPasswordFields();
    return;
  }

  const search = event.target.closest("[data-vocab-search]");
  if (!search) return;
  state.ui.vocabSearch = search.value;
  saveState();
  render();
  const nextSearch = document.querySelector("[data-vocab-search]");
  if (nextSearch) {
    nextSearch.focus();
    nextSearch.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
  }
});

document.addEventListener("change", (event) => {
  const modeSelect = event.target.closest("[data-onboarding-mode]");
  if (modeSelect) {
    applyOnboardingMode(modeSelect.value);
    return;
  }

  const importFile = event.target.closest("[data-import-file]");
  if (!importFile) return;
  importData(importFile.files && importFile.files[0]);
  importFile.value = "";
});

themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "system" ? "dark" : state.theme === "dark" ? "light" : "system";
  saveState();
  render();
});

window.addEventListener("hashchange", () => {
  const route = location.hash.slice(1) || "home";
  state.route = route;
  state.ui.activityExpanded = false;
  shouldScrollTop = true;
  saveState();
  render();
});

const initialRoute = location.hash.slice(1);
if (initialRoute) state.route = initialRoute;
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (state.theme === "system") render();
});
saveState();
render();
loadAppConfig();
initAuth();
