"use strict";

const STORAGE_KEY = "finmax_beta_v1";
const VERSION = 1;
const FALLBACK_USD_NGN_RATE = 1400;
const FX_RATE_UPDATED = "2026-07-19";
const app = document.querySelector("#app");
const restoreFile = document.querySelector("#restoreFile");
let pdfWorkerPromise = null;
function ensurePdfWorker() {
  if (globalThis.pdfjsWorker?.WorkerMessageHandler) return Promise.resolve();
  if (pdfWorkerPromise) return pdfWorkerPromise;
  pdfWorkerPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("vendor/pdf.worker.bundle.js", document.baseURI).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error("The offline PDF worker could not load"));
    document.head.append(script);
  });
  return pdfWorkerPromise;
}
const today = () => new Date().toISOString().slice(0, 10);
const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const number = value => Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;
const dateLabel = value => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value || today()}T12:00:00`));

function freshState() {
  return {
    version: VERSION,
    profile: { name: "", currency: "NGN", theme: "system", onboarded: false, tutorialDone: false },
    accounts: [], transactions: [], reviewQueue: [], rules: [], goal: null, payment: null,
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  };
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || stored.version !== VERSION) return freshState();
    return { ...freshState(), ...stored, profile: { ...freshState().profile, ...(stored.profile || {}) } };
  } catch (_) { return freshState(); }
}

let state = loadState();
state.accounts = state.accounts.map(account => ({ ...account, currency: account.currency || state.profile.currency }));
state.transactions = state.transactions.map(item => ({ ...item, currency: item.currency || accountCurrency(state.accounts.find(account => account.id === item.accountId)) }));
state.rules = state.rules.filter(rule => Array.isArray(rule.signature) && rule.signature.length);
let view = "today";
let setupStep = state.profile.onboarded ? 3 : 1;
let tutorialStep = 0;
let modal = null;
let reviewFilter = "all";
let reviewLimit = 80;
let transactionFilter = "all";
let transactionSearch = "";
let transactionAccount = "all";
let transactionSort = "newest";
let importStatus = null;
let lastImportRender = 0;
let activeImportToken = 0;

const RULE_STOP_WORDS = new Set([
  "account", "alert", "amount", "bank", "beneficiary", "completed", "credit", "debit", "dominion",
  "institution", "moniepoint", "narration", "nigeria", "palmpay", "payment", "received", "reference",
  "successful", "transaction", "transfer", "wallet", "with", "from", "into", "your", "this", "that"
]);

function save() {
  state.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resolvedTheme() {
  if (state.profile.theme !== "system") return state.profile.theme;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme() === "dark" ? "#0b100f" : "#f3f5f2");
}

function money(value, currency = state.profile.currency) {
  if (currency === "NGN") return `NGN ${Math.round(number(value)).toLocaleString()}`;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: currency === "NGN" ? 0 : 2 }).format(number(value)); }
  catch (_) { return `${currency} ${number(value).toLocaleString()}`; }
}

function toast(message, kind = "info") {
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div");
  node.className = `toast ${kind}`;
  node.setAttribute("role", "status");
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 3200);
}

function accountById(id) { return state.accounts.find(account => account.id === id); }
function accountName(id) { return accountById(id)?.name || "Unknown account"; }
function accountCurrency(account) { return account?.currency || state.profile.currency; }
function convertMoney(value, from, to = state.profile.currency) {
  if (!from || from === to) return number(value);
  if (from === "USD" && to === "NGN") return number(value) * FALLBACK_USD_NGN_RATE;
  if (from === "NGN" && to === "USD") return number(value) / FALLBACK_USD_NGN_RATE;
  return number(value);
}
function totalBalance() { return state.accounts.reduce((sum, account) => sum + convertMoney(account.balance, accountCurrency(account)), 0); }
function monthKey(value = today()) { return String(value).slice(0, 7); }
function monthTransactions() { return state.transactions.filter(item => monthKey(item.date) === monthKey()); }
function totals() {
  return monthTransactions().reduce((result, item) => {
    const value = convertMoney(item.amount, item.currency || accountCurrency(accountById(item.accountId)));
    if (item.type === "income") result.income += value;
    if (item.type === "expense") result.expense += value;
    if (item.type === "saving") result.protected += value;
    return result;
  }, { income: 0, expense: 0, protected: 0 });
}

function isImporting() { return Boolean(importStatus?.active); }
function reviewLabel(compact = false) {
  const count = state.reviewQueue.length;
  return `Review${count ? (compact ? ` / ${count}` : ` (${count})`) : ""}${isImporting() ? `<span class="nav-spinner" aria-hidden="true"></span>` : ""}`;
}
function navButton(target, label) {
  const busy = target === "review" && isImporting();
  return `<button class="${view === target ? "active" : ""} ${busy ? "is-loading" : ""}" data-view="${target}" ${busy ? `aria-busy="true"` : ""}><span class="nav-dot"></span>${label}</button>`;
}

function shell(content, title) {
  const name = state.profile.name || "FinMax user";
  return `<div class="shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">F</span><span>FinMax<small>Personal money beta</small></span></div>
      <nav class="nav" aria-label="Main navigation">
        ${navButton("today", "Today")}${navButton("review", reviewLabel())}
        ${navButton("activity", "Activity")}${navButton("goal", "Goal")}${navButton("snapshot", "Money Snapshot")}${navButton("more", "More")}
      </nav>
      <div class="sidebar-foot"><strong>${esc(name)}</strong><small>Stored privately on this device</small></div>
    </aside>
    <main class="main">
      <header class="topbar"><h1>${esc(title)}</h1><div class="top-actions"><button class="btn" data-action="quick-log">+ Log money</button><button class="btn icon-btn" data-action="cycle-theme" title="Change theme">${resolvedTheme() === "dark" ? "Light" : "Dark"}</button></div></header>
      <div class="content">${content}</div>
    </main>
    <nav class="mobile-nav" aria-label="Mobile navigation">
      ${mobileNav("today", "Today")}${mobileNav("review", reviewLabel(true))}${mobileNav("activity", "Activity")}${mobileNav("goal", "Goal")}${mobileNav("snapshot", "Snapshot")}${mobileNav("more", "More")}
    </nav>
  </div>`;
}

function mobileNav(target, label) {
  const busy = target === "review" && isImporting();
  return `<button class="${view === target ? "active" : ""} ${busy ? "is-loading" : ""}" data-view="${target}" ${busy ? `aria-busy="true"` : ""}>${label}</button>`;
}

function pageHead(title, description, actions = "") {
  return `<div class="page-head"><div><h2>${title}</h2><p>${description}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
}

function onboarding() {
  const active = setupStep;
  let panel = "";
  if (active === 1) panel = `<div class="onboard-card">
    <div class="stepper"><i class="active"></i><i></i><i></i></div>
    <span class="eyebrow">Step 1 of 3</span><h2>Make your money easier to read.</h2>
    <p class="muted">Start with your name and main currency. FinMax keeps this beta in your browser.</p>
    <form data-form="profile" class="form-grid">
      <div class="field full"><label for="setupName">What should we call you?</label><input id="setupName" name="name" autocomplete="name" required value="${esc(state.profile.name)}" placeholder="Your first name"></div>
      <div class="field full"><label for="setupCurrency">Main currency</label><select id="setupCurrency" name="currency"><option value="NGN">Nigerian naira (NGN)</option><option value="USD">US dollar (USD)</option></select></div>
      <div class="field full"><button class="btn primary" type="submit">Continue</button></div>
    </form>
  </div>`;
  if (active === 2) panel = `<div class="onboard-card">
    <div class="stepper"><i class="active"></i><i class="active"></i><i></i></div>
    <span class="eyebrow">Step 2 of 3</span><h2>Add the account you use most.</h2>
    <p class="muted">A bank, mobile wallet, cash balance, or investment account. You can add the rest later.</p>
    <form data-form="first-account" class="form-grid">
      <div class="field"><label>Account name</label><input name="name" required placeholder="e.g. Daily wallet"></div>
      <div class="field"><label>Where is the money?</label><select name="type" data-account-type><option>Fintech account</option><option>Bank account</option><option>Cash</option><option>Investment account</option></select></div>
      <div class="field" data-institution-field><label>Bank, fintech, or provider</label><input name="institution" required placeholder="e.g. Moniepoint or your bank"></div>
      <div class="field"><label>Current balance</label><input name="balance" type="number" min="0" step="0.01" required placeholder="0"></div>
      <div class="field full modal-actions"><button class="btn" type="button" data-action="setup-back">Back</button><button class="btn primary" type="submit">Show me how it works</button></div>
    </form>
  </div>`;
  return `<div class="onboarding"><section class="onboard-story"><div class="brand"><span class="brand-mark">F</span><span>FinMax</span></div><div><span class="eyebrow">Private finance, made clear</span><h1>Know where your money went.</h1><p>Import or log activity, review it before it counts, and leave with one useful next step.</p></div><small>Your financial data stays on this device in Beta v1.</small></section><section class="onboard-panel">${panel}</section></div>`;
}

const tutorialSlides = [
  { mark: "1", title: "Bring money in", body: "Log a transaction in seconds, or import a supported PalmPay or Moniepoint statement. FinMax never changes your ledger before you review imported rows." },
  { mark: "2", title: "Confirm what happened", body: "FinMax suggests income, spending, saving, investment, or a transfer between your own accounts. You stay in control and corrections are remembered locally." },
  { mark: "3", title: "Leave with clarity", body: "See account balances, one useful insight, one goal checkpoint, and a downloadable Money Snapshot without turning money management into homework." }
];

function tutorial() {
  const slide = tutorialSlides[tutorialStep];
  return `<div class="modal-backdrop"><section class="modal tutorial" role="dialog" aria-modal="true"><span class="tutorial-mark">${slide.mark}</span><span class="eyebrow">A 60-second tour</span><h2>${slide.title}</h2><p class="muted">${slide.body}</p><div class="tutorial-nav"><button class="btn icon-btn" data-action="tutorial-back" ${tutorialStep === 0 ? "disabled" : ""} aria-label="Previous slide">&lt;</button><button class="btn ghost" data-action="tutorial-skip">Skip</button><button class="btn primary" data-action="tutorial-next">${tutorialStep === tutorialSlides.length - 1 ? "See my money" : "Next >"}</button></div></section></div>`;
}

function dashboard() {
  const t = totals();
  const usage = state.transactions.reduce((map, item) => ({ ...map, [item.accountId]: (map[item.accountId] || 0) + 1 }), {});
  const accounts = [...state.accounts].sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0) || number(b.balance) - number(a.balance)).slice(0, 2);
  const recent = state.transactions.slice(0, 5);
  const spendRatio = t.income > 0 ? Math.round((t.expense / t.income) * 100) : 0;
  const hasEvidence = state.transactions.length || state.reviewQueue.length;
  const clarity = hasEvidence ? Math.max(0, Math.min(100, Math.round(100 - Math.min(70, state.reviewQueue.length * 4) - Math.min(30, spendRatio * .3)))) : null;
  let insight = "Log your first transaction so FinMax can give you a useful next step.";
  if (state.reviewQueue.length) insight = `${state.reviewQueue.length} imported ${state.reviewQueue.length === 1 ? "row needs" : "rows need"} your confirmation before the dashboard uses them.`;
  else if (t.expense > t.income && t.income) insight = "Spending is above recorded income this month. Check large purchases before adding new commitments.";
  else if (t.protected > 0) insight = `${money(t.protected)} moved toward savings or investments this month. Keep transfers between your accounts neutral.`;
  const goal = state.goal;
  return shell(`${pageHead(`Good ${greeting()}, ${esc(state.profile.name.split(" ")[0])}`, "The few things worth knowing about your money today.", `<button class="btn" data-action="import">Import statement</button>`)}
    <section class="card hero"><div><span class="eyebrow">Estimated total across ${state.accounts.length} ${state.accounts.length === 1 ? "account" : "accounts"}</span><h2>${money(totalBalance())}</h2><p>${new Set(state.accounts.map(accountCurrency)).size > 1 ? `Shown in ${esc(state.profile.currency)} using the fixed Beta rate of NGN ${FALLBACK_USD_NGN_RATE.toLocaleString()} per USD. ` : ""}Imported history does not silently rewrite balances.</p></div><div class="clarity"><div><strong>${clarity ?? "--"}</strong><small>${clarity == null ? "needs data" : "clarity"}</small></div></div></section>
    <div class="quick-row"><button data-action="quick-log"><strong>Log money</strong><small>Income, spending, savings, or transfer</small></button><button data-action="import"><strong>Import statement</strong><small>PalmPay or Moniepoint PDF, CSV, JSON</small></button><button data-view="review"><strong>Review ${state.reviewQueue.length || ""}</strong><small>Confirm before advice changes</small></button></div>
    <section class="grid four-col" style="margin-top:14px"><div class="card kpi"><span>Income this month</span><strong>${money(t.income)}</strong><small>Confirmed only</small></div><div class="card kpi"><span>Spent this month</span><strong>${money(t.expense)}</strong><small>Transfers excluded</small></div><div class="card kpi"><span>Saved / invested</span><strong>${money(t.protected)}</strong><small>Protected movement</small></div><div class="card kpi"><span>Net movement</span><strong>${money(t.income - t.expense - t.protected)}</strong><small>Based on reviewed data</small></div></section>
    <section class="grid two-col" style="margin-top:14px"><div class="card card-pad"><div class="section-head"><h3>Your main accounts</h3><button class="btn small" data-action="manage-accounts">Manage</button></div><div class="account-list">${accounts.map(accountRow).join("") || emptyInline("No accounts yet")}</div></div><div class="notice"><strong>One useful next step</strong><p>${esc(insight)}</p>${state.reviewQueue.length ? `<button class="btn small" style="margin-top:12px" data-view="review">Review now</button>` : ""}</div></section>
    <section class="grid two-col" style="margin-top:14px"><div class="card card-pad"><div class="section-head"><h3>Recent activity</h3><button class="btn small" data-view="activity">View all</button></div><div class="activity-list">${recent.map(activityRow).join("") || emptyInline("No confirmed activity yet")}</div></div><div class="card card-pad"><div class="section-head"><h3>Goal checkpoint</h3><button class="btn small" data-view="goal">Open goal</button></div>${goal ? goalPreview(goal) : `<div class="empty"><h3>Choose one money goal</h3><p>Keep the beta focused on a single target.</p><button class="btn primary" data-action="edit-goal">Create goal</button></div>`}</div></section>`, "Today");
}

function greeting() { const hour = new Date().getHours(); return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"; }
function accountRow(account) { return `<div class="account-row"><div><strong>${esc(account.name)}</strong><small>${esc(account.institution)} / ${esc(account.type)}</small></div><span class="amount">${money(account.balance, accountCurrency(account))}</span></div>`; }
function emptyInline(text) { return `<p class="muted" style="font-size:12px;margin:12px 0">${text}</p>`; }
function activityRow(item) { return `<details class="activity-entry"><summary class="activity-row"><div><strong>${esc(item.description)}</strong><small>${dateLabel(item.date)} / ${esc(item.category)} / ${esc(accountName(item.accountId))}</small></div><span class="amount ${esc(item.type)}">${item.type === "expense" ? "-" : item.type === "income" ? "+" : ""}${money(item.amount, item.currency || accountCurrency(accountById(item.accountId)))}</span></summary><div class="activity-detail"><span>${esc(item.type)}${item.toAccountId ? ` to ${esc(accountName(item.toAccountId))}` : ""}</span><span>${esc(item.source || "Manual")}</span>${item.note ? `<p>${esc(item.note)}</p>` : ""}</div></details>`; }

function narrationTokens(value) {
  return String(value || "").toLowerCase()
    .replace(/\b(?:ref(?:erence)?|session|transaction|trace|rrn|stan|id)\s*[:#/-]?\s*[a-z0-9-]{5,}\b/g, " ")
    .replace(/\b\d{5,}\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter(token => token.length >= 4 && !RULE_STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function ruleSignature(row) {
  const tokens = narrationTokens(row.rawDescription || row.description);
  return [...new Set(tokens)].slice(0, 4);
}

function learnedRule(row) {
  const tokens = new Set(narrationTokens(`${row.description || ""} ${row.rawDescription || ""}`));
  return state.rules.find(rule => {
    const signature = Array.isArray(rule.signature) ? rule.signature : [];
    return signature.length && signature.every(token => tokens.has(token));
  });
}

function guessRow(row) {
  const text = `${row.description || ""} ${row.rawDescription || ""}`.toLowerCase();
  const learned = learnedRule(row);
  if (learned) return { type: learned.type, category: learned.category, confidence: 96, learned: true };
  if (/interest|cashback|salary|credit alert|payment received|inward transfer/.test(text)) return { type: "income", category: /interest/.test(text) ? "Interest" : "Income", confidence: 88 };
  if (/piggy|cowrywise|investment|risevest|stock|real estate/.test(text)) return { type: "saving", category: "Investment", confidence: 90 };
  if (/save|savings|vault|reserve|spend\s*&\s*save/.test(text)) return { type: "saving", category: "Savings", confidence: 86 };
  if (/airtime|data bundle|mtn data|airtel data|glo data|9mobile data/.test(text)) return { type: "expense", category: /airtime/.test(text) ? "Airtime" : "Data", confidence: 90 };
  if (/fee|charge|levy|stamp duty|vat|sms alert/.test(text)) return { type: "expense", category: "Bank fees", confidence: 91 };
  if (/netflix|spotify|chatgpt|subscription|canva|renewal/.test(text)) return { type: "expense", category: "Subscriptions", confidence: 89 };
  if (/loan|credit facility|repayment/.test(text)) return { type: "expense", category: "Loan", confidence: 76 };
  if (/pos|cash withdrawal|cashout|atm/.test(text)) return { type: "expense", category: "Cash / POS", confidence: 78 };
  if (/transfer|\btrf\b|nip/.test(text)) return { type: "transfer", category: "Transfer review", confidence: 62 };
  return { type: row.type || "expense", category: row.category || "Unsure", confidence: 42 };
}

function reviewPage() {
  if (importStatus) {
    const tone = importStatus.error ? "error" : "loading";
    const title = importStatus.error ? "Import needs attention" : "Loading statement...";
    const body = importStatus.error
      ? esc(importStatus.message || "That import could not finish. Try another file or import a smaller date range.")
      : esc(importStatus.message || "Reading the file locally and preparing Review items.");
    return shell(`${pageHead("Review imported money", "FinMax suggests. You confirm. Nothing reaches your ledger before that.", `<button class="btn" data-action="import">Import another file</button>`)}
      <section class="card card-pad import-state ${tone}" role="status" aria-live="polite">
        <div class="import-loader ${importStatus.error ? "stopped" : ""}"></div>
        <div>
          <span class="eyebrow">${esc(importStatus.fileName || "Statement import")}</span>
          <h3>${title}</h3>
          <p class="muted">${body}</p>
          ${importStatus.page && importStatus.pages ? `<div class="progress import-progress" style="--value:${Math.round((importStatus.page / importStatus.pages) * 100)}%"><span></span></div><small class="muted">Page ${importStatus.page} of ${importStatus.pages}</small>` : ""}
          ${importStatus.error ? `<div class="page-actions" style="margin-top:14px"><button class="btn primary" data-action="import">Try another import</button><button class="btn" data-action="clear-import-status">Dismiss</button></div>` : ""}
        </div>
      </section>`, "Review");
  }
  const categories = ["all", "Unsure", "Transfer review", "Savings", "Investment", "Data", "Airtime", "Bank fees", "Subscriptions", "Loan", "Cash / POS"];
  const rows = state.reviewQueue.map(row => ({ ...row, ...guessRow(row) })).filter(row => reviewFilter === "all" || row.category === reviewFilter);
  const visible = rows.slice(0, reviewLimit);
  return shell(`${pageHead("Review imported money", "FinMax suggests. You confirm. Nothing reaches your ledger before that.", `<button class="btn" data-action="import">Import more</button><button class="btn primary" data-action="approve-high">Confirm clear items</button>`)}
    <section class="card card-pad"><div class="review-toolbar"><div><strong>${rows.length}</strong> <span class="muted">matching ${rows.length === 1 ? "item" : "items"}</span></div><button class="btn small" data-action="auto-sort">Sort suggestions</button></div>
    <div class="review-filters">${categories.map(category => `<button class="chip ${reviewFilter === category ? "active" : ""}" data-review-filter="${esc(category)}">${esc(category)}</button>`).join("")}</div>
    <div class="review-list">${visible.map(reviewRow).join("") || `<div class="empty"><h3>Nothing waiting here</h3><p>Import a supported statement or change the filter.</p><button class="btn" data-action="import">Import statement</button></div>`}</div>${visible.length < rows.length ? `<button class="btn review-more" data-action="review-more">Show ${Math.min(80, rows.length - visible.length)} more</button>` : ""}</section>
    <div class="notice" style="margin-top:14px"><strong>Your corrections stay useful</strong><p>When you change a category, FinMax remembers a short narration pattern on this device. It will suggest that choice next time, but still asks before confirming.</p></div>`, "Review");
}

function reviewRow(row) {
  const safeNarration = esc(row.rawDescription || row.description);
  return `<details class="review"><summary><div class="review-title"><strong>${esc(row.description || "Imported transaction")}</strong><small>${dateLabel(row.date)} / ${esc(accountName(row.accountId))} / ${esc(row.sourceFile || "Imported file")}</small></div><div class="review-side"><span class="amount">${money(row.amount)}</span><small class="confidence ${row.confidence >= 80 ? "high" : ""}">${esc(row.category)} / ${row.confidence}%</small></div></summary><div class="review-detail"><p>${safeNarration}</p><div class="review-actions"><button class="btn small" data-action="edit-review" data-id="${row.id}">Change</button><button class="btn small primary" data-action="approve-review" data-id="${row.id}">Confirm</button><button class="btn small danger" data-action="dismiss-review" data-id="${row.id}">Ignore</button></div></div></details>`;
}

function activityPage() {
  const query = transactionSearch.trim().toLowerCase();
  const rows = state.transactions.filter(item => (transactionFilter === "all" || item.type === transactionFilter) && (transactionAccount === "all" || item.accountId === transactionAccount) && (!query || `${item.description} ${item.category} ${item.note || ""}`.toLowerCase().includes(query))).sort((a, b) => transactionSort === "oldest" ? String(a.date).localeCompare(String(b.date)) : String(b.date).localeCompare(String(a.date)));
  return shell(`${pageHead("Activity", "Your confirmed money history. Transfers between your accounts stay neutral.", `<button class="btn" data-action="export-simple">Export CSV</button><button class="btn primary" data-action="quick-log">+ New transaction</button>`)}
    <section class="card card-pad"><div class="activity-tools"><input data-activity-search value="${esc(transactionSearch)}" placeholder="Search description or category"><select data-activity-account><option value="all">All accounts</option>${state.accounts.map(account => `<option value="${account.id}" ${transactionAccount === account.id ? "selected" : ""}>${esc(account.name)}</option>`).join("")}</select><select data-activity-sort><option value="newest" ${transactionSort === "newest" ? "selected" : ""}>Newest first</option><option value="oldest" ${transactionSort === "oldest" ? "selected" : ""}>Oldest first</option></select></div><div class="review-filters" style="margin-bottom:12px">${["all", "income", "expense", "saving", "transfer"].map(type => `<button class="chip ${transactionFilter === type ? "active" : ""}" data-transaction-filter="${type}">${type[0].toUpperCase() + type.slice(1)}</button>`).join("")}</div><div class="activity-list">${rows.map(activityRow).join("") || `<div class="empty"><h3>No matching activity</h3><p>Confirmed transactions appear here.</p></div>`}</div></section>`, "Activity");
}

function goalPreview(goal) {
  const progress = goal.target ? Math.min(100, Math.round(number(goal.saved) / number(goal.target) * 100)) : 0;
  const checkpoints = Array.from({ length: 5 }, (_, i) => number(goal.target) * ((i + 1) / 5));
  const currentIndex = Math.min(4, checkpoints.findIndex(value => value > number(goal.saved)) < 0 ? 4 : checkpoints.findIndex(value => value > number(goal.saved)));
  return `<span class="eyebrow">${esc(goal.currency)} / due ${dateLabel(goal.due)}</span><h3>${esc(goal.name)}</h3><div class="goal-number"><strong>${money(goal.saved, goal.currency)}</strong><span>of ${money(goal.target, goal.currency)}</span></div><div class="progress" style="--value:${progress}%"><span></span></div><div class="checkpoint-row">${checkpoints.map((value, index) => `<i class="${value <= goal.saved ? "hit" : index === currentIndex ? "current" : ""}"></i>`).join("")}</div><div class="goal-meta"><span>${progress}% reached</span><span>Next: ${money(checkpoints[currentIndex], goal.currency)}</span></div>`;
}

function goalPage() {
  const goal = state.goal;
  return shell(`${pageHead("One clear goal", "A visible checkpoint is easier to act on than a distant total.", `<button class="btn" data-action="edit-goal">${goal ? "Edit goal" : "Create goal"}</button>${goal ? `<button class="btn primary" data-action="contribute">Add progress</button>` : ""}`)}
    ${goal ? `<section class="card goal-card">${goalPreview(goal)}</section><section class="grid two-col" style="margin-top:14px"><div class="card card-pad"><h3>What counts</h3><p class="muted">Only direct goal contributions count here. Ordinary transfers and imported transactions do not silently move the progress bar.</p></div><div class="notice"><strong>Keep it believable</strong><p>${goalAdvice(goal)}</p></div></section>` : `<section class="card empty"><h3>What should your money do next?</h3><p>Create one target, a due date, and a starting amount. FinMax will break it into five checkpoints.</p><button class="btn primary" data-action="edit-goal">Create my goal</button></section>`}`, "Goal");
}

function goalAdvice(goal) {
  const remaining = Math.max(0, number(goal.target) - number(goal.saved));
  const days = Math.max(1, Math.ceil((new Date(`${goal.due}T23:59:59`) - new Date()) / 86400000));
  return remaining ? `${money(remaining, goal.currency)} remains. That is about ${money(remaining / Math.max(1, days / 7), goal.currency)} per week until ${dateLabel(goal.due)}.` : "This goal is complete. Export a snapshot before choosing the next one.";
}

function snapshotData() {
  const t = totals();
  const expenses = monthTransactions().filter(item => item.type === "expense");
  const categories = Object.entries(expenses.reduce((map, item) => ({ ...map, [item.category]: (map[item.category] || 0) + number(item.amount) }), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { ...t, net: t.income - t.expense - t.protected, categories, largest: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 3) };
}

function snapshotInner() {
  const data = snapshotData();
  const max = data.categories[0]?.[1] || 1;
  return `<section class="snapshot card"><div class="snapshot-cover"><span class="eyebrow">FinMax Money Snapshot / ${new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}</span><h2>${esc(state.profile.name)}'s money, in one page.</h2></div><div class="snapshot-grid"><div><span>Estimated total balance</span><strong>${money(totalBalance())}</strong><small>${state.accounts.length} accounts</small></div><div><span>Income</span><strong>${money(data.income)}</strong><small>Confirmed this month</small></div><div><span>Spent</span><strong>${money(data.expense)}</strong><small>Transfers excluded</small></div><div><span>Saved / invested</span><strong>${money(data.protected)}</strong><small>Protected this month</small></div><div><span>Net movement</span><strong>${money(data.net)}</strong><small>Income less spend and protected money</small></div><div><span>Waiting for review</span><strong>${state.reviewQueue.length}</strong><small>Not used in totals</small></div></div><div class="card-pad"><div class="section-head"><h3>Where spending went</h3><small>Top categories</small></div><div class="category-bars">${data.categories.map(([name, amount]) => `<div><div class="bar-label"><span>${esc(name)}</span><strong>${money(amount)}</strong></div><div class="progress" style="--value:${Math.round(amount / max * 100)}%"><span></span></div></div>`).join("") || emptyInline("No confirmed spending this month")}</div></div><div class="card-pad snapshot-largest"><div class="section-head"><h3>Largest confirmed spending</h3><small>This month</small></div>${data.largest.map(item => `<div class="activity-row"><div><strong>${esc(item.description)}</strong><small>${dateLabel(item.date)} / ${esc(item.category)}</small></div><span class="amount expense">-${money(item.amount, item.currency || accountCurrency(accountById(item.accountId)))}</span></div>`).join("") || emptyInline("No confirmed spending this month")}</div>${state.goal ? `<div class="card-pad" style="border-top:1px solid var(--line)"><div class="section-head"><h3>Goal checkpoint</h3><small>${esc(state.goal.name)}</small></div>${goalPreview(state.goal)}</div>` : ""}</section>`;
}

function snapshotPage() {
  return shell(`${pageHead("Money Snapshot", "A private, printable summary of the decisions that matter.", `<button class="btn" data-action="download-snapshot">Download HTML</button><button class="btn primary" data-action="print">Print / PDF</button>`)}${snapshotInner()}`, "Money Snapshot");
}

function morePage() {
  const payment = state.payment;
  return shell(`${pageHead("More", "Accounts, privacy, backups, appearance, and Beta access.")}
    <section class="grid two-col"><div class="card card-pad"><div class="section-head"><h3>Accounts</h3><button class="btn small" data-action="add-account">Add</button></div><div class="account-list">${state.accounts.map(account => `<div class="account-row"><div><strong>${esc(account.name)}</strong><small>${esc(account.institution)} / ${esc(account.type)}</small></div><div><span class="amount">${money(account.balance, accountCurrency(account))}</span><button class="btn small" style="margin-left:8px" data-action="edit-account" data-id="${account.id}">Edit</button></div></div>`).join("")}</div></div>
    <div class="card card-pad"><h3>Privacy by default</h3><div class="privacy-list"><div><strong>Local storage</strong><small>Transactions and profile data remain in this browser.</small></div><div><strong>No silent ledger changes</strong><small>Imported rows wait for confirmation.</small></div><div><strong>No bank connection</strong><small>Beta v1 cannot move money or read live balances.</small></div></div></div></section>
    <section class="grid two-col" style="margin-top:14px"><div class="card card-pad"><h3>Appearance</h3><p class="muted">Follow your device or choose a fixed theme.</p><div class="page-actions">${["system", "light", "dark"].map(theme => `<button class="btn ${state.profile.theme === theme ? "primary" : ""}" data-theme-choice="${theme}">${theme[0].toUpperCase() + theme.slice(1)}</button>`).join("")}</div></div><div class="card card-pad"><h3>Your data</h3><p class="muted">A full backup includes your accounts, transactions, reviews, rules, goal, settings, and pending transfer note.</p><div class="page-actions"><button class="btn" data-action="backup">Full backup</button><button class="btn" data-action="restore">Restore</button><button class="btn danger" data-action="reset">Reset</button></div></div></section>
    <section class="card card-pad" style="margin-top:14px"><div class="section-head"><div><h3>Beta access</h3><small>USD prices. Transfer details appear after selection.</small></div>${payment ? `<span class="chip active">${esc(payment.status)}</span>` : ""}</div><div class="plans">${planCard("starter", "Quick Check", .77, "One supported statement and one Money Snapshot.")}${planCard("month", "Clear Month", 1.77, "Up to two supported statements and a full monthly review.", true)}${planCard("guided", "Guided Setup", 3.77, "Multiple statements plus guided account and goal setup.")}</div>${payment ? `<div class="payment-status" style="margin-top:12px"><strong>Transfer marked ${esc(payment.status)}</strong><p class="muted" style="margin:5px 0 0">Reference ${esc(payment.reference)}. Offline Beta stores this note only; it cannot notify the owner or verify payment yet.</p></div>` : ""}</section>`, "More");
}

function planCard(id, name, price, text, featured = false) { return `<article class="card plan ${featured ? "featured" : ""}"><span class="eyebrow">${featured ? "Recommended" : "Beta access"}</span><h3>${name}</h3><strong class="plan-price">$${price.toFixed(2)}</strong><small class="plan-term">One-time Beta service</small><p class="muted">${text}</p><button class="btn ${featured ? "primary" : ""}" data-action="choose-plan" data-plan="${id}">Choose ${name}</button></article>`; }

function render() {
  document.querySelectorAll("body > .modal-backdrop").forEach(node => node.remove());
  applyTheme();
  if (!state.profile.onboarded) { app.innerHTML = onboarding(); setSelect("setupCurrency", state.profile.currency); wireLabels(); updateCashFields(); return; }
  const pages = { today: dashboard, review: reviewPage, activity: activityPage, goal: goalPage, snapshot: snapshotPage, more: morePage };
  app.innerHTML = (pages[view] || dashboard)();
  if (!state.profile.tutorialDone) document.body.insertAdjacentHTML("beforeend", tutorial());
  if (modal) document.body.insertAdjacentHTML("beforeend", modalHtml());
  wireLabels();
  updateCashFields();
}

function wireLabels() {
  document.querySelectorAll(".field").forEach((field, index) => {
    const label = field.querySelector(":scope > label");
    const control = field.querySelector(":scope > input, :scope > select, :scope > textarea");
    if (!label || !control) return;
    if (!control.id) control.id = `field_${index}_${Date.now().toString(36)}`;
    label.htmlFor = control.id;
  });
}

function updateCashFields() {
  document.querySelectorAll("[data-account-type]").forEach(select => {
    const form = select.closest("form");
    const field = form?.querySelector("[data-institution-field]");
    const input = field?.querySelector("input");
    if (!field || !input) return;
    const isCash = select.value === "Cash";
    field.hidden = isCash;
    input.required = !isCash;
    if (isCash) input.value = "";
  });
}

function setSelect(id, value) { const input = document.getElementById(id); if (input) input.value = value; }

function modalHtml() {
  if (modal.type === "transaction") return transactionModal();
  if (modal.type === "account") return accountModal();
  if (modal.type === "import") return importModal();
  if (modal.type === "review") return reviewEditModal(modal.id);
  if (modal.type === "goal") return goalModal();
  if (modal.type === "contribute") return contributionModal();
  if (modal.type === "checkout") return checkoutModal();
  return "";
}

function modalWrap(title, subtitle, body) { return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="btn icon-btn" data-action="close-modal" aria-label="Close">X</button></div>${body}</section></div>`; }

function transactionModal() {
  return modalWrap("Log money", "One entry, with no accounting jargon.", `<form data-form="transaction" class="form-grid"><div class="field"><label>What happened?</label><select name="type" id="transactionType"><option value="expense">I spent money</option><option value="income">I received money</option><option value="saving">I saved or invested</option><option value="transfer">I moved money between accounts</option></select></div><div class="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Date</label><input name="date" type="date" value="${today()}" required></div><div class="field"><label>Account</label><select name="accountId">${accountOptions()}</select></div><div class="field"><label>Category</label><input name="category" placeholder="e.g. Food, Salary, Investment" required></div><div class="field"><label>Destination account (optional)</label><select name="toAccountId"><option value="">No destination</option>${accountOptions()}</select></div><div class="field full"><label>Description</label><input name="description" required placeholder="What will help you remember this?"></div><div class="field full"><label>Note (optional)</label><textarea name="note" placeholder="Extra context"></textarea></div><div class="field full modal-actions"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save transaction</button></div></form>`);
}

function accountOptions(selected = "", currency = "") { return state.accounts.filter(account => !currency || accountCurrency(account) === currency).map(account => `<option value="${account.id}" ${account.id === selected ? "selected" : ""}>${esc(account.name)} / ${money(account.balance, accountCurrency(account))}</option>`).join(""); }

function accountModal() {
  const account = modal.id ? accountById(modal.id) : null;
  return modalWrap(account ? "Edit account" : "Add account", "Balances remain manually controlled in this offline beta.", `<form data-form="account" class="form-grid"><input type="hidden" name="id" value="${account?.id || ""}"><div class="field"><label>Name</label><input name="name" required value="${esc(account?.name || "")}" placeholder="Daily account or Pocket cash"></div><div class="field" data-institution-field><label>Bank, fintech, or provider</label><input name="institution" required value="${esc(account?.institution === "Cash on hand" ? "" : account?.institution || "")}" placeholder="e.g. Moniepoint or your bank"></div><div class="field"><label>Where is the money?</label><select name="type" data-account-type>${["Fintech account", "Bank account", "Cash", "Investment account"].map(type => `<option ${account?.type === type || (type === "Fintech account" && account?.type === "Fintech / digital wallet") ? "selected" : ""}>${type}</option>`).join("")}</select></div><div class="field"><label>Currency</label><select name="currency"><option value="NGN" ${accountCurrency(account) === "NGN" ? "selected" : ""}>NGN</option><option value="USD" ${accountCurrency(account) === "USD" ? "selected" : ""}>USD</option></select></div><div class="field"><label>Current balance</label><input name="balance" type="number" min="0" step="0.01" value="${number(account?.balance)}" required></div><div class="field full modal-actions">${account && state.accounts.length > 1 ? `<button class="btn danger" type="button" data-action="delete-account" data-id="${account.id}">Delete</button>` : ""}<button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save account</button></div></form>`);
}

function importModal() {
  return modalWrap("Import a statement", "Files are read locally. PalmPay and Moniepoint PDFs are the supported PDF formats in Beta v1.", `<form data-form="import" class="form-grid"><div class="field full"><label>Which account is this for?</label><select name="accountId">${accountOptions()}</select></div><div class="field full"><label>Statement file</label><input name="file" type="file" accept=".pdf,.csv,.json,.txt,application/pdf,text/csv,application/json" required></div><div class="field full notice"><strong>Before you import</strong><p>Text-based PDFs work best. Image scans are not supported yet. Every row goes to Review first and imported history does not rewrite the account balance.</p></div><div class="field full modal-actions"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Read file privately</button></div></form>`);
}

function reviewEditModal(id) {
  const row = state.reviewQueue.find(item => item.id === id); if (!row) return "";
  const guess = guessRow(row);
  return modalWrap("Correct this suggestion", "FinMax will remember a short narration pattern locally.", `<form data-form="review-edit" class="form-grid"><input type="hidden" name="id" value="${row.id}"><div class="field"><label>Type</label><select name="type">${["income", "expense", "saving", "transfer"].map(type => `<option value="${type}" ${guess.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></div><div class="field"><label>Category</label><input name="category" required value="${esc(guess.category)}"></div><div class="field full"><label>Description</label><input name="description" required value="${esc(row.description)}"></div><div class="field full"><label>Original narration</label><textarea readonly>${esc(row.rawDescription || row.description)}</textarea></div><div class="field full modal-actions"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save suggestion</button></div></form>`);
}

function goalModal() {
  const goal = state.goal || { name: "", currency: state.profile.currency, target: "", saved: 0, due: `${new Date().getFullYear()}-12-31` };
  return modalWrap(state.goal ? "Edit your goal" : "Create one goal", "FinMax will turn the total into five visible checkpoints.", `<form data-form="goal" class="form-grid"><div class="field full"><label>Goal name</label><input name="name" required value="${esc(goal.name)}" placeholder="Emergency reserve"></div><div class="field"><label>Currency</label><select name="currency"><option value="NGN" ${goal.currency === "NGN" ? "selected" : ""}>NGN</option><option value="USD" ${goal.currency === "USD" ? "selected" : ""}>USD</option></select></div><div class="field"><label>Target amount</label><input name="target" type="number" min="1" step="0.01" required value="${number(goal.target) || ""}"></div><div class="field"><label>Already saved</label><input name="saved" type="number" min="0" step="0.01" required value="${number(goal.saved)}"></div><div class="field"><label>Due date</label><input name="due" type="date" required value="${goal.due}"></div><div class="field full modal-actions"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save goal</button></div></form>`);
}

function contributionModal() { return modalWrap("Add goal progress", `Current progress: ${money(state.goal?.saved || 0, state.goal?.currency)}. This will deduct the selected account.`, `<form data-form="contribution" class="form-grid"><div class="field full"><label>Account used</label><select name="accountId" required>${accountOptions("", state.goal?.currency)}</select></div><div class="field full"><label>Amount added</label><input name="amount" type="number" min="0.01" step="0.01" required autofocus></div><div class="field full"><label>Note</label><input name="note" placeholder="Optional source or milestone"></div><div class="field full modal-actions"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Deduct and add progress</button></div></form>`); }

const plans = { starter: { name: "Quick Check", price: .77 }, month: { name: "Clear Month", price: 1.77 }, guided: { name: "Guided Setup", price: 3.77 } };
function checkoutModal() {
  const plan = plans[modal.plan]; const currency = modal.currency || "USD"; const estimate = plan.price * FALLBACK_USD_NGN_RATE;
  const usd = { bank: "LEAD BANK", account: "213759156582", name: "Dominion C. Clinton" };
  const ngn = { bank: "PALMPAY/MONIEPOINT", account: "8085318908", name: "Clinton, Dominion C." };
  const details = currency === "USD" ? usd : ngn;
  const amountLabel = currency === "USD" ? `$${plan.price.toFixed(2)}` : money(estimate, "NGN");
  return modalWrap(`${plan.name} / $${plan.price.toFixed(2)}`, "One-time manual transfer prototype for Beta testing.", `<div class="page-actions" style="margin-bottom:14px"><button class="btn ${currency === "USD" ? "primary" : ""}" data-checkout-currency="USD">Pay in USD</button><button class="btn ${currency === "NGN" ? "primary" : ""}" data-checkout-currency="NGN">Other currency / NGN</button></div>${currency === "NGN" ? `<div class="bank-box" style="margin-bottom:12px"><span>FinMax beta rate <b>1 USD = ${money(FALLBACK_USD_NGN_RATE, "NGN")}</b></span><span>Rate updated <b>${dateLabel(FX_RATE_UPDATED)}</b></span><small class="muted">This fixed offline rate is maintained in the build and cannot be reduced during checkout.</small></div>` : ""}<div class="bank-box"><span>Bank / provider <b>${details.bank}</b></span><span>Account number <b>${details.account}</b></span><span>Account name <b>${details.name}</b></span><span>Amount <b>${amountLabel}</b></span><div class="copy-actions"><button class="btn small" data-copy="${details.account}">Copy account number</button><button class="btn small" data-copy="${amountLabel}">Copy amount</button></div></div><div class="notice" style="margin-top:12px"><strong>Important</strong><p>This offline build cannot verify a transfer or notify the owner. Marking it sent creates a local pending note only. Server verification comes with Supabase and Vercel after beta validation.</p></div><div class="modal-actions"><button class="btn" data-action="close-modal">Not now</button><button class="btn primary" data-action="mark-payment" data-plan="${modal.plan}" data-currency="${currency}">I have made the transfer</button></div>`);
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); }
  catch (_) { const input = document.createElement("textarea"); input.value = value; input.style.position = "fixed"; input.style.opacity = "0"; document.body.append(input); input.select(); document.execCommand("copy"); input.remove(); }
  toast("Copied");
}

function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

document.addEventListener("submit", async event => {
  const form = event.target.closest("form[data-form]"); if (!form) return;
  event.preventDefault();
  const data = formData(form);
  try {
    if (form.dataset.form === "profile") {
      state.profile.name = data.name.trim(); state.profile.currency = data.currency; setupStep = 2; save(); render(); return;
    }
    if (form.dataset.form === "first-account") {
      state.accounts.push({ id: uid("acc"), name: data.name.trim(), institution: data.type === "Cash" ? "Cash on hand" : data.institution.trim(), type: data.type, currency: state.profile.currency, balance: number(data.balance), createdAt: new Date().toISOString() });
      state.profile.onboarded = true; save(); render(); return;
    }
    if (form.dataset.form === "transaction") { saveTransaction(data); return; }
    if (form.dataset.form === "account") { saveAccount(data); return; }
    if (form.dataset.form === "import") { importStatement(form, data.accountId).catch(error => toast(error.message || "That import could not finish", "error")); return; }
    if (form.dataset.form === "review-edit") { saveReviewEdit(data); return; }
    if (form.dataset.form === "goal") { state.goal = { id: state.goal?.id || uid("goal"), name: data.name.trim(), currency: data.currency, target: number(data.target), saved: Math.min(number(data.saved), number(data.target)), due: data.due }; modal = null; save(); render(); toast("Goal saved"); return; }
    if (form.dataset.form === "contribution") {
      const account = accountById(data.accountId); const amount = number(data.amount);
      if (!account) throw new Error("Choose the account this contribution came from");
      if (accountCurrency(account) !== state.goal.currency) throw new Error("Choose an account in the same currency as this goal");
      if (amount > number(account.balance)) throw new Error("That contribution is above the account balance");
      account.balance -= amount; state.goal.saved = Math.min(state.goal.target, number(state.goal.saved) + amount);
      state.transactions.unshift({ id: uid("tx"), date: today(), description: data.note.trim() || `Progress toward ${state.goal.name}`, category: "Goal contribution", accountId: account.id, type: "saving", amount, currency: accountCurrency(account), source: "Goal" });
      modal = null; save(); render(); toast("Goal progress and account balance updated");
    }
  } catch (error) { toast(error.message || "That could not be saved", "error"); }
});

function saveTransaction(data) {
  const amount = number(data.amount); if (!amount) throw new Error("Enter an amount above zero");
  const from = accountById(data.accountId); if (!from) throw new Error("Choose an account");
  const type = data.type;
  const destination = data.toAccountId ? accountById(data.toAccountId) : null;
  if (type === "transfer" && !destination) throw new Error("Choose the account receiving this transfer");
  if (type === "transfer" && destination.id === from.id) throw new Error("The sending and receiving accounts must be different");
  if (destination && accountCurrency(destination) !== accountCurrency(from)) throw new Error("Cross-currency transfers need an exchange entry; use accounts with the same currency in Beta v1");
  if (type === "income") from.balance += amount;
  if (["expense", "saving", "transfer"].includes(type)) from.balance -= amount;
  if ((type === "transfer" || type === "saving") && destination) destination.balance += amount;
  state.transactions.unshift({ id: uid("tx"), date: data.date, description: data.description.trim(), category: data.category.trim(), accountId: data.accountId, toAccountId: destination?.id || null, type, amount, currency: accountCurrency(from), note: data.note.trim(), source: "Manual" });
  modal = null; save(); render(); toast("Transaction saved");
}

function saveAccount(data) {
  const existing = accountById(data.id);
  const next = { id: data.id || uid("acc"), name: data.name.trim(), institution: data.type === "Cash" ? "Cash on hand" : data.institution.trim(), type: data.type, currency: data.currency, balance: number(data.balance) };
  if (existing) Object.assign(existing, next); else state.accounts.push(next);
  modal = null; save(); render(); toast(existing ? "Account updated" : "Account added");
}

function saveReviewEdit(data) {
  const row = state.reviewQueue.find(item => item.id === data.id); if (!row) return;
  row.type = data.type; row.category = data.category.trim(); row.description = data.description.trim();
  const signature = ruleSignature(row);
  if (signature.length) {
    const key = signature.join("|");
    state.rules = [{ id: uid("rule"), signature, type: row.type, category: row.category, uses: 1, correctedAt: new Date().toISOString() }, ...state.rules.filter(rule => (rule.signature || []).join("|") !== key)].slice(0, 100);
  }
  modal = null; save(); render(); toast("Suggestion updated and remembered locally");
}

function waitForPaint() { return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))); }

function setImportStatus(update) {
  importStatus = { ...(importStatus || {}), ...update };
  const now = Date.now();
  if (update.force || now - lastImportRender > 180) {
    lastImportRender = now;
    render();
  }
}

function importTimeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("This import is taking too long. Try a smaller statement period, or export the statement as CSV if your provider allows it.")), ms));
}

async function importStatement(form, accountId) {
  const file = form.elements.file.files[0]; if (!file) throw new Error("Choose a statement file");
  const lower = file.name.toLowerCase(); const account = accountById(accountId);
  if (lower.endsWith(".pdf") && !/(palmpay|moniepoint)/i.test(`${file.name} ${account?.institution}`)) throw new Error("Beta v1 supports PalmPay and Moniepoint PDFs. Use CSV, JSON, or text for other providers.");
  const token = ++activeImportToken;
  importStatus = { active: true, fileName: file.name, message: "Preparing to read your statement locally..." };
  modal = null; view = "review"; render();
  await waitForPaint();
  try {
    setImportStatus({ message: "Reading the file and extracting transaction rows...", force: true });
    await waitForPaint();
    if (lower.endsWith(".pdf")) {
      const result = await Promise.race([importPdfIntoReview(file, accountId, token), importTimeout(120000)]);
      if (token !== activeImportToken) return;
      importStatus = null; save(); view = "review"; render();
      toast(`${result.fresh} new ${result.fresh === 1 ? "row" : "rows"} added to Review${result.duplicates ? `; ${result.duplicates} duplicate(s) skipped` : ""}`);
      return;
    }
    const rows = await Promise.race([parseStatement(file, accountId, setImportStatus), importTimeout(120000)]);
    if (token !== activeImportToken) return;
    setImportStatus({ message: "Removing duplicates before adding items to Review...", force: true });
    const { fresh, duplicates } = addRowsToReview(rows);
    importStatus = null; save(); view = "review"; render();
    toast(`${fresh} new ${fresh === 1 ? "row" : "rows"} added to Review${duplicates ? `; ${duplicates} duplicate(s) skipped` : ""}`);
  } catch (error) {
    if (token !== activeImportToken) return;
    activeImportToken++;
    importStatus = { active: false, error: true, fileName: file.name, message: error.message || "That import could not finish." };
    view = "review"; render();
    throw error;
  }
}

function addRowsToReview(rows) {
  const fingerprints = new Set([...state.reviewQueue, ...state.transactions].map(item => item.fingerprint).filter(Boolean));
  const freshRows = [];
  let duplicates = 0;
  rows.forEach(row => {
    if (!row?.fingerprint || fingerprints.has(row.fingerprint)) { duplicates++; return; }
    fingerprints.add(row.fingerprint);
    freshRows.push(row);
  });
  if (freshRows.length) state.reviewQueue.unshift(...freshRows);
  return { fresh: freshRows.length, duplicates };
}

async function importPdfIntoReview(file, accountId, token) {
  if (!globalThis.pdfjsLib?.getDocument) throw new Error("The local PDF reader did not load");
  setImportStatus({ message: "Starting the offline PDF reader...", force: true });
  await ensurePdfWorker();
  setImportStatus({ message: "Opening the PDF without uploading it...", force: true });
  const loadingTask = globalThis.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useWorkerFetch: false, disableAutoFetch: true, disableStream: true });
  const document = await loadingTask.promise;
  let fresh = 0;
  let duplicates = 0;
  try {
    for (let pageNo = 1; pageNo <= document.numPages; pageNo++) {
      if (token !== activeImportToken) break;
      setImportStatus({ message: `Reading page ${pageNo} of ${document.numPages}...`, page: pageNo, pages: document.numPages, found: fresh, force: true });
      const page = await document.getPage(pageNo);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.filter(item => item.str?.trim()).map(item => ({ text: item.str.replace(/\s+/g, " ").trim(), x: item.transform?.[4] || 0, y: item.transform?.[5] || 0 }));
      const rows = statementRowsFromPdfLayout([{ number: pageNo, width: viewport.width, height: viewport.height, items }])
        .map((row, index) => normalizeImport(row, accountId, file.name, `${pageNo}-${index}`)).filter(Boolean);
      const added = addRowsToReview(rows);
      fresh += added.fresh; duplicates += added.duplicates;
      if (added.fresh) save();
      setImportStatus({ message: `Found ${fresh} ${fresh === 1 ? "item" : "items"} so far. You can stay on this screen.`, page: pageNo, pages: document.numPages, found: fresh, force: true });
      await waitForPaint();
    }
  } finally {
    await document.cleanup?.();
    await document.destroy?.();
  }
  return { fresh, duplicates };
}

async function parseStatement(file, accountId, onProgress = () => {}) {
  let text = "";
  let rawRows = [];
  if (/\.pdf$/i.test(file.name)) {
    const pages = await extractPdfLayout(file, onProgress);
    rawRows = statementRowsFromPdfLayout(pages);
    if (!rawRows.length) text = pdfLayoutToText(pages);
  } else {
    onProgress({ message: "Reading text rows from the file...", force: true });
    text = await file.text();
  }
  if (/\.json$/i.test(file.name)) { const parsed = JSON.parse(text); rawRows = Array.isArray(parsed) ? parsed : parsed.transactions || parsed.rows || []; }
  else if (/\.csv$/i.test(file.name)) rawRows = parseCsv(text);
  else if (!rawRows.length) rawRows = parseStatementText(text);
  onProgress({ message: `Preparing ${rawRows.length} ${rawRows.length === 1 ? "item" : "items"} for Review...`, force: true });
  await waitForPaint();
  return rawRows.map((row, index) => normalizeImport(row, accountId, file.name, index)).filter(Boolean);
}

async function extractPdfLayout(file, onProgress = () => {}) {
  if (!globalThis.pdfjsLib?.getDocument) throw new Error("The local PDF reader did not load");
  onProgress({ message: "Starting the offline PDF reader...", force: true });
  await ensurePdfWorker();
  onProgress({ message: "Opening the PDF without uploading it...", force: true });
  const loadingTask = globalThis.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useWorkerFetch: false, disableAutoFetch: true, disableStream: true });
  const document = await loadingTask.promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= document.numPages; pageNo++) {
    onProgress({ message: `Reading page ${pageNo} of ${document.numPages}...`, page: pageNo, pages: document.numPages });
    const page = await document.getPage(pageNo); const viewport = page.getViewport({ scale: 1 }); const content = await page.getTextContent();
    const items = content.items.filter(item => item.str?.trim()).map(item => ({ text: item.str.replace(/\s+/g, " ").trim(), x: item.transform?.[4] || 0, y: item.transform?.[5] || 0 }));
    pages.push({ number: pageNo, width: viewport.width, height: viewport.height, items });
    await waitForPaint();
  }
  await document.cleanup?.();
  await document.destroy?.();
  return pages;
}

function pdfLayoutToText(layout) {
  const output = [];
  layout.forEach(page => {
    const lines = [];
    page.items.forEach(item => { let line = lines.find(candidate => Math.abs(candidate.y - item.y) < 2); if (!line) { line = { y: item.y, items: [] }; lines.push(line); } line.items.push(item); });
    lines.sort((a, b) => b.y - a.y).forEach(line => output.push(line.items.sort((a, b) => a.x - b.x).map(item => item.text).join(" ")));
  });
  return output.join("\n");
}

function pdfNumber(value) { const parsed = Number(String(value || "").replace(/[^\d.-]/g, "")); return Number.isFinite(parsed) ? Math.abs(parsed) : 0; }
function pdfRecordText(items) { return items.slice().sort((a, b) => Math.abs(a.y - b.y) < 2 ? a.x - b.x : b.y - a.y).map(item => item.text).join(" ").replace(/\s+/g, " ").trim(); }

function statementRowsFromPdfLayout(pages) {
  const rows = [];
  pages.forEach(page => {
    const references = page.items.filter(item => /_(?:CBA_)?(?:CREDIT|DEBIT)_\d+\b/i.test(item.text)).sort((a, b) => b.y - a.y);
    const records = references.map(() => []);
    const debitX = page.items.find(item => /^Debit$/i.test(item.text))?.x || page.width * .528;
    const creditX = page.items.find(item => /^Credit$/i.test(item.text))?.x || page.width * .566;
    const settlementX = page.items.find(item => /^Amount$/i.test(item.text))?.x || page.width * .488;
    const narrationX = page.items.find(item => /^Narration$/i.test(item.text))?.x || page.width * .856;
    let recordIndex = 0;
    const sortedItems = page.items.slice().sort((a, b) => b.y - a.y);
    sortedItems.forEach(item => {
      while (recordIndex < references.length - 1 && item.y < (references[recordIndex].y + references[recordIndex + 1].y) / 2) recordIndex++;
      if (references.length) records[recordIndex].push(item);
    });
    references.forEach((reference, index) => {
      const record = records[index];
      const onAmountLine = record.filter(item => Math.abs(item.y - reference.y) < 4 && pdfNumber(item.text) >= 0);
      const nearestAmount = x => onAmountLine.map(item => ({ item, distance: Math.abs(item.x - x) })).filter(candidate => candidate.distance < 34).sort((a, b) => a.distance - b.distance)[0]?.item;
      const debit = nearestAmount(debitX); const credit = nearestAmount(creditX); const settlement = nearestAmount(settlementX);
      const isCredit = /_CREDIT_\d+\b/i.test(reference.text); const amount = pdfNumber(isCredit ? credit?.text : debit?.text) || pdfNumber(settlement?.text);
      if (!amount) return;
      const dateRaw = record.filter(item => item.x < page.width * .045).sort((a, b) => b.y - a.y).map(item => item.text).join("").replace(/\s+/g, "");
      const narration = pdfRecordText(record.filter(item => item.x >= narrationX - 8)).replace(/^(?:N\/A\s*)+/i, "").trim();
      const rawDescription = pdfRecordText(record);
      rows.push({ date: dateRaw, description: (narration || (isCredit ? "Incoming transfer" : "Outgoing transaction")).slice(0, 240), rawDescription, amount, type: isCredit ? "income" : "expense" });
    });
  });
  return rows;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean); if (lines.length < 2) return [];
  const split = line => { const values = []; let value = "", quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && line[i + 1] === '"') { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { values.push(value); value = ""; } else value += char; } values.push(value); return values; };
  const headers = split(lines[0]).map(header => header.trim().toLowerCase().replace(/\s+/g, ""));
  return lines.slice(1).map(line => Object.fromEntries(split(line).map((value, index) => [headers[index], value.trim()])));
}

function parseStatementText(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean); const rows = [];
  const datePattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i;
  lines.forEach((line, index) => {
    if (!datePattern.test(line)) return;
    const amounts = [...line.matchAll(/(?:NGN|\u20A6|USD|\$)?\s*(-?[\d,]+(?:\.\d{1,2})?)/gi)].map(match => ({ raw: match[0], value: number(match[1]), index: match.index })).filter(item => item.value > 0);
    if (!amounts.length) return;
    const amount = amounts.at(-1); const date = line.match(datePattern)?.[0];
    const description = line.replace(datePattern, "").replace(amount.raw, "").replace(/\s+/g, " ").trim() || `Imported transaction ${index + 1}`;
    rows.push({ date, description, rawDescription: line, amount: amount.value, type: /credit|received|inflow/i.test(line) ? "income" : /debit|paid|purchase|withdraw/i.test(line) ? "expense" : "transfer" });
  });
  return rows;
}

function normalizeDate(value) { const parsed = new Date(value); if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString().slice(0, 10); const parts = String(value).split(/[/-]/); if (parts.length === 3) { const [a, b, c] = parts; return `${c.length === 2 ? `20${c}` : c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`; } return today(); }
function normalizeImport(row, accountId, sourceFile, index) {
  const debit = number(row.debit || row.withdrawal); const credit = number(row.credit || row.deposit);
  const amount = Math.abs(number(row.amount || row.value || row.total || debit || credit)); if (!amount) return null;
  const raw = String(row.rawDescription || row.rawdescription || row.narration || row.description || row.memo || row.details || row.remark || row.name || "").trim();
  const description = String(row.description || row.narration || row.memo || row.details || row.remark || row.name || raw || `Imported row ${index + 1}`).trim();
  const date = normalizeDate(row.date || row.transactiondate || row.valuedate || today());
  const type = row.type || (credit ? "income" : debit ? "expense" : "transfer");
  const fingerprint = [accountId, date, amount.toFixed(2), raw.toLowerCase().replace(/\s+/g, " ")].join("|");
  return { id: uid("review"), date, description: description.slice(0, 240), rawDescription: raw || description, amount, accountId, type, category: row.category || "", sourceFile, fingerprint };
}

function approveRows(ids) {
  const wanted = new Set(ids); const approved = [];
  state.reviewQueue.forEach(row => {
    if (!wanted.has(row.id)) return;
    const guess = guessRow(row); const account = accountById(row.accountId);
    approved.push({ id: uid("tx"), date: row.date, description: row.description, rawDescription: row.rawDescription, category: guess.category, accountId: row.accountId, type: guess.type, amount: row.amount, currency: accountCurrency(account), source: "Imported", sourceFile: row.sourceFile, fingerprint: row.fingerprint });
  });
  if (!approved.length) return 0;
  state.transactions.unshift(...approved); state.reviewQueue = state.reviewQueue.filter(item => !wanted.has(item.id));
  save(); render(); return approved.length;
}

function approveReview(id) {
  if (approveRows([id])) toast("Transaction confirmed");
}

function download(name, content, type = "application/json") { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 500); }

function printSnapshot() {
  const previousTitle = document.title;
  document.title = "";
  document.body.classList.add("printing-snapshot");
  const cleanup = () => { document.body.classList.remove("printing-snapshot"); document.title = previousTitle; };
  addEventListener("afterprint", cleanup, { once: true });
  print();
  setTimeout(cleanup, 1500);
}

document.addEventListener("change", event => {
  if (event.target.matches("[data-account-type]")) updateCashFields();
  if (event.target.matches("[data-activity-account]")) { transactionAccount = event.target.value; render(); }
  if (event.target.matches("[data-activity-sort]")) { transactionSort = event.target.value; render(); }
});

document.addEventListener("input", event => {
  if (!event.target.matches("[data-activity-search]")) return;
  transactionSearch = event.target.value;
  const position = event.target.selectionStart; render();
  const input = document.querySelector("[data-activity-search]"); if (input) { input.focus(); input.setSelectionRange(position, position); }
});

document.addEventListener("click", event => {
  if (modal && event.target.classList.contains("modal-backdrop")) { modal = null; render(); return; }
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { view = viewButton.dataset.view; modal = null; render(); scrollTo({ top: 0, behavior: "smooth" }); return; }
  const themeButton = event.target.closest("[data-theme-choice]");
  if (themeButton) { state.profile.theme = themeButton.dataset.themeChoice; save(); render(); return; }
  const reviewFilterButton = event.target.closest("[data-review-filter]");
  if (reviewFilterButton) { reviewFilter = reviewFilterButton.dataset.reviewFilter; reviewLimit = 80; render(); return; }
  const transactionFilterButton = event.target.closest("[data-transaction-filter]");
  if (transactionFilterButton) { transactionFilter = transactionFilterButton.dataset.transactionFilter; render(); return; }
  const currencyButton = event.target.closest("[data-checkout-currency]");
  if (currencyButton) { modal.currency = currencyButton.dataset.checkoutCurrency; render(); return; }
  const copyButton = event.target.closest("[data-copy]");
  if (copyButton) { copyText(copyButton.dataset.copy); return; }
  const actionButton = event.target.closest("[data-action]"); if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "setup-back") { setupStep = 1; render(); }
  if (action === "tutorial-back") { tutorialStep = Math.max(0, tutorialStep - 1); render(); }
  if (action === "tutorial-skip") { state.profile.tutorialDone = true; save(); render(); }
  if (action === "tutorial-next") { if (tutorialStep < tutorialSlides.length - 1) tutorialStep++; else { state.profile.tutorialDone = true; save(); } render(); }
  if (action === "cycle-theme") { state.profile.theme = resolvedTheme() === "dark" ? "light" : "dark"; save(); render(); }
  if (action === "quick-log") { modal = { type: "transaction" }; render(); }
  if (action === "add-account" || action === "manage-accounts") { modal = { type: "account" }; render(); }
  if (action === "edit-account") { modal = { type: "account", id: actionButton.dataset.id }; render(); }
  if (action === "delete-account") { if (confirm("Delete this account? Existing transactions keep their history.")) { state.accounts = state.accounts.filter(account => account.id !== actionButton.dataset.id); modal = null; save(); render(); toast("Account removed"); } }
  if (action === "import") { modal = { type: "import" }; render(); }
  if (action === "clear-import-status") { importStatus = null; render(); }
  if (action === "edit-review") { modal = { type: "review", id: actionButton.dataset.id }; render(); }
  if (action === "approve-review") approveReview(actionButton.dataset.id);
  if (action === "dismiss-review") { state.reviewQueue = state.reviewQueue.filter(item => item.id !== actionButton.dataset.id); save(); render(); toast("Imported row ignored"); }
  if (action === "auto-sort") { state.reviewQueue.forEach(row => Object.assign(row, guessRow(row))); save(); render(); toast("Suggestions refreshed"); }
  if (action === "review-more") { reviewLimit += 80; render(); }
  if (action === "approve-high") { const ids = state.reviewQueue.filter(row => guessRow(row).confidence >= 85 && guessRow(row).category !== "Transfer review").map(row => row.id); const count = approveRows(ids); toast(count ? `${count} clear items confirmed` : "No high-confidence items are ready; review them individually"); }
  if (action === "edit-goal") { modal = { type: "goal" }; render(); }
  if (action === "contribute") { modal = { type: "contribute" }; render(); }
  if (action === "close-modal") { modal = null; render(); }
  if (action === "print") printSnapshot();
  if (action === "export-simple") { const header = "date,description,category,account,type,amount,source\n"; const rows = state.transactions.map(item => [item.date, item.description, item.category, accountName(item.accountId), item.type, item.amount, item.source].map(value => `"${String(value || "").replace(/"/g, '""')}"`).join(",")).join("\n"); download(`finmax-activity-${today()}.csv`, header + rows, "text/csv"); }
  if (action === "download-snapshot") { const html = `<!doctype html><meta charset="utf-8"><title>FinMax Money Snapshot</title><style>@page{size:A4;margin:0}body{font-family:Arial;max-width:820px;margin:0 auto;padding:12mm;color:#17201d}.card{border:1px solid #dce2de}.card-pad,.snapshot-cover{padding:24px}.snapshot-grid{display:grid;grid-template-columns:repeat(3,1fr)}.snapshot-grid>div{padding:18px;border:1px solid #dce2de}small,span{color:#68736e}.progress{height:8px;background:#eee}.progress span{display:block;height:100%;background:#087f6b}.checkpoint-row{display:flex;gap:6px}.checkpoint-row i{width:20%;height:6px;background:#ddd}.checkpoint-row .hit{background:#087f6b}</style>${snapshotInner()}`; download(`finmax-money-snapshot-${today()}.html`, html, "text/html"); }
  if (action === "backup") download(`finmax-full-backup-${today()}.json`, JSON.stringify({ kind: "finmax-beta-v1-full-backup", exportedAt: new Date().toISOString(), state }, null, 2));
  if (action === "restore") restoreFile.click();
  if (action === "reset" && confirm("Erase every FinMax Beta account, transaction, review, rule, goal, payment note, and setting on this browser? Export a full backup first if needed.")) { localStorage.removeItem(STORAGE_KEY); state = freshState(); setupStep = 1; tutorialStep = 0; view = "today"; render(); toast("FinMax Beta reset"); }
  if (action === "choose-plan") { modal = { type: "checkout", plan: actionButton.dataset.plan, currency: "USD" }; render(); }
  if (action === "mark-payment") { state.payment = { plan: actionButton.dataset.plan, currency: actionButton.dataset.currency, rate: actionButton.dataset.currency === "NGN" ? FALLBACK_USD_NGN_RATE : null, status: "pending verification", reference: `FM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, createdAt: new Date().toISOString() }; modal = null; save(); render(); toast("Transfer note saved as pending, not confirmed"); }
});

restoreFile.addEventListener("change", async () => {
  const file = restoreFile.files[0]; if (!file) return;
  try { const payload = JSON.parse(await file.text()); if (payload.kind !== "finmax-beta-v1-full-backup" || !payload.state || payload.state.version !== VERSION) throw new Error("This is not a FinMax Beta v1 full backup"); state = { ...freshState(), ...payload.state, profile: { ...freshState().profile, ...payload.state.profile } }; save(); view = "today"; render(); toast("Full backup restored"); }
  catch (error) { toast(error.message || "Backup could not be restored", "error"); }
  finally { restoreFile.value = ""; }
});

matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (state.profile.theme === "system") render(); });
applyTheme();
render();
