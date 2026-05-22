const STORAGE_KEY = "dc_web_state_v1";

const STAT_NAMES = ["Body", "Mind", "Spirit", "Knowledge", "Financial", "Dexterity"];

const MODULES = [
  { id: "financial", name: "Financial", stat: "Financial", color: "financial", desc: "Income, expenses, and cashflow" },
  { id: "spirit", name: "Spirit", stat: "Spirit", color: "spirit", desc: "Prayer, Bible, reflection, and leadership" },
  { id: "mind", name: "Mind", stat: "Mind", color: "mind", desc: "Focus, mood, and DeeCadence" },
  { id: "energy", name: "Energy", stat: "Body", color: "energy", desc: "Sleep, water, exercise, and body care" },
  { id: "knowledge", name: "Knowledge", stat: "Knowledge", color: "knowledge", desc: "Reading, vocabulary, and skill practice" },
  { id: "dexterity", name: "Dexterity", stat: "Dexterity", color: "dexterity", desc: "Creative skill, craft, and VoxScope" }
];

const DEFAULT_STATE = {
  route: "home",
  theme: localStorage.getItem("dc_theme") || "system",
  settings: { name: localStorage.getItem("dc_name") || "DC" },
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
    quizFeedback: ""
  }
};

const screen = document.querySelector("#screen");
const title = document.querySelector("#screenTitle");
const themeToggle = document.querySelector("#themeToggle");
const activeFocusPill = document.querySelector("#activeFocusPill");

let state = loadState();
let shouldScrollTop = false;
let focusTimerInterval = null;

function loadState() {
  const saved = safeJson(localStorage.getItem(STORAGE_KEY));
  const migratedStats = safeJson(localStorage.getItem("dc_stats"));
  const base = clone(DEFAULT_STATE);
  if (migratedStats) base.stats = { ...base.stats, ...migratedStats };
  return mergeState(base, saved || {});
}

function mergeState(base, patch) {
  return {
    ...base,
    ...patch,
    settings: { ...base.settings, ...(patch.settings || {}) },
    stats: { ...base.stats, ...(patch.stats || {}) },
    logs: { ...base.logs, ...(patch.logs || {}) },
    ui: { ...base.ui, ...(patch.ui || {}) },
    activity: Array.isArray(patch.activity) ? patch.activity : base.activity,
    focusSessions: Array.isArray(patch.focusSessions) ? patch.focusSessions : base.focusSessions,
    focusDebt: Number.isFinite(patch.focusDebt) ? patch.focusDebt : base.focusDebt,
    activeFocus: patch.activeFocus || base.activeFocus
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  return Math.max(1, Math.min(100, Math.round(value)));
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

function statDelta(effects) {
  Object.entries(effects || {}).forEach(([name, delta]) => {
    if (!STAT_NAMES.includes(name)) return;
    state.stats[name] = clampStat((state.stats[name] || 1) + delta);
  });
}

function applyAction(action) {
  statDelta(action.effects);
  queueFloaters(action.effects);

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
    effects: action.effects || {},
    date: today(),
    createdAt: nowIso()
  });
  state.activity = state.activity.slice(0, 80);
  saveState();
  render();
}

function attentionScore() {
  const todayKey = new Date().toDateString();
  const todayMins = state.focusSessions
    .filter((session) => new Date(session.createdAt).toDateString() === todayKey)
    .reduce((sum, session) => sum + (session.minutes || 0), 0);
  return Math.max(0, Math.min(100, (todayMins * 2) - Math.floor(state.focusDebt / 3)));
}

function suggestedAction() {
  if (state.focusDebt > 0) return "Clear a little focus debt with a DeeCadence session.";
  const [name] = weakestStat();
  const mod = moduleByStat(name);
  return `Give ${mod.name} a small win today.`;
}

function setRoute(route, pushHash = true) {
  state.route = route;
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
  document.body.dataset.route = state.route;
  document.body.style.setProperty("--route-accent", routeAccent(state.route));
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === state.route);
  });

  const routes = {
    home: renderHome,
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
}

function queueFloaters(effects) {
  const entries = Object.entries(effects || {}).filter(([, delta]) => delta !== 0);
  if (!entries.length) return;
  const layer = document.querySelector(".float-layer") || createFloatLayer();
  entries.forEach(([name, delta], index) => {
    const chip = document.createElement("div");
    chip.className = `stat-floater ${delta > 0 ? "gain" : "loss"}`;
    chip.textContent = `${name} ${delta > 0 ? "+" : ""}${delta}`;
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
  const elapsed = Math.floor((Date.now() - new Date(state.activeFocus.startedAt).getTime()) / 1000);
  return Math.max(0, total - elapsed);
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
  if (remaining <= 0) autoCompleteFocus();
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
  if (remaining <= 0) autoCompleteFocus();
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
      .map(([name, delta]) => `${name} ${delta > 0 ? "+" : ""}${delta}`)
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
        <span style="color: var(--${mod.color})">${value} - Rank ${rank(value)}</span>
      </div>
      <div class="bar"><span style="width:${value}%; background: var(--${mod.color})"></span></div>
    </article>
  `;
}

function moduleCard(mod) {
  const value = state.stats[mod.stat] || 1;
  const recent = state.logs[mod.id]?.filter((entry) => entry.date === today()).length || 0;
  return `
    <button class="module-card" type="button" data-route="${mod.id}" style="--module-color: var(--${mod.color})">
      <span>${mod.name}</span>
      <small>${mod.desc}</small>
      <b>${value} - Rank ${rank(value)}</b>
      <em>${recent} today</em>
      <i class="bar"><span style="width:${value}%"></span></i>
    </button>
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
    <section class="hero-card">
      <p>${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <h2>${greeting}, ${escapeHtml(state.settings.name || "DC")}</h2>
      <div class="hero-metrics">
        <span>Rank ${rank(avg)}</span>
        <span>Score ${Math.round(avg)}</span>
        <span>Debt ${state.focusDebt}m</span>
      </div>
    </section>
    <section class="insight-strip">
      <article><span>Weakest</span><strong>${weakName} ${weakValue}</strong></article>
      <article><span>Strongest</span><strong>${bestName} ${bestValue}</strong></article>
      <article><span>Attention</span><strong>${attentionScore()}</strong></article>
    </section>
    <section class="card">
      <h2>Next Best Move</h2>
      <p>${suggestedAction()}</p>
    </section>
    <section class="module-grid">
      ${MODULES.map(moduleCard).join("")}
    </section>
  `;

  const side = `
    <section class="card">
      <h2>Recent Activity</h2>
      <div class="stack tight">${activityList(7)}</div>
    </section>
  `;

  screen.innerHTML = shellGrid(main, side);
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
      <div class="hero-metrics"><span>Score ${Math.round(avg)} / 100</span></div>
    </section>
    <section class="insight-strip">
      <article><span>Best</span><strong>${bestName} ${bestValue}</strong></article>
      <article><span>Needs care</span><strong>${weakName} ${weakValue}</strong></article>
      <article><span>Actions</span><strong>${state.activity.length}</strong></article>
    </section>
    <section class="card">
      <h2>All Stats</h2>
      <div class="stack tight">${STAT_NAMES.map((name) => statBar(name)).join("")}</div>
    </section>
  `, `
    <section class="card">
      <h2>Activity Feed</h2>
      <div class="stack tight">${activityList(12)}</div>
    </section>
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
      <span>DeeCadence</span>
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
      <p>${escapeHtml(active.difficulty)} focus</p>
      <h2>${escapeHtml(active.task)}</h2>
      <div class="timer-num" data-focus-timer>${formatTimer(focusRemainingSeconds())}</div>
      <div class="timer-track"><span data-focus-progress></span></div>
      <div class="hero-metrics">
        <span>${active.minutes}m target</span>
        <span>Started ${new Date(active.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <button class="action danger" type="button" data-complete-focus>Complete Session</button>
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

function renderSettings() {
  setTitle("Settings");
  screen.innerHTML = shellGrid(`
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
      <h2>Data</h2>
      <div class="button-row">
        <button class="action" type="button" data-export>Export JSON</button>
        <button class="action danger" type="button" data-reset>Reset Local Data</button>
      </div>
    </section>
  `, `
    <section class="card">
      <h2>Local First</h2>
      <p>Supabase and auth are intentionally disabled in this pass. Your data is saved in this browser.</p>
    </section>
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
        <span>${session.minutes}m - ${escapeHtml(session.difficulty)} - ${escapeHtml(session.date)}</span>
      </div>
      <b>Mind +3</b>
    </article>
  `).join("");
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
    const effects = { Mind: Math.min(5, Math.max(1, Math.floor(minutes / 10))) };
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
    state.activity.unshift({ id: uid(), module: "DeeCadence", label: `Distraction - ${kind} (${minutes}m debt)`, effects: {}, date: today(), createdAt: nowIso() });
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
}

function completeFocus(mode = "manual") {
  if (!state.activeFocus) return;
  const session = {
    id: uid(),
    task: state.activeFocus.task,
    minutes: state.activeFocus.minutes,
    difficulty: state.activeFocus.difficulty,
    createdAt: nowIso(),
    date: today()
  };
  state.focusSessions.push(session);
  state.focusDebt = Math.max(0, state.focusDebt - session.minutes);
  state.activeFocus = null;
  applyAction({
    module: "DeeCadence",
    type: "complete",
    label: `${mode === "auto" ? "Auto-completed" : "Completed"} focus - ${session.task} (${session.minutes}m)`,
    effects: { Mind: 3 }
  });
}

function startFocusSession(rawTask) {
  const task = String(rawTask || state.ui.focusTaskDraft || "Focus Work").trim().slice(0, 80) || "Focus Work";
  state.activeFocus = {
    task,
    minutes: state.ui.focusDuration,
    difficulty: state.ui.focusDifficulty,
    startedAt: nowIso()
  };
  state.ui.showFocusForm = false;
  state.ui.focusTaskDraft = "";
  applyAction({ module: "DeeCadence", type: "start", label: `Started focus - ${task}`, effects: { Mind: 1 } });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `deecadence-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function resetData() {
  if (!confirm("Reset local DeeCadence data on this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = clone(DEFAULT_STATE);
  saveState();
  setRoute("home");
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
    const effects = { Mind: 2 };
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

  const themeButton = event.target.closest("[data-theme]");
  if (themeButton) {
    state.theme = themeButton.dataset.theme;
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
  const focusTask = event.target.closest("[data-focus-task]");
  if (focusTask) {
    state.ui.focusTaskDraft = focusTask.value;
    saveState();
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

themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveState();
  render();
});

window.addEventListener("hashchange", () => {
  const route = location.hash.slice(1) || "home";
  state.route = route;
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
