const STORAGE_KEY = "deecadence_web_app_v2";
const TICK_MS = 1000;
const BREAK_SECONDS = 300;
const START_PRESETS = [15, 25, 30, 45, 90];
const BLOCK_XP = [45, 60, 75, 95];
const XP_BASE = 90;
const XP_GROWTH = 1.42;
const XP_LEVEL_BONUS = 18;
const TASK_UNIT_TOTAL = 4;

const ROUTE_META = {
  dashboard: {
    title: "Today",
    subtitle: "One block in front. A quiet plan behind it."
  },
  focus: {
    title: "Focus",
    subtitle: "Pick the full session length once. DeeCadence handles the blocks."
  },
  schedule: {
    title: "Plan",
    subtitle: "Turn loose tasks into a minimal focus schedule."
  },
  progress: {
    title: "Progress",
    subtitle: "Understand the rhythm that keeps you coming back."
  },
  levels: {
    title: "Rank",
    subtitle: "XP turns completed blocks into visible growth."
  },
  history: {
    title: "History",
    subtitle: "Review completed sessions and the shape of your consistency."
  },
  settings: {
    title: "Settings",
    subtitle: "Keep the launch build simple, focused, and personal."
  }
};

const BADGES = [
  { id: "streak7", name: "7-Day Streak", note: "Showed up for a full week", tone: "gold", unlockLevel: 7 },
  { id: "blocks", name: "All 4 Blocks", note: "Completed a full session", tone: "violet", unlockLevel: 10 },
  { id: "focusmaster", name: "Focus Master", note: "Sustained deep work", tone: "blue", unlockLevel: 12 },
  { id: "steady", name: "Consistency Improver", note: "Built a reliable rhythm", tone: "green", unlockLevel: 11 },
  { id: "streak30", name: "30-Day Streak", note: "Still locked", tone: "muted", unlockLevel: 18 },
  { id: "hundred", name: "100 Blocks", note: "Still locked", tone: "muted", unlockLevel: 22 }
];

const REWARDS = [
  { id: "theme", name: "Deep Focus Theme", unlockLevel: 15 },
  { id: "shield", name: "Focus Streak Shield", unlockLevel: 18 },
  { id: "sound", name: "Custom Session Sound", unlockLevel: 20 },
  { id: "badge", name: "Legendary Focus Badge", unlockLevel: 25 }
];

const RANK_TIERS = [
  { code: "E", title: "E-Rank", minLevel: 1, note: "Entry cadence" },
  { code: "D", title: "D-Rank", minLevel: 5, note: "Control is forming" },
  { code: "C", title: "C-Rank", minLevel: 15, note: "Reliable blocks under pressure" },
  { code: "B", title: "B-Rank", minLevel: 35, note: "Deep work becomes repeatable" },
  { code: "A", title: "A-Rank", minLevel: 65, note: "High consistency and recovery" },
  { code: "S", title: "S-Rank", minLevel: 100, note: "Elite attention control" },
  { code: "SS", title: "SS-Rank", minLevel: 140, note: "Rare long-term discipline" },
  { code: "SSS", title: "SSS-Rank", minLevel: 185, note: "Exceptional cadence mastery" },
  { code: "L", title: "L-Rank", minLevel: 235, note: "Legendary attention span" }
];

const SAMPLE_SESSIONS = [
  { id: "s1", start: "2026-06-25T08:30:00", durationMinutes: 90, blocksCompleted: 2, totalBlocks: 4, xpEarned: 105, task: "Launch planning", note: "Deep work on launch plan.", status: "complete" },
  { id: "s2", start: "2026-06-26T09:10:00", durationMinutes: 135, blocksCompleted: 3, totalBlocks: 4, xpEarned: 180, task: "Product review", note: "Strong focus in the morning.", status: "complete" },
  { id: "s3", start: "2026-06-27T12:00:00", durationMinutes: 45, blocksCompleted: 1, totalBlocks: 4, xpEarned: 45, task: "Quick sprint", note: "Quick session before meetings.", status: "partial" },
  { id: "s4", start: "2026-06-28T14:00:00", durationMinutes: 60, blocksCompleted: 2, totalBlocks: 4, xpEarned: 105, task: "Planning", note: "Planning and research.", status: "complete" },
  { id: "s5", start: "2026-06-29T07:45:00", durationMinutes: 165, blocksCompleted: 4, totalBlocks: 4, xpEarned: 275, task: "Flow state", note: "Great flow state today.", status: "complete" },
  { id: "s6", start: "2026-06-30T13:30:00", durationMinutes: 75, blocksCompleted: 2, totalBlocks: 4, xpEarned: 105, task: "Afternoon block", note: "Afternoon focus block.", status: "partial" },
  { id: "s7", start: "2026-07-01T10:00:00", durationMinutes: 30, blocksCompleted: 1, totalBlocks: 4, xpEarned: 45, task: "Reset", note: "Short but steady.", status: "partial" },
  { id: "s8", start: "2026-07-01T13:30:00", durationMinutes: 45, blocksCompleted: 1, totalBlocks: 4, xpEarned: 45, task: "Design pass", note: "Worked through distractions.", status: "complete" },
  { id: "s9", start: "2026-07-01T14:30:00", durationMinutes: 45, blocksCompleted: 1, totalBlocks: 4, xpEarned: 45, task: "Review session", note: "Finished a design review block.", status: "complete" }
];

const SAMPLE_TASKS = [
  { id: "task_1", title: "Refine launch story", date: "2026-07-02", time: "09:00", estimateMinutes: 45, priority: "High", notes: "Make the first feeling unmistakably DeeCadence.", completed: false, focusUnitTotal: TASK_UNIT_TOTAL, focusUnitsCompleted: 1 },
  { id: "task_2", title: "Collect tester feedback", date: "2026-07-02", time: "13:30", estimateMinutes: 30, priority: "Medium", notes: "Ask what made them stay or hesitate.", completed: false, focusUnitTotal: TASK_UNIT_TOTAL, focusUnitsCompleted: 0 },
  { id: "task_3", title: "Review mobile flow", date: "2026-07-03", time: "10:00", estimateMinutes: 25, priority: "High", notes: "Check thumb reach, menu comfort, and timer clarity.", completed: false, focusUnitTotal: TASK_UNIT_TOTAL, focusUnitsCompleted: 0 }
];

const DEFAULT_STATE = {
  route: "dashboard",
  theme: localStorage.getItem("deecadence_theme") || "light",
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  profile: {
    name: "Alex",
    email: "alex.chen@email.com"
  },
  focusMode: "Focus Mode",
  ambientSound: "Brown Noise",
  dailyGoalHours: 3,
  totalXp: 3735,
  bestStreak: 28,
  streak: 14,
  sessions: SAMPLE_SESSIONS,
  scheduleTasks: SAMPLE_TASKS,
  currentSession: null,
  lastSessionSummary: null,
  historyQuery: "",
  feedbackMessage: "",
  ui: {
    startModalOpen: false,
    startDraft: {
      task: "Deep work session",
      selectedDuration: 45,
      customMinutes: "",
      linkedTaskId: ""
    },
    scheduleDraft: {
      title: "",
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      estimateMinutes: 45,
      priority: "Medium",
      notes: ""
    },
    selectedScheduleDate: new Date().toISOString().slice(0, 10),
    scheduleView: "day",
    startError: "",
    toast: null
  }
};

const app = document.querySelector("#app");
const screen = document.querySelector("#screen");
const screenTitle = document.querySelector("#screenTitle");
const screenSubtitle = document.querySelector("#screenSubtitle");
const themeToggle = document.querySelector("#themeToggle");
const focusModeSelect = document.querySelector("#focusModeSelect");
const ambientSoundSelect = document.querySelector("#ambientSoundSelect");
const sidebarProfile = document.querySelector("#sidebarProfile");
const feedbackShortcut = document.querySelector("#feedbackShortcut");
const activeFocusPill = document.querySelector("#activeFocusPill");
const sidebarToggle = document.querySelector("#sidebarToggle");
const mobileMenuToggle = document.querySelector("#mobileMenuToggle");
const sidebarScrim = document.querySelector("#sidebarScrim");
const toastLayer = document.querySelector("#toastLayer");
const modalLayer = document.querySelector("#modalLayer");

let state = loadState();
let timerHandle = null;

applyTheme(state.theme);
render();
startTimerLoop();

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("keydown", handleKeydown);
themeToggle.addEventListener("click", toggleTheme);
feedbackShortcut.addEventListener("click", openFeedbackSurvey);
sidebarToggle.addEventListener("click", toggleSidebarCollapse);
mobileMenuToggle.addEventListener("click", toggleMobileMenu);
sidebarScrim.addEventListener("click", closeMobileMenu);
window.addEventListener("resize", handleResize);

function loadState() {
  const saved = safeJson(localStorage.getItem(STORAGE_KEY));
  const next = clone(DEFAULT_STATE);
  if (!saved) return next;
  next.route = ROUTE_META[saved.route] ? saved.route : next.route;
  next.theme = saved.theme === "dark" ? "dark" : "light";
  next.sidebarCollapsed = Boolean(saved.sidebarCollapsed);
  next.profile = { ...next.profile, ...(saved.profile || {}) };
  next.focusMode = typeof saved.focusMode === "string" ? saved.focusMode : next.focusMode;
  next.ambientSound = typeof saved.ambientSound === "string" ? saved.ambientSound : next.ambientSound;
  next.dailyGoalHours = Number.isFinite(Number(saved.dailyGoalHours)) ? Number(saved.dailyGoalHours) : next.dailyGoalHours;
  next.totalXp = Number.isFinite(Number(saved.totalXp)) ? Number(saved.totalXp) : next.totalXp;
  next.bestStreak = Number.isFinite(Number(saved.bestStreak)) ? Number(saved.bestStreak) : next.bestStreak;
  next.streak = Number.isFinite(Number(saved.streak)) ? Number(saved.streak) : next.streak;
  next.sessions = Array.isArray(saved.sessions) && saved.sessions.length ? saved.sessions : next.sessions;
  next.scheduleTasks = Array.isArray(saved.scheduleTasks)
    ? saved.scheduleTasks.map(normalizeScheduleTask).filter(Boolean)
    : next.scheduleTasks;
  next.historyQuery = typeof saved.historyQuery === "string" ? saved.historyQuery : "";
  next.feedbackMessage = typeof saved.feedbackMessage === "string" ? saved.feedbackMessage : "";
  next.lastSessionSummary = saved.lastSessionSummary || null;
  next.ui = {
    ...next.ui,
    ...(saved.ui || {}),
    startDraft: { ...next.ui.startDraft, ...((saved.ui && saved.ui.startDraft) || {}) },
    scheduleDraft: { ...next.ui.scheduleDraft, ...((saved.ui && saved.ui.scheduleDraft) || {}) },
    selectedScheduleDate: normalizeDateKey(saved.ui && saved.ui.selectedScheduleDate) || next.ui.selectedScheduleDate,
    scheduleView: ["day", "week", "pending"].includes(saved.ui && saved.ui.scheduleView) ? saved.ui.scheduleView : next.ui.scheduleView,
    toast: null
  };
  next.currentSession = normalizeSession(saved.currentSession);
  return next;
}

function normalizeScheduleTask(task) {
  if (!task || typeof task.title !== "string") return null;
  const estimate = Number(task.estimateMinutes);
  const unitTotal = Number(task.focusUnitTotal);
  const unitsDone = Number(task.focusUnitsCompleted);
  const focusUnitTotal = Number.isFinite(unitTotal) ? Math.max(1, Math.min(12, Math.round(unitTotal))) : TASK_UNIT_TOTAL;
  const focusUnitsCompleted = Number.isFinite(unitsDone) ? Math.max(0, Math.min(focusUnitTotal, Math.round(unitsDone))) : 0;
  return {
    id: task.id || `task_${Date.now()}`,
    title: task.title.trim() || "Untitled task",
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(task.date || "")) ? task.date : new Date().toISOString().slice(0, 10),
    time: /^\d{2}:\d{2}$/.test(String(task.time || "")) ? task.time : "09:00",
    estimateMinutes: Number.isFinite(estimate) ? Math.max(5, Math.min(240, Math.round(estimate))) : 45,
    priority: ["Low", "Medium", "High"].includes(task.priority) ? task.priority : "Medium",
    notes: typeof task.notes === "string" ? task.notes : "",
    focusUnitTotal,
    focusUnitsCompleted,
    completed: Boolean(task.completed) || focusUnitsCompleted >= focusUnitTotal
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeSession(session) {
  if (!session || !Array.isArray(session.blockDurations) || session.blockDurations.length !== 4) {
    return null;
  }
  return {
    id: session.id || `session_${Date.now()}`,
    task: String(session.task || "Deep work session"),
    totalSeconds: Number(session.totalSeconds) || session.blockDurations.reduce((sum, value) => sum + value, 0),
    blockDurations: session.blockDurations.map((value) => Number(value) || 0),
    currentBlockIndex: Number.isFinite(Number(session.currentBlockIndex)) ? Number(session.currentBlockIndex) : 0,
    completedBlocks: Number.isFinite(Number(session.completedBlocks)) ? Number(session.completedBlocks) : 0,
    status: ["running", "paused", "reward", "break", "awaiting-next"].includes(session.status) ? session.status : "paused",
    blockStartedAt: session.blockStartedAt || null,
    elapsedCurrentBlockSeconds: Number.isFinite(Number(session.elapsedCurrentBlockSeconds)) ? Number(session.elapsedCurrentBlockSeconds) : 0,
    breakStartedAt: session.breakStartedAt || null,
    breakElapsedSeconds: Number.isFinite(Number(session.breakElapsedSeconds)) ? Number(session.breakElapsedSeconds) : 0,
    totalElapsedSeconds: Number.isFinite(Number(session.totalElapsedSeconds)) ? Number(session.totalElapsedSeconds) : 0,
    xpEarned: Number.isFinite(Number(session.xpEarned)) ? Number(session.xpEarned) : 0,
    linkedTaskId: typeof session.linkedTaskId === "string" ? session.linkedTaskId : "",
    rewardUntil: Number.isFinite(Number(session.rewardUntil)) ? Number(session.rewardUntil) : 0,
    lastRewardXp: Number.isFinite(Number(session.lastRewardXp)) ? Number(session.lastRewardXp) : 0,
    lastRewardBlock: Number.isFinite(Number(session.lastRewardBlock)) ? Number(session.lastRewardBlock) : 0,
    lastRewardLevel: Number.isFinite(Number(session.lastRewardLevel)) ? Number(session.lastRewardLevel) : 0,
    lastRewardRank: typeof session.lastRewardRank === "string" ? session.lastRewardRank : "",
    lastRewardLeveledUp: Boolean(session.lastRewardLeveledUp),
    startedAt: session.startedAt || new Date().toISOString()
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function startTimerLoop() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    let shouldRender = false;
    if (state.ui.toast && state.ui.toast.expiresAt <= Date.now()) {
      state.ui.toast = null;
      shouldRender = true;
    }
    const session = state.currentSession;
    if (session) {
      if (session.status === "running") {
        shouldRender = true;
        if (currentBlockRemainingSeconds(session) <= 0) {
          completeCurrentBlock();
          return;
        }
      } else if (session.status === "reward" && session.rewardUntil <= Date.now()) {
        if (session.completedBlocks >= 4) {
          finishWholeSession();
          return;
        }
        session.currentBlockIndex = session.completedBlocks;
        session.elapsedCurrentBlockSeconds = 0;
        session.blockStartedAt = null;
        session.breakStartedAt = new Date().toISOString();
        session.breakElapsedSeconds = 0;
        session.status = "break";
        state.ui.toast = {
          title: "Recovery interval",
          message: "Reset before the next block",
          expiresAt: Date.now() + 2200,
          kind: "info"
        };
        saveState();
        shouldRender = true;
      } else if (session.status === "break") {
        shouldRender = true;
        if (breakRemainingSeconds(session) <= 0) {
          moveBreakToPrompt();
          return;
        }
      }
    }
    if (shouldRender) render();
  }, TICK_MS);
}

function moveBreakToPrompt() {
  const session = state.currentSession;
  if (!session || session.status !== "break") return;
  session.breakElapsedSeconds = BREAK_SECONDS;
  session.breakStartedAt = null;
  session.status = "awaiting-next";
  state.ui.toast = {
    title: "Next block ready",
    message: `Block ${session.currentBlockIndex + 1} waits for your signal`,
    expiresAt: Date.now() + 2400,
    kind: "info"
  };
  saveState();
  render();
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = state.theme;
  app.dataset.theme = state.theme;
  themeToggle.textContent = state.theme === "light" ? "Dark" : "Light";
  localStorage.setItem("deecadence_theme", state.theme);
}

function toggleTheme() {
  applyTheme(state.theme === "light" ? "dark" : "light");
  saveState();
}

function toggleSidebarCollapse() {
  if (isMobileViewport()) {
    toggleMobileMenu();
    return;
  }
  state.sidebarCollapsed = !state.sidebarCollapsed;
  saveState();
  render();
}

function toggleMobileMenu() {
  state.mobileMenuOpen = !state.mobileMenuOpen;
  renderChrome();
  saveState();
}

function closeMobileMenu() {
  if (!state.mobileMenuOpen) return;
  state.mobileMenuOpen = false;
  renderChrome();
  saveState();
}

function handleResize() {
  if (!isMobileViewport() && state.mobileMenuOpen) {
    state.mobileMenuOpen = false;
    saveState();
  }
  renderChrome();
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function handleClick(event) {
  if (event.target.classList.contains("modal-backdrop") && state.ui.startModalOpen) {
    closeModal();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    setRoute(routeButton.dataset.route);
    return;
  }

  if (event.target.closest("[data-open-start-modal]")) {
    openStartModal();
    return;
  }
  if (event.target.closest("[data-close-modal]")) {
    closeModal();
    return;
  }
  if (event.target.closest("[data-select-duration]")) {
    selectDuration(event.target.closest("[data-select-duration]").dataset.selectDuration);
    return;
  }
  if (event.target.closest("[data-confirm-start]")) {
    beginSessionFromDraft();
    return;
  }
  if (event.target.closest("[data-pause-session]")) {
    pauseOrResumeSession();
    return;
  }
  if (event.target.closest("[data-end-session]")) {
    endCurrentSession();
    return;
  }
  if (event.target.closest("[data-continue-block]")) {
    continueToNextBlock();
    return;
  }
  if (event.target.closest("[data-skip-break]")) {
    moveBreakToPrompt();
    return;
  }
  if (event.target.closest("[data-add-schedule-task]")) {
    addScheduleTask();
    return;
  }
  if (event.target.closest("[data-auto-arrange-schedule]")) {
    autoArrangeSchedule();
    return;
  }
  const scheduleViewButton = event.target.closest("[data-schedule-view]");
  if (scheduleViewButton) {
    setScheduleView(scheduleViewButton.dataset.scheduleView);
    return;
  }
  const scheduleDateButton = event.target.closest("[data-schedule-date-select]");
  if (scheduleDateButton) {
    setSelectedScheduleDate(scheduleDateButton.dataset.scheduleDateSelect);
    return;
  }
  const scheduleShiftButton = event.target.closest("[data-shift-schedule-date]");
  if (scheduleShiftButton) {
    shiftSelectedScheduleDate(Number(scheduleShiftButton.dataset.shiftScheduleDate));
    return;
  }
  if (event.target.closest("[data-use-selected-date]")) {
    state.ui.scheduleDraft.date = state.ui.selectedScheduleDate;
    saveState();
    render();
    return;
  }
  const scheduleStartButton = event.target.closest("[data-start-scheduled-task]");
  if (scheduleStartButton) {
    startScheduledTask(scheduleStartButton.dataset.startScheduledTask);
    return;
  }
  const scheduleToggleButton = event.target.closest("[data-toggle-scheduled-task]");
  if (scheduleToggleButton) {
    toggleScheduleTask(scheduleToggleButton.dataset.toggleScheduledTask);
    return;
  }
  const scheduleDeleteButton = event.target.closest("[data-delete-scheduled-task]");
  if (scheduleDeleteButton) {
    deleteScheduleTask(scheduleDeleteButton.dataset.deleteScheduledTask);
    return;
  }
  if (event.target.closest("[data-close-summary]")) {
    state.lastSessionSummary = null;
    saveState();
    render();
    return;
  }
  if (event.target.closest("[data-export-history]")) {
    exportHistory();
    return;
  }
  if (event.target.closest("[data-open-feedback]")) {
    openFeedbackSurvey();
    return;
  }
}

function handleKeydown(event) {
  if (event.key !== "Escape") return;
  if (state.ui.startModalOpen) {
    closeModal();
    return;
  }
  if (state.mobileMenuOpen) {
    closeMobileMenu();
  }
}

function handleInput(event) {
  if (event.target.matches("[data-history-search]")) {
    state.historyQuery = event.target.value;
    saveState();
    render();
    return;
  }
  if (event.target.matches("[data-profile-name]")) {
    state.profile.name = event.target.value || "Alex";
    saveState();
    render();
    return;
  }
  if (event.target.matches("[data-profile-email]")) {
    state.profile.email = event.target.value;
    saveState();
    renderChrome();
    return;
  }
  if (event.target.matches("[data-goal-hours]")) {
    const nextValue = Number(event.target.value);
    if (Number.isFinite(nextValue) && nextValue >= 1) {
      state.dailyGoalHours = nextValue;
      saveState();
      render();
    }
    return;
  }
  if (event.target.matches("[data-feedback-message]")) {
    state.feedbackMessage = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-start-task]")) {
    state.ui.startDraft.task = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-custom-duration]")) {
    state.ui.startDraft.customMinutes = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-schedule-title]")) {
    state.ui.scheduleDraft.title = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-schedule-date]")) {
    state.ui.scheduleDraft.date = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-schedule-time]")) {
    state.ui.scheduleDraft.time = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-schedule-estimate]")) {
    state.ui.scheduleDraft.estimateMinutes = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-schedule-notes]")) {
    state.ui.scheduleDraft.notes = event.target.value;
    saveState();
  }
}

function handleChange(event) {
  if (event.target === focusModeSelect) {
    state.focusMode = event.target.value;
    saveState();
    render();
    return;
  }
  if (event.target === ambientSoundSelect) {
    state.ambientSound = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-schedule-priority]")) {
    state.ui.scheduleDraft.priority = event.target.value;
    saveState();
    return;
  }
  if (event.target.matches("[data-setting-focus-mode]")) {
    state.focusMode = event.target.value;
    saveState();
    render();
    return;
  }
  if (event.target.matches("[data-setting-ambient-sound]")) {
    state.ambientSound = event.target.value;
    saveState();
    render();
  }
}

function setRoute(route) {
  if (!ROUTE_META[route]) return;
  state.route = route;
  state.mobileMenuOpen = false;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  renderChrome();
  renderScreen();
  renderModal();
  renderToast();
}

function renderChrome() {
  const meta = ROUTE_META[state.route];
  screenTitle.textContent = meta.title;
  screenSubtitle.textContent = meta.subtitle;
  focusModeSelect.value = state.focusMode;
  ambientSoundSelect.value = state.ambientSound;
  app.classList.toggle("is-collapsed", state.sidebarCollapsed && !isMobileViewport());
  app.classList.toggle("is-mobile-menu-open", state.mobileMenuOpen && isMobileViewport());
  app.dataset.sessionStatus = state.currentSession ? state.currentSession.status : "idle";
  sidebarScrim.hidden = !(state.mobileMenuOpen && isMobileViewport());
  sidebarToggle.textContent = state.sidebarCollapsed && !isMobileViewport() ? "Expand" : "Collapse";
  sidebarToggle.setAttribute("aria-expanded", String(!(state.sidebarCollapsed && !isMobileViewport())));
  sidebarToggle.setAttribute("aria-label", state.sidebarCollapsed && !isMobileViewport() ? "Expand sidebar" : "Collapse sidebar");
  mobileMenuToggle.setAttribute("aria-expanded", String(state.mobileMenuOpen && isMobileViewport()));
  mobileMenuToggle.setAttribute("aria-label", state.mobileMenuOpen && isMobileViewport() ? "Close menu" : "Open menu");
  sidebarProfile.innerHTML = `
    <div class="profile-avatar">${escapeHtml((state.profile.name || "A").slice(0, 1).toUpperCase())}</div>
    <div>
      <strong>${escapeHtml(state.profile.name)}</strong>
      <span>${escapeHtml(state.profile.email)}</span>
    </div>
  `;
  document.querySelectorAll("[data-route]").forEach((button) => {
    const isActive = button.dataset.route === state.route;
    button.classList.toggle("active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  renderActivePill();
}

function renderActivePill() {
  const session = state.currentSession;
  if (!session) {
    activeFocusPill.hidden = true;
    return;
  }
  const label = session.status === "awaiting-next"
    ? `Ready for Block ${session.currentBlockIndex + 1}`
    : session.status === "break"
      ? `Recovery before Block ${session.currentBlockIndex + 1}`
    : session.status === "paused"
      ? `Paused on Block ${session.currentBlockIndex + 1}`
      : `Block ${Math.min(4, session.currentBlockIndex + 1)} in progress`;
  activeFocusPill.hidden = false;
  activeFocusPill.querySelector("span").textContent = label;
  activeFocusPill.querySelector("[data-focus-pill-timer]").textContent = session.status === "break"
    ? formatClock(breakRemainingSeconds(session))
    : formatClock(currentBlockRemainingSeconds(session));
}

function renderScreen() {
  if (state.route === "focus") {
    screen.innerHTML = renderFocusRoute();
    return;
  }
  if (state.route === "schedule") {
    screen.innerHTML = renderScheduleRoute();
    return;
  }
  if (state.route === "progress") {
    screen.innerHTML = renderProgressRoute();
    return;
  }
  if (state.route === "levels") {
    screen.innerHTML = renderLevelsRoute();
    return;
  }
  if (state.route === "history") {
    screen.innerHTML = renderHistoryRoute();
    return;
  }
  if (state.route === "settings") {
    screen.innerHTML = renderSettingsRoute();
    return;
  }
  screen.innerHTML = renderDashboardRoute();
}

function renderDashboardRoute() {
  const today = todaySummary();
  const progress = progressWindow(7);
  const recent = recentSessions(4);
  const selectedDate = state.ui.selectedScheduleDate || todayKey();
  const nextTasks = scheduledTasksSorted().filter((task) => !task.completed).slice(0, 4);
  const rank = currentRank();
  const nextRank = upcomingRank();
  const goalPercent = Math.min(100, Math.round((today.focusHours / state.dailyGoalHours) * 100));
  return `
    <section class="dashboard-grid">
      <section class="hero-panel cadence-command card-panel">
        <div class="hero-copy command-copy">
          <span class="eyebrow">Attention recovery system</span>
          <h2>One block in front. XP for showing up. A plan that stays quiet.</h2>
          <p>DeeCadence turns your day into four visible focus beats: start the next block, earn XP when it closes, and let the schedule keep the rest in order.</p>
          <div class="hero-actions">
            <button class="primary-button" type="button" data-open-start-modal>${state.currentSession ? "Return to current block" : "Start next block"}</button>
            <button class="secondary-button" type="button" data-auto-arrange-schedule>Arrange today's plan</button>
          </div>
        </div>
        <div class="rank-console" aria-label="Current rank and XP">
          <div class="rank-orb">
            <span>${escapeHtml(rank.code)}</span>
          </div>
          <div>
            <span class="eyebrow">Current rank</span>
            <h3>${escapeHtml(rank.title)} / Level ${currentLevel()}</h3>
            <p>${escapeHtml(rank.note)}. ${nextRank ? `${nextRank.title} opens at Level ${nextRank.minLevel}.` : "You are at the top visible rank."}</p>
          </div>
          <div class="rank-meter">
            <div class="progress-bar"><i style="width:${levelProgress()}%"></i></div>
            <span>${formatNumber(state.totalXp)} XP total - ${xpToNextLevel()} XP to next level</span>
          </div>
        </div>
      </section>

      <section class="card-panel next-block-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Next block</span>
            <h3>${nextTasks[0] ? escapeHtml(nextTasks[0].title) : "Ready when you are"}</h3>
          </div>
          <span class="badge-tag">${nextTasks[0] ? `${formatMinutes(nextTasks[0].estimateMinutes)} focus` : "Open"}</span>
        </div>
        <div class="block-ritual">
          ${renderGoalBlocks(today.completedBlocks)}
        </div>
        <p class="support-copy">${today.completedBlocks} of 4 focus beats completed today. Close one more block to bank XP and protect the streak.</p>
      </section>

      <section class="card-panel minimal-plan-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Minimal plan</span>
            <h3>${formatDate(selectedDate)}</h3>
          </div>
          <button class="text-button" type="button" data-route="schedule">Open plan</button>
        </div>
        <div class="cadence-strip dashboard-cadence" aria-label="Next scheduled tasks">
          ${renderScheduleCadence(nextTasks)}
        </div>
      </section>

      <section class="goal-panel card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Today's focus goal</span>
            <h3>${formatHours(state.dailyGoalHours)} target</h3>
          </div>
          <button class="text-button" type="button" data-route="settings">Edit goal</button>
        </div>
        <div class="goal-track">
          ${renderGoalBlocks(today.completedBlocks)}
        </div>
        <div class="progress-meta">
          <span>${today.completedBlocks} of 4 blocks completed</span>
          <span>${formatHours(today.focusHours)} / ${formatHours(state.dailyGoalHours)}</span>
        </div>
        <div class="progress-bar"><i style="width:${goalPercent}%"></i></div>
      </section>

      <section class="chart-panel card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">XP trend</span>
            <h3>Proof that focus is compounding</h3>
          </div>
          <span class="badge-tag">7 days</span>
        </div>
        ${renderLineChart(progress.points)}
        <div class="chart-summary">
          <strong>Weekly average: ${formatHours(progress.averageHours)}</strong>
          <span class="positive">+${progress.delta}% vs previous rhythm</span>
        </div>
      </section>

      <section class="insight-panel card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Daily objectives</span>
            <h3>Small wins that move your rank</h3>
          </div>
        </div>
        <div class="insight-grid">
          ${renderInsightTile("Close one block", `Earn +${BLOCK_XP[0]} XP and clear the next task`)}
          ${renderInsightTile("Finish all four", "Bank a full-session reward without rushing")}
          ${renderInsightTile("Arrange the day", "Let open tasks fall into a simple focus order")}
        </div>
      </section>

      <section class="sessions-panel card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Recent sessions</span>
            <h3>What you did lately</h3>
          </div>
          <button class="text-button" type="button" data-route="history">View all</button>
        </div>
        <div class="session-list concise">
          ${recent.map(renderRecentSessionCard).join("")}
        </div>
      </section>

      ${state.lastSessionSummary ? renderCompletionBanner(state.lastSessionSummary) : ""}
    </section>
  `;
}

function renderFocusRoute() {
  const session = state.currentSession;
  if (!session) {
    return `
      <section class="focus-empty-grid">
        <section class="card-panel start-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">How it works</span>
              <h2>Choose the full session once.</h2>
            </div>
          </div>
          <p class="lead-copy">DeeCadence takes the total time you pick, divides it into four equal focus blocks, and only shows the countdown for the current block so the work feels lighter and easier to return to.</p>
          <div class="preset-row">
            ${START_PRESETS.map((minutes) => `<span class="preset-chip">${minutes}m session</span>`).join("")}
            <span class="preset-chip">Custom</span>
          </div>
          <button class="primary-button large" type="button" data-open-start-modal>Pick a session length</button>
        </section>

        <aside class="card-panel overview-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">What keeps it calm</span>
              <h3>Launch principles</h3>
            </div>
          </div>
          <div class="bullet-list">
            <article><strong>One clear primary action</strong><span>Start a session without hunting around the page.</span></article>
            <article><strong>Only the current block counts down</strong><span>No overwhelming 90-minute wall on the screen.</span></article>
            <article><strong>Visible reward before the next step</strong><span>XP is celebrated first, then the next block waits for you.</span></article>
          </div>
        </aside>
      </section>
    `;
  }

  const currentBlock = session.currentBlockIndex + 1;
  const totalBlocks = 4;
  const currentDuration = session.blockDurations[session.currentBlockIndex] || session.blockDurations[3];
  const isBreak = session.status === "break";
  const isReward = session.status === "reward";
  const blockRemaining = currentBlockRemainingSeconds(session);
  const blockElapsed = currentBlockElapsedSeconds(session);
  const rewardRemaining = Math.max(0, Math.ceil((Number(session.rewardUntil || 0) - Date.now()) / 1000));
  const displayRemaining = isReward ? rewardRemaining : isBreak ? breakRemainingSeconds(session) : blockRemaining;
  const displayDuration = isReward ? 3 : isBreak ? BREAK_SECONDS : currentDuration;
  const displayElapsed = isBreak ? breakElapsedSeconds(session) : blockElapsed;
  const overallPercent = Math.round((session.completedBlocks / totalBlocks) * 100);
  const blockPercent = Math.round((displayElapsed / Math.max(1, displayDuration)) * 100);
  const nextBlock = Math.min(4, session.currentBlockIndex + 1);
  const pauseLabel = session.status === "paused" ? "Resume this block" : "Pause session";
  const linkedTask = linkedTaskForSession(session);
  return `
    <section class="focus-route-grid">
      <section class="card-panel timer-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Current session</span>
            <h2>${escapeHtml(session.task)}</h2>
            <p class="support-copy">${formatMinutes(session.totalSeconds / 60)} total session split into 4 equal blocks</p>
          </div>
          <span class="badge-tag">${isReward ? "Reward" : isBreak ? "Recovery" : `Block ${currentBlock} of ${totalBlocks}`}</span>
        </div>

        <div class="focus-core-grid">
          <div class="timer-column">
            ${renderTimerDial(displayRemaining, displayDuration, currentBlock, isReward ? "XP Reward" : isBreak ? "Recovery" : `Block ${currentBlock}`)}
            <div class="timer-callout">
              <strong>${formatClock(displayRemaining)}</strong>
              <span>${isReward ? "reward visible" : isBreak ? "left to reset" : "left in this block"}</span>
            </div>
          </div>

          <div class="focus-side-column">
            <div class="session-block-list">
              ${renderBlockCards(session)}
            </div>
            <div class="card-subpanel">
              <div class="subpanel-row">
                <span>Session progress</span>
                <strong>${overallPercent}% complete</strong>
              </div>
              <div class="progress-bar"><i style="width:${overallPercent}%"></i></div>
              <div class="subpanel-grid">
                <article><span>Total chosen</span><strong>${formatMinutes(session.totalSeconds / 60)}</strong></article>
                <article><span>XP earned</span><strong>+${session.xpEarned}</strong></article>
                <article><span>${isBreak ? "Recovery length" : "Current block"}</span><strong>${isBreak ? formatClock(BREAK_SECONDS) : formatMinutes(currentDuration / 60)}</strong></article>
                <article><span>Mode</span><strong>${escapeHtml(state.focusMode)}</strong></article>
              </div>
            </div>
          </div>
        </div>

        <div class="focus-actions">
          ${session.status === "reward" ? `<button class="primary-button" type="button" disabled>Rewarding...</button>` : session.status === "break" ? `<button class="primary-button" type="button" data-skip-break>Review next block</button>` : `<button class="primary-button" type="button" data-pause-session>${pauseLabel}</button>`}
          <button class="secondary-button danger" type="button" data-end-session>End session</button>
        </div>

        ${session.status === "reward" ? renderSystemRewardReveal(session, linkedTask) : ""}

        ${session.status === "break" ? `
          <section class="inline-prompt break-prompt">
            <div>
              <span class="eyebrow">Recovery interval</span>
              <h3>Banked +${session.lastRewardXp} XP. Reset before Block ${nextBlock}.</h3>
              <p>Stretch, breathe, or clear your desk. When recovery ends, DeeCadence will ask before starting the next block.</p>
            </div>
            <div class="prompt-actions">
              <button class="primary-button" type="button" data-skip-break>Skip to next prompt</button>
              <button class="secondary-button" type="button" data-end-session>Stop here</button>
            </div>
          </section>
        ` : ""}

        ${session.status === "awaiting-next" ? `
          <section class="inline-prompt">
            <div>
              <span class="eyebrow">Next step</span>
              <h3>Block ${session.completedBlocks} is done.</h3>
              <p>Start Block ${nextBlock} when you are ready. DeeCadence will wait for you.</p>
            </div>
            <div class="prompt-actions">
              <button class="primary-button" type="button" data-continue-block>Start Block ${nextBlock}</button>
              <button class="secondary-button" type="button" data-end-session>Stop here</button>
            </div>
          </section>
        ` : ""}
      </section>

      <aside class="focus-side-stack">
        <section class="card-panel stat-stack">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Overview</span>
              <h3>Today's focus</h3>
            </div>
          </div>
          <div class="metric-list">
            <article><span>Current streak</span><strong>${state.streak} days</strong></article>
            <article><span>Total XP</span><strong>${formatNumber(state.totalXp)}</strong></article>
            <article><span>Current block progress</span><strong>${Math.max(0, Math.min(100, blockPercent))}%</strong></article>
            <article><span>Ambient sound</span><strong>${escapeHtml(state.ambientSound)}</strong></article>
          </div>
        </section>

        ${linkedTask ? `
          <section class="card-panel task-link-panel">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Task achievement</span>
                <h3>${escapeHtml(linkedTask.title)}</h3>
              </div>
            </div>
            ${renderTaskUnitRail(linkedTask)}
            <p class="support-copy">Each completed focus block fills one unit. Finish all units to close the task.</p>
          </section>
        ` : ""}

        <section class="card-panel stat-stack">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Session stats</span>
              <h3>Right now</h3>
            </div>
          </div>
          <div class="metric-list">
            <article><span>Time elapsed</span><strong>${formatClock(session.totalElapsedSeconds + (isBreak ? 0 : blockElapsed))}</strong></article>
            <article><span>Blocks completed</span><strong>${session.completedBlocks} / 4</strong></article>
            <article><span>Next reward</span><strong>+${BLOCK_XP[Math.min(3, session.currentBlockIndex)]} XP</strong></article>
            <article><span>Status</span><strong>${formatSessionStatus(session.status)}</strong></article>
          </div>
        </section>

        <section class="card-panel tip-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Keep it smooth</span>
              <h3>Quick reminder</h3>
            </div>
          </div>
          <p class="support-copy">Your timer stays focused on the block in front of you, so the next step is always clear.</p>
        </section>
      </aside>
    </section>
  `;
}

function renderScheduleRoute() {
  const tasks = scheduledTasksSorted();
  const selectedDate = state.ui.selectedScheduleDate || todayKey();
  const selectedTasks = tasksForDate(selectedDate);
  const pending = pendingScheduleTasks(selectedDate);
  const week = scheduleWeek(selectedDate);
  const weekTasks = tasks.filter((task) => week.some((day) => day.key === task.date));
  const visibleTasks = state.ui.scheduleView === "pending"
    ? pending
    : state.ui.scheduleView === "week"
      ? weekTasks
      : selectedTasks;
  const completedVisible = visibleTasks.filter((task) => task.completed).length;
  const totalMinutes = visibleTasks.reduce((sum, task) => sum + (task.completed ? 0 : task.estimateMinutes), 0);
  return `
    <section class="schedule-route-grid">
      <section class="card-panel schedule-hero-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Daily plan</span>
            <h2>${formatDate(selectedDate)}</h2>
            <p class="support-copy">Add loose tasks, then let DeeCadence place the open ones into a calm focus order.</p>
          </div>
          <span class="badge-tag">${pending.length} pending</span>
        </div>
        <div class="schedule-command-row">
          <div class="date-nav">
            <button class="icon-button" type="button" data-shift-schedule-date="-1" aria-label="Previous day">Prev</button>
            <button class="secondary-button" type="button" data-schedule-date-select="${todayKey()}">Today</button>
            <button class="icon-button" type="button" data-shift-schedule-date="1" aria-label="Next day">Next</button>
          </div>
          <div class="segmented-control" role="group" aria-label="Schedule view">
            ${["day", "week", "pending"].map((view) => `
              <button class="${state.ui.scheduleView === view ? "active" : ""}" type="button" data-schedule-view="${view}">
                ${capitalize(view)}
              </button>
            `).join("")}
          </div>
          <button class="primary-button schedule-auto-button" type="button" data-auto-arrange-schedule>Auto arrange</button>
        </div>
        <div class="schedule-date-strip" aria-label="Week dates">
          ${week.map(renderScheduleDateButton).join("")}
        </div>
        <div class="schedule-metrics-row">
          <article><span>Visible tasks</span><strong>${visibleTasks.length}</strong></article>
          <article><span>Done</span><strong>${completedVisible}</strong></article>
          <article><span>Open focus</span><strong>${formatMinutes(totalMinutes)}</strong></article>
          <article><span>Selected view</span><strong>${capitalize(state.ui.scheduleView)}</strong></article>
        </div>
      </section>

      <section class="card-panel schedule-form-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Quick add</span>
            <h2>Add a task</h2>
          </div>
          <button class="text-button" type="button" data-use-selected-date>Use selected date</button>
        </div>
        <div class="schedule-form-grid">
          <label class="field-shell schedule-title-field">
            <span>Task</span>
            <input class="text-input" type="text" value="${escapeHtml(state.ui.scheduleDraft.title)}" placeholder="e.g. Draft homepage story" data-schedule-title>
          </label>
          <label class="field-shell">
            <span>Date</span>
            <input class="text-input" type="date" value="${escapeHtml(state.ui.scheduleDraft.date)}" data-schedule-date>
          </label>
          <label class="field-shell">
            <span>Time</span>
            <input class="text-input" type="time" value="${escapeHtml(state.ui.scheduleDraft.time)}" data-schedule-time>
          </label>
          <label class="field-shell">
            <span>Estimate</span>
            <select class="text-input" data-schedule-estimate>
              ${[15, 25, 30, 45, 60, 90].map((minutes) => `<option value="${minutes}" ${Number(state.ui.scheduleDraft.estimateMinutes) === minutes ? "selected" : ""}>${minutes} minutes</option>`).join("")}
            </select>
          </label>
          <label class="field-shell">
            <span>Priority</span>
            <select class="text-input" data-schedule-priority>
              ${["Low", "Medium", "High"].map((priority) => `<option value="${priority}" ${state.ui.scheduleDraft.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}
            </select>
          </label>
          <label class="field-shell schedule-notes-field">
            <span>Notes</span>
            <textarea class="text-input textarea compact" placeholder="What would make this block successful?" data-schedule-notes>${escapeHtml(state.ui.scheduleDraft.notes)}</textarea>
          </label>
        </div>
        <button class="primary-button" type="button" data-add-schedule-task>Add to schedule</button>
      </section>

      <section class="card-panel schedule-list-panel planner-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">${capitalize(state.ui.scheduleView)} view</span>
            <h2>${state.ui.scheduleView === "pending" ? "Pending tasks" : "Time-block planner"}</h2>
          </div>
          <button class="secondary-button" type="button" data-open-start-modal>${state.currentSession ? "Return to session" : "Start without task"}</button>
        </div>
        ${state.ui.scheduleView === "week"
          ? renderWeekPlanner(week)
          : state.ui.scheduleView === "pending"
            ? renderPendingPlanner(pending)
            : renderDayTimeline(selectedDate, selectedTasks)}
      </section>

      <aside class="schedule-side-stack">
        <section class="card-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Cadence beats</span>
              <h3>Next four focus targets</h3>
            </div>
          </div>
          <div class="cadence-strip vertical" aria-label="Next scheduled cadence">
            ${renderScheduleCadence(tasks.filter((task) => !task.completed))}
          </div>
        </section>
        <section class="card-panel schedule-principle-card">
          <span class="eyebrow">Quiet automation</span>
          <h3>Loose tasks become focus blocks.</h3>
          <p class="support-copy">Auto arrange keeps the plan minimal: priority first, one task per slot, and a direct path into focus.</p>
        </section>
      </aside>
    </section>
  `;
}

function renderProgressRoute() {
  const progress = progressWindow(7);
  const completionRate = Math.round((progress.totalCompletedBlocks / Math.max(1, progress.totalBlocks)) * 100);
  return `
    <section class="progress-route-grid">
      <section class="card-panel large-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">7-day trend</span>
            <h2>Momentum that feels calm, not noisy</h2>
          </div>
          <span class="badge-tag">Daily rhythm</span>
        </div>
        ${renderLineChart(progress.points)}
        <div class="chart-summary two-col">
          <article><span>Average session</span><strong>${progress.averageSessionLabel}</strong></article>
          <article><span>Completion rate</span><strong>${completionRate}%</strong></article>
          <article><span>Best day</span><strong>${progress.bestDay.label}</strong></article>
          <article><span>Week XP</span><strong>+${formatNumber(progress.weekXp)}</strong></article>
        </div>
      </section>

      <aside class="insight-stack">
        ${renderInsightBox("Best Day", progress.bestDay.label, `${formatHours(progress.bestDay.hours)} total focus`, "purple")}
        ${renderInsightBox("Average Session", progress.averageSessionLabel, "Long enough to feel meaningful", "blue")}
        ${renderInsightBox("Completion Rate", `${completionRate}%`, `${progress.totalCompletedBlocks} of ${progress.totalBlocks} blocks`, "green")}
        ${renderInsightBox("Week XP", `${formatNumber(progress.weekXp)} XP`, "Progress is compounding", "orange")}
      </aside>

      <section class="card-panel large-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Focus rhythm</span>
            <h3>Keep your progress easy to read</h3>
          </div>
        </div>
        <div class="pattern-grid">
          <article><strong>Calm space</strong><span>Every screen gives your next action enough room to stand out.</span></article>
          <article><strong>One clear move</strong><span>The next focus action should be obvious without searching.</span></article>
          <article><strong>Readable progress</strong><span>Your stats stay visible without making the screen feel crowded.</span></article>
        </div>
      </section>
    </section>
  `;
}

function renderLevelsRoute() {
  const rank = currentRank();
  const nextRank = upcomingRank();
  const nextRankXp = nextRank ? Math.max(0, xpToReachLevel(nextRank.minLevel) - state.totalXp) : 0;
  return `
    <section class="levels-route-grid">
      <section class="card-panel level-hero rank-hero-card">
        <div class="level-badge rank-badge">${escapeHtml(rank.code)}</div>
        <div>
          <span class="eyebrow">Current rank</span>
          <h2>${escapeHtml(rank.title)} / Level ${currentLevel()}</h2>
          <p class="support-copy">${escapeHtml(rank.note)}${nextRank ? ` - ${nextRank.title} begins at Level ${nextRank.minLevel}, with ${formatNumber(nextRankXp)} XP left.` : " - top visible rank reached."}</p>
          <div class="progress-bar"><i style="width:${levelProgress()}%"></i></div>
          <div class="progress-meta">
            <span>${formatNumber(state.totalXp)} XP total</span>
            <span>${xpToNextLevel()} XP to next level</span>
          </div>
        </div>
      </section>

      <section class="mini-stat-grid">
        <article class="card-panel"><span>Total XP</span><strong>${formatNumber(state.totalXp)}</strong></article>
        <article class="card-panel"><span>Blocks Completed</span><strong>${totalBlocksCompleted()}</strong></article>
        <article class="card-panel"><span>Next Level Cost</span><strong>${formatNumber(xpNeededForLevel(currentLevel()))}</strong></article>
        <article class="card-panel"><span>Next Rank</span><strong>${nextRank ? nextRank.code : "MAX"}</strong></article>
      </section>

      <section class="card-panel large-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Rank path</span>
            <h3>Every block moves the climb</h3>
          </div>
        </div>
        <div class="rank-path-grid">
          ${RANK_TIERS.map(renderRankTier).join("")}
        </div>
      </section>

      <section class="card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Milestones</span>
            <h3>Your current path</h3>
          </div>
        </div>
        <div class="milestone-list">
          ${renderLevelMilestones()}
        </div>
      </section>

      <section class="card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Earned badges</span>
            <h3>Visible proof of consistency</h3>
          </div>
        </div>
        <div class="badge-grid spacious">
          ${BADGES.map(renderBadge).join("")}
        </div>
      </section>
    </section>
  `;
}

function renderHistoryRoute() {
  const sessions = filteredSessions();
  return `
    <section class="history-route-grid">
      <section class="card-panel large-panel">
        <div class="section-heading split-wrap">
          <div>
            <span class="eyebrow">Session history</span>
            <h2>Clear records, not cramped tables</h2>
          </div>
          <div class="toolbar-row">
            <label class="search-shell">
              <input type="search" value="${escapeHtml(state.historyQuery)}" placeholder="Search sessions, notes, or tasks..." data-history-search>
            </label>
            <button class="secondary-button" type="button" data-export-history>Export history</button>
          </div>
        </div>
        <div class="history-card-list">
          ${sessions.map(renderHistoryCard).join("")}
        </div>
      </section>

      <aside class="insight-stack">
        ${renderInsightBox("Best Day", progressWindow(7).bestDay.label, `${formatHours(progressWindow(7).bestDay.hours)} total focus`, "purple")}
        ${renderInsightBox("Average Session", progressWindow(7).averageSessionLabel, "Helps you estimate a realistic block", "blue")}
        ${renderInsightBox("Completion Rate", `${Math.round((progressWindow(7).totalCompletedBlocks / Math.max(1, progressWindow(7).totalBlocks)) * 100)}%`, "Shows how often you close blocks", "green")}
      </aside>
    </section>
  `;
}

function renderSettingsRoute() {
  return `
    <section class="settings-route-grid">
      <section class="card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Profile</span>
            <h2>Keep it personal and simple</h2>
          </div>
        </div>
        <label class="field-shell">
          <span>Name</span>
          <input class="text-input" type="text" value="${escapeHtml(state.profile.name)}" data-profile-name>
        </label>
        <label class="field-shell">
          <span>Email</span>
          <input class="text-input" type="email" value="${escapeHtml(state.profile.email)}" data-profile-email>
        </label>
      </section>

      <section class="card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Session defaults</span>
            <h2>Keep the start flow lightweight</h2>
          </div>
        </div>
        <label class="field-shell">
          <span>Daily goal hours</span>
          <input class="text-input" type="number" min="1" max="8" value="${escapeHtml(String(state.dailyGoalHours))}" data-goal-hours>
        </label>
        <div class="simple-chip-row">
          ${START_PRESETS.map((minutes) => `<span class="preset-chip subdued">${minutes}m preset</span>`).join("")}
          <span class="preset-chip subdued">Custom</span>
        </div>
      </section>

      <section class="card-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Focus feel</span>
            <h2>Keep mobile controls predictable</h2>
          </div>
        </div>
        <div class="settings-control-grid">
          <label class="field-shell">
            <span>Ambient sound</span>
            <select class="text-input" data-setting-ambient-sound>
              ${["Rain", "Brown Noise", "Ocean", "Lo-fi Room"].map((sound) => `<option value="${sound}" ${state.ambientSound === sound ? "selected" : ""}>${sound}</option>`).join("")}
            </select>
          </label>
          <label class="field-shell">
            <span>Mode</span>
            <select class="text-input" data-setting-focus-mode>
              ${["Focus Mode", "Deep Work", "Study Sprint", "Gentle Pace"].map((mode) => `<option value="${mode}" ${state.focusMode === mode ? "selected" : ""}>${mode}</option>`).join("")}
            </select>
          </label>
        </div>
      </section>

      <section class="card-panel wide-card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Feedback</span>
            <h2>Keep the loop honest</h2>
          </div>
        </div>
        <label class="field-shell">
          <span>What would make you come back each week?</span>
          <textarea class="text-input textarea" data-feedback-message placeholder="What helped? What felt frictionless? What still feels messy?">${escapeHtml(state.feedbackMessage)}</textarea>
        </label>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-open-feedback>Open survey</button>
          <button class="secondary-button" type="button" data-export-history>Export local history</button>
        </div>
      </section>
    </section>
  `;
}

function renderCompletionBanner(summary) {
  return `
    <section class="completion-banner card-panel">
      <div>
        <span class="eyebrow">Latest session complete</span>
        <h3>${escapeHtml(summary.task)}</h3>
        <p class="support-copy">${summary.blocksCompleted} of 4 blocks completed - ${summary.durationMinutes} minutes - +${summary.xpEarned} XP</p>
      </div>
      <button class="secondary-button" type="button" data-close-summary>Dismiss</button>
    </section>
  `;
}

function renderGoalBlocks(completedBlocks) {
  return Array.from({ length: 4 }, (_, index) => {
    const block = index + 1;
    const status = completedBlocks >= block ? "done" : completedBlocks + 1 === block ? "next" : "";
    return `
      <article class="goal-block ${status}">
        <strong>${completedBlocks >= block ? "Done" : `Block ${block}`}</strong>
      </article>
    `;
  }).join("");
}

function renderScheduleCadence(tasks) {
  const slots = tasks.slice(0, 4);
  return Array.from({ length: 4 }, (_, index) => {
    const task = slots[index];
    if (!task) {
      return `
        <article class="cadence-slot empty">
          <span>Beat ${index + 1}</span>
          <strong>Open</strong>
        </article>
      `;
    }
    return `
      <article class="cadence-slot ${task.completed ? "done" : ""}">
        <span>${escapeHtml(task.time)}</span>
        <strong>${escapeHtml(task.title)}</strong>
      </article>
    `;
  }).join("");
}

function renderScheduleDateButton(day) {
  const isSelected = day.key === state.ui.selectedScheduleDate;
  const count = tasksForDate(day.key).filter((task) => !task.completed).length;
  return `
    <button class="date-chip ${isSelected ? "active" : ""} ${day.key === todayKey() ? "today" : ""}" type="button" data-schedule-date-select="${day.key}">
      <span>${escapeHtml(day.weekday)}</span>
      <strong>${escapeHtml(day.day)}</strong>
      <small>${count ? `${count} task${count === 1 ? "" : "s"}` : "Open"}</small>
    </button>
  `;
}

function renderDayTimeline(dateKey, tasks) {
  if (!tasks.length) {
    return renderEmptySchedule("No tasks on this day.", "Use quick add to place a task on the timeline, or start an unscheduled focus block.");
  }
  return `
    <div class="day-timeline" role="list" aria-label="Tasks scheduled for ${escapeHtml(formatDate(dateKey))}">
      ${Array.from({ length: 15 }, (_, index) => {
        const hour = index + 6;
        const hourTasks = tasks.filter((task) => Number(task.time.slice(0, 2)) === hour);
        return `
          <section class="timeline-hour" role="listitem">
            <time>${formatHourLabel(hour)}</time>
            <div class="timeline-slot">
              ${hourTasks.length ? hourTasks.map(renderTimelineTask).join("") : `<span class="open-slot">Open focus space</span>`}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderTimelineTask(task) {
  return `
    <article class="timeline-task ${task.priority.toLowerCase()} ${task.completed ? "completed" : ""}">
      <div>
        <span>${escapeHtml(task.time)} - ${formatMinutes(task.estimateMinutes)}</span>
        <strong>${escapeHtml(task.title)}</strong>
        ${task.notes ? `<p>${escapeHtml(task.notes)}</p>` : ""}
        ${renderTaskUnitRail(task)}
      </div>
      <div class="timeline-actions">
        <button class="secondary-button" type="button" data-toggle-scheduled-task="${escapeHtml(task.id)}">${task.completed ? "Undo" : "Done"}</button>
        <button class="primary-button" type="button" data-start-scheduled-task="${escapeHtml(task.id)}" ${task.completed ? "disabled" : ""}>Focus</button>
      </div>
    </article>
  `;
}

function renderWeekPlanner(week) {
  return `
    <div class="week-planner" aria-label="Weekly task planner">
      ${week.map((day) => {
        const tasks = tasksForDate(day.key);
        return `
          <section class="week-day-column ${day.key === state.ui.selectedScheduleDate ? "active" : ""}">
            <button class="week-day-heading" type="button" data-schedule-date-select="${day.key}">
              <span>${escapeHtml(day.weekday)}</span>
              <strong>${escapeHtml(day.day)}</strong>
            </button>
            <div class="week-day-tasks">
              ${tasks.length ? tasks.map(renderWeekTask).join("") : `<span class="open-slot">Open</span>`}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderWeekTask(task) {
  return `
    <article class="week-task ${task.priority.toLowerCase()} ${task.completed ? "completed" : ""}">
      <span>${escapeHtml(task.time)}</span>
      <strong>${escapeHtml(task.title)}</strong>
    </article>
  `;
}

function renderPendingPlanner(tasks) {
  return `
    <div class="pending-planner">
      ${tasks.length ? tasks.map(renderScheduledTaskCard).join("") : renderEmptySchedule("No pending tasks.", "You are clear. Add a date and time when the next commitment appears.")}
    </div>
  `;
}

function renderScheduledTaskCard(task) {
  return `
    <article class="scheduled-task-card ${task.completed ? "completed" : ""}">
      <div class="task-time-block">
        <strong>${escapeHtml(task.time)}</strong>
        <span>${formatDayShort(task.date)}</span>
      </div>
      <div class="task-card-copy">
        <div class="task-card-title-row">
          <strong>${escapeHtml(task.title)}</strong>
          <span class="priority-pill ${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span>
        </div>
        <span>${formatMinutes(task.estimateMinutes)} focus estimate</span>
        ${renderTaskUnitRail(task)}
        ${task.notes ? `<p>${escapeHtml(task.notes)}</p>` : ""}
      </div>
      <div class="task-card-actions">
        <button class="secondary-button" type="button" data-toggle-scheduled-task="${escapeHtml(task.id)}">${task.completed ? "Undo" : "Done"}</button>
        <button class="primary-button" type="button" data-start-scheduled-task="${escapeHtml(task.id)}" ${task.completed ? "disabled" : ""}>Focus</button>
        <button class="icon-button danger-icon" type="button" aria-label="Delete ${escapeHtml(task.title)}" data-delete-scheduled-task="${escapeHtml(task.id)}">Delete</button>
      </div>
    </article>
  `;
}

function renderTaskUnitRail(task) {
  const total = Math.max(1, Number(task.focusUnitTotal || TASK_UNIT_TOTAL));
  const completed = Math.max(0, Math.min(total, Number(task.focusUnitsCompleted || 0)));
  return `
    <div class="task-unit-rail" aria-label="${completed} of ${total} focus units complete">
      ${Array.from({ length: total }, (_, index) => `<i class="${index < completed ? "filled" : ""}"></i>`).join("")}
      <span>${completed}/${total} units</span>
    </div>
  `;
}

function renderEmptySchedule(title, body) {
  return `
    <article class="empty-schedule-card">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
    </article>
  `;
}

function renderSystemRewardReveal(session, linkedTask) {
  const rank = currentRank();
  return `
    <section class="system-reveal" role="status" aria-live="polite">
      <div class="system-reveal-core">
        <span class="eyebrow">${session.lastRewardLeveledUp ? "Level advanced" : "Block cleared"}</span>
        <h3>+${session.lastRewardXp} XP absorbed</h3>
        <p>${session.lastRewardLeveledUp ? `Level ${session.lastRewardLevel} reached. Current rank: ${escapeHtml(rank.title)}.` : `Level ${currentLevel()} holds steady. ${xpToNextLevel()} XP to the next level.`}</p>
      </div>
      <div class="system-reveal-grid">
        <article><span>Rank</span><strong>${escapeHtml(session.lastRewardRank || rank.code)}</strong></article>
        <article><span>Level</span><strong>${session.lastRewardLevel || currentLevel()}</strong></article>
        <article><span>Block</span><strong>${session.lastRewardBlock}/4</strong></article>
        <article><span>Task units</span><strong>${linkedTask ? `${linkedTask.focusUnitsCompleted}/${linkedTask.focusUnitTotal}` : "--"}</strong></article>
      </div>
    </section>
  `;
}

function renderInsightTile(title, body) {
  return `
    <article class="insight-tile">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
    </article>
  `;
}

function renderRecentSessionCard(session) {
  return `
    <article class="recent-session-card">
      <div>
        <strong>${escapeHtml(session.task)}</strong>
        <span>${formatDate(session.start)} - ${formatMinutes(session.durationMinutes)}</span>
      </div>
      <div class="recent-session-meta">
        <b>${session.blocksCompleted}/4 blocks</b>
        <span>+${session.xpEarned} XP</span>
      </div>
    </article>
  `;
}

function renderTimerDial(remaining, duration, blockNumber, label = `Block ${blockNumber}`) {
  const percent = Math.max(0, Math.min(100, 100 - Math.round((remaining / Math.max(1, duration)) * 100)));
  const note = label === "Recovery" ? "active recovery" : label === "XP Reward" ? "reward earned" : "remaining in this block";
  return `
    <div class="timer-dial" style="--dial-progress:${percent}%" role="timer" aria-label="${escapeHtml(label)} timer, ${formatClock(remaining)} remaining">
      <div class="timer-dial-inner">
        <span>${escapeHtml(label)}</span>
        <strong>${formatClock(remaining)}</strong>
        <small>${note}</small>
      </div>
    </div>
  `;
}

function renderBlockCards(session) {
  return session.blockDurations.map((seconds, index) => {
    let status = "upcoming";
    if (index < session.completedBlocks) status = "completed";
    else if (index === session.currentBlockIndex) {
      if (session.status === "awaiting-next" && index === session.currentBlockIndex) status = "ready";
      else if (session.status === "break" && index === session.currentBlockIndex) status = "resting";
      else status = "active";
    }
    return `
      <article class="block-card ${status}">
        <div class="block-card-number">${status === "completed" ? "OK" : index + 1}</div>
        <div>
          <strong>Block ${index + 1}</strong>
          <span>${formatClock(seconds)}</span>
        </div>
        <div class="block-card-meta">
          <b>${formatBlockStatus(status)}</b>
          <span>+${BLOCK_XP[index]} XP</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderInsightBox(title, value, note, tone) {
  return `
    <section class="insight-box ${tone}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </section>
  `;
}

function renderRankTier(rank) {
  const level = currentLevel();
  const active = currentRank().code === rank.code;
  const unlocked = level >= rank.minLevel;
  const xpLeft = Math.max(0, xpToReachLevel(rank.minLevel) - state.totalXp);
  return `
    <article class="rank-tier-card ${active ? "active" : ""} ${unlocked ? "unlocked" : "locked"}">
      <div class="rank-tier-mark">${escapeHtml(rank.code)}</div>
      <div>
        <strong>${escapeHtml(rank.title)}</strong>
        <span>${escapeHtml(rank.note)}</span>
      </div>
      <small>${unlocked ? `Level ${rank.minLevel}+` : `${formatNumber(xpLeft)} XP left`}</small>
    </article>
  `;
}

function renderLevelMilestones() {
  const level = currentLevel();
  const targets = [level, level + 1, level + 5, level + 10]
    .filter((target, index, list) => target >= 1 && list.indexOf(target) === index);
  return targets.map((target) => {
    const done = target <= level;
    const xpLeft = Math.max(0, xpToReachLevel(target) - state.totalXp);
    return renderMilestone(
      done ? `Reached Level ${target}` : `Reach Level ${target}`,
      done ? "Unlocked through completed focus blocks" : `${formatNumber(xpLeft)} XP to go`,
      done ? "Active" : `Cost ${formatNumber(xpNeededForLevel(Math.max(1, target - 1)))} XP`,
      done
    );
  }).join("");
}

function renderBadge(badge) {
  const unlocked = currentLevel() >= badge.unlockLevel;
  return `
    <article class="badge-card ${badge.tone} ${unlocked ? "unlocked" : "locked"}">
      <div class="badge-mark">${unlocked ? "XP" : "--"}</div>
      <strong>${escapeHtml(badge.name)}</strong>
      <span>${escapeHtml(unlocked ? badge.note : badge.note)}</span>
    </article>
  `;
}

function renderRewardCard(reward) {
  const unlocked = currentLevel() >= reward.unlockLevel;
  return `
    <article class="reward-card ${unlocked ? "unlocked" : ""}">
      <strong>${escapeHtml(reward.name)}</strong>
      <span>Level ${reward.unlockLevel}</span>
    </article>
  `;
}

function renderMilestone(title, note, xp, done) {
  return `
    <article class="milestone ${done ? "done" : ""}">
      <div class="milestone-dot"></div>
      <div class="milestone-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(note)}</span>
      </div>
      <b>${escapeHtml(xp)}</b>
    </article>
  `;
}

function renderHistoryCard(session) {
  return `
    <article class="history-entry">
      <div class="history-primary">
        <strong>${escapeHtml(session.task)}</strong>
        <span>${formatDate(session.start)} - ${formatTimeRange(session.start, session.durationMinutes)}</span>
      </div>
      <div class="history-secondary">
        <span>${session.blocksCompleted} / ${session.totalBlocks} blocks</span>
        <span>${formatMinutes(session.durationMinutes)}</span>
        <span>+${session.xpEarned} XP</span>
      </div>
      <p>${escapeHtml(session.note)}</p>
    </article>
  `;
}

function renderModal() {
  const session = state.currentSession;
  if (state.ui.startModalOpen) {
    modalLayer.innerHTML = renderStartModal();
    return;
  }
  if (session && session.status === "awaiting-next") {
    modalLayer.innerHTML = renderContinueModal(session);
    return;
  }
  modalLayer.innerHTML = "";
}

function renderStartModal() {
  const selected = state.ui.startDraft.selectedDuration;
  return `
    <div class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="startModalTitle">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Start a session</span>
            <h2 id="startModalTitle">Pick the full time once</h2>
          </div>
          <button class="icon-button" type="button" data-close-modal>Close</button>
        </div>
        <p class="support-copy">DeeCadence will divide the total time into four equal blocks and only show the current block countdown on the timer.</p>
        <label class="field-shell">
          <span>Session task</span>
          <input class="text-input" type="text" value="${escapeHtml(state.ui.startDraft.task)}" data-start-task>
        </label>
        <div class="duration-picker">
          ${START_PRESETS.map((minutes) => `
            <button class="duration-chip ${selected === minutes ? "selected" : ""}" type="button" data-select-duration="${minutes}">
              ${minutes}m
            </button>
          `).join("")}
          <button class="duration-chip ${selected === "custom" ? "selected" : ""}" type="button" data-select-duration="custom">
            Custom
          </button>
        </div>
        ${selected === "custom" ? `
          <label class="field-shell">
            <span>Custom total minutes</span>
            <input class="text-input" type="number" min="10" max="240" value="${escapeHtml(state.ui.startDraft.customMinutes)}" data-custom-duration>
          </label>
        ` : ""}
        ${state.ui.startError ? `<p class="form-error" role="alert">${escapeHtml(state.ui.startError)}</p>` : ""}
        <div class="preview-strip">
          <article><span>Total time</span><strong>${selected === "custom" ? `${customMinutesValue() || "--"}m` : `${selected}m`}</strong></article>
          <article><span>Each block</span><strong>${formatClock(previewBlockSeconds())}</strong></article>
          <article><span>Total blocks</span><strong>4</strong></article>
        </div>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-confirm-start>Start session</button>
          <button class="secondary-button" type="button" data-close-modal>Cancel</button>
        </div>
      </section>
    </div>
  `;
}

function renderContinueModal(session) {
  const nextBlock = Math.min(4, session.currentBlockIndex + 1);
  const seconds = session.blockDurations[session.currentBlockIndex] || session.blockDurations[3];
  return `
    <div class="modal-backdrop">
      <section class="modal-card modal-card--compact" role="dialog" aria-modal="true" aria-labelledby="continueModalTitle">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Block complete</span>
            <h2 id="continueModalTitle">Continue when you are ready</h2>
          </div>
        </div>
        <p class="support-copy">Block ${session.completedBlocks} finished. The next block is ready, but DeeCadence will wait for your signal before it starts.</p>
        <div class="preview-strip">
          <article><span>Next block</span><strong>Block ${nextBlock}</strong></article>
          <article><span>Length</span><strong>${formatClock(seconds)}</strong></article>
          <article><span>Last reward</span><strong>+${session.lastRewardXp} XP</strong></article>
        </div>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-continue-block>Start next block</button>
          <button class="secondary-button" type="button" data-end-session>Stop here</button>
        </div>
      </section>
    </div>
  `;
}

function renderToast() {
  if (!state.ui.toast) {
    toastLayer.innerHTML = "";
    return;
  }
  toastLayer.innerHTML = `
    <article class="xp-toast ${state.ui.toast.kind || "xp"}">
      <span>${escapeHtml(state.ui.toast.title)}</span>
      <strong>${escapeHtml(state.ui.toast.message)}</strong>
    </article>
  `;
}

function openStartModal() {
  if (state.currentSession) {
    setRoute("focus");
    return;
  }
  state.ui.startDraft.linkedTaskId = "";
  state.ui.startModalOpen = true;
  saveState();
  renderModal();
}

function closeModal() {
  state.ui.startModalOpen = false;
  saveState();
  renderModal();
}

function selectDuration(value) {
  state.ui.startDraft.selectedDuration = value === "custom" ? "custom" : Number(value);
  state.ui.startError = "";
  saveState();
  renderModal();
}

function customMinutesValue() {
  if (String(state.ui.startDraft.customMinutes || "").trim() === "") return 0;
  const raw = Number(state.ui.startDraft.customMinutes);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(10, Math.min(240, Math.round(raw)));
}

function previewBlockSeconds() {
  const totalMinutes = state.ui.startDraft.selectedDuration === "custom"
    ? customMinutesValue()
    : Number(state.ui.startDraft.selectedDuration || START_PRESETS[0]);
  if (!totalMinutes) return 0;
  return splitIntoBlocks(totalMinutes * 60)[0];
}

function addScheduleTask() {
  const draft = state.ui.scheduleDraft;
  const title = String(draft.title || "").trim();
  if (!title) {
    state.ui.toast = {
      title: "Task needs a name",
      message: "Add a short title before scheduling it",
      expiresAt: Date.now() + 2400,
      kind: "info"
    };
    saveState();
    render();
    return;
  }
  const task = normalizeScheduleTask({
    id: `task_${Date.now()}`,
    title,
    date: draft.date,
    time: draft.time,
    estimateMinutes: draft.estimateMinutes,
    priority: draft.priority,
    notes: draft.notes,
    focusUnitTotal: TASK_UNIT_TOTAL,
    focusUnitsCompleted: 0,
    completed: false
  });
  if (!task) return;
  state.scheduleTasks.push(task);
  state.ui.scheduleDraft = {
    ...state.ui.scheduleDraft,
    title: "",
    notes: ""
  };
  state.ui.toast = {
    title: "Task scheduled",
    message: `${task.title} is ready for a focus block`,
    expiresAt: Date.now() + 2400,
    kind: "success"
  };
  saveState();
  render();
}

function startScheduledTask(taskId) {
  const task = state.scheduleTasks.find((item) => item.id === taskId);
  if (!task || task.completed) return;
  if (state.currentSession) {
    state.ui.toast = {
      title: "Session already running",
      message: "Finish or stop the current block before starting another task",
      expiresAt: Date.now() + 2600,
      kind: "info"
    };
    saveState();
    setRoute("focus");
    return;
  }
  state.ui.startDraft.task = task.title;
  state.ui.startDraft.linkedTaskId = task.id;
  state.ui.startDraft.selectedDuration = START_PRESETS.includes(task.estimateMinutes) ? task.estimateMinutes : "custom";
  state.ui.startDraft.customMinutes = START_PRESETS.includes(task.estimateMinutes) ? "" : String(task.estimateMinutes);
  state.ui.startModalOpen = true;
  state.ui.startError = "";
  saveState();
  setRoute("focus");
}

function toggleScheduleTask(taskId) {
  const task = state.scheduleTasks.find((item) => item.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  task.focusUnitsCompleted = task.completed ? task.focusUnitTotal : Math.min(task.focusUnitsCompleted, task.focusUnitTotal - 1);
  state.ui.toast = {
    title: task.completed ? "Task marked done" : "Task reopened",
    message: task.title,
    expiresAt: Date.now() + 2200,
    kind: task.completed ? "success" : "info"
  };
  saveState();
  render();
}

function deleteScheduleTask(taskId) {
  const before = state.scheduleTasks.length;
  state.scheduleTasks = state.scheduleTasks.filter((task) => task.id !== taskId);
  if (state.scheduleTasks.length === before) return;
  state.ui.toast = {
    title: "Task removed",
    message: "Your schedule was updated",
    expiresAt: Date.now() + 2200,
    kind: "info"
  };
  saveState();
  render();
}

function autoArrangeSchedule() {
  const selectedDate = state.ui.selectedScheduleDate || todayKey();
  const sameDayOpen = state.scheduleTasks.filter((task) => !task.completed && task.date === selectedDate);
  const pool = (sameDayOpen.length ? sameDayOpen : scheduledTasksSorted().filter((task) => !task.completed))
    .slice()
    .sort((a, b) => {
      const priorityScore = { High: 0, Medium: 1, Low: 2 };
      const priorityDelta = priorityScore[a.priority] - priorityScore[b.priority];
      if (priorityDelta) return priorityDelta;
      return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
    })
    .slice(0, 6);

  if (!pool.length) {
    state.ui.toast = {
      title: "Nothing to arrange",
      message: "Add a task first, then DeeCadence can build the day",
      expiresAt: Date.now() + 2400,
      kind: "info"
    };
    saveState();
    render();
    return;
  }

  let cursor = 9 * 60;
  pool.forEach((task) => {
    task.date = selectedDate;
    task.time = timeFromMinutes(cursor);
    cursor = nextQuarterHour(cursor + Math.max(15, Math.min(90, task.estimateMinutes)) + 10);
    if (cursor > 18 * 60) cursor = 18 * 60;
  });

  state.ui.scheduleView = "day";
  state.ui.scheduleDraft.date = selectedDate;
  state.ui.toast = {
    title: "Plan arranged",
    message: `${pool.length} task${pool.length === 1 ? "" : "s"} placed into today's focus order`,
    expiresAt: Date.now() + 2600,
    kind: "success"
  };
  saveState();
  setRoute("schedule");
}

function setScheduleView(view) {
  if (!["day", "week", "pending"].includes(view)) return;
  state.ui.scheduleView = view;
  saveState();
  render();
}

function setSelectedScheduleDate(dateKey) {
  const normalized = normalizeDateKey(dateKey);
  if (!normalized) return;
  state.ui.selectedScheduleDate = normalized;
  state.ui.scheduleDraft.date = normalized;
  saveState();
  render();
}

function shiftSelectedScheduleDate(deltaDays) {
  if (!Number.isFinite(deltaDays)) return;
  setSelectedScheduleDate(addDays(state.ui.selectedScheduleDate || todayKey(), deltaDays));
}

function beginSessionFromDraft() {
  const selected = state.ui.startDraft.selectedDuration;
  const totalMinutes = selected === "custom" ? customMinutesValue() : Number(selected);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 10) {
    state.ui.startError = "Enter a custom session length from 10 to 240 minutes.";
    saveState();
    renderModal();
    return;
  }
  const totalSeconds = totalMinutes * 60;
  const blockDurations = splitIntoBlocks(totalSeconds);
  state.currentSession = {
    id: `session_${Date.now()}`,
    task: String(state.ui.startDraft.task || "Deep work session").trim() || "Deep work session",
    totalSeconds,
    blockDurations,
    currentBlockIndex: 0,
    completedBlocks: 0,
    status: "running",
    blockStartedAt: new Date().toISOString(),
    elapsedCurrentBlockSeconds: 0,
    breakStartedAt: null,
    breakElapsedSeconds: 0,
    totalElapsedSeconds: 0,
    xpEarned: 0,
    linkedTaskId: String(state.ui.startDraft.linkedTaskId || ""),
    rewardUntil: 0,
    lastRewardXp: 0,
    lastRewardBlock: 0,
    lastRewardLevel: currentLevel(),
    lastRewardRank: currentRank().code,
    lastRewardLeveledUp: false,
    startedAt: new Date().toISOString()
  };
  state.ui.startModalOpen = false;
  state.ui.startError = "";
  state.lastSessionSummary = null;
  saveState();
  setRoute("focus");
}

function splitIntoBlocks(totalSeconds) {
  const base = Math.floor(totalSeconds / 4);
  const remainder = totalSeconds % 4;
  return Array.from({ length: 4 }, (_, index) => base + (index < remainder ? 1 : 0));
}

function pauseOrResumeSession() {
  const session = state.currentSession;
  if (!session) return;
  if (session.status === "paused") {
    session.status = "running";
    session.blockStartedAt = new Date().toISOString();
  } else if (session.status === "running") {
    session.elapsedCurrentBlockSeconds = currentBlockElapsedSeconds(session);
    session.blockStartedAt = null;
    session.status = "paused";
  }
  saveState();
  render();
}

function currentBlockDuration(session) {
  return session.blockDurations[Math.min(3, session.currentBlockIndex)] || session.blockDurations[3] || 0;
}

function currentBlockElapsedSeconds(session) {
  const carried = Number(session.elapsedCurrentBlockSeconds || 0);
  if (session.status !== "running" || !session.blockStartedAt) return carried;
  const delta = Math.floor((Date.now() - new Date(session.blockStartedAt).getTime()) / 1000);
  return Math.max(0, carried + delta);
}

function currentBlockRemainingSeconds(session) {
  return Math.max(0, currentBlockDuration(session) - currentBlockElapsedSeconds(session));
}

function breakElapsedSeconds(session) {
  const carried = Number(session.breakElapsedSeconds || 0);
  if (session.status !== "break" || !session.breakStartedAt) return carried;
  const delta = Math.floor((Date.now() - new Date(session.breakStartedAt).getTime()) / 1000);
  return Math.max(0, carried + delta);
}

function breakRemainingSeconds(session) {
  return Math.max(0, BREAK_SECONDS - breakElapsedSeconds(session));
}

function completeCurrentBlock() {
  const session = state.currentSession;
  if (!session) return;
  const xp = BLOCK_XP[Math.min(BLOCK_XP.length - 1, session.currentBlockIndex)];
  const previousLevel = currentLevel();
  const previousRank = currentRank().code;
  session.totalElapsedSeconds += currentBlockDuration(session);
  session.elapsedCurrentBlockSeconds = 0;
  session.blockStartedAt = null;
  session.completedBlocks += 1;
  session.xpEarned += xp;
  const advancedTask = advanceLinkedTaskProgress(session);
  session.lastRewardXp = xp;
  session.lastRewardBlock = session.completedBlocks;
  session.rewardUntil = Date.now() + 3200;
  session.status = "reward";
  state.totalXp += xp;
  session.lastRewardLevel = currentLevel();
  session.lastRewardRank = currentRank().code;
  session.lastRewardLeveledUp = session.lastRewardLevel > previousLevel || session.lastRewardRank !== previousRank;
  state.ui.toast = {
    title: session.lastRewardLeveledUp ? "Level increased" : `Block ${session.completedBlocks} complete`,
    message: advancedTask
      ? `+${xp} XP - ${advancedTask.focusUnitsCompleted}/${advancedTask.focusUnitTotal} task units`
      : `+${xp} XP earned`,
    expiresAt: Date.now() + 3200,
    kind: "xp"
  };
  saveState();
  render();
}

function advanceLinkedTaskProgress(session) {
  if (!session.linkedTaskId) return null;
  const task = state.scheduleTasks.find((item) => item.id === session.linkedTaskId);
  if (!task || task.completed) return null;
  task.focusUnitsCompleted = Math.min(task.focusUnitTotal, Number(task.focusUnitsCompleted || 0) + 1);
  task.completed = task.focusUnitsCompleted >= task.focusUnitTotal;
  return task;
}

function continueToNextBlock() {
  const session = state.currentSession;
  if (!session || session.status !== "awaiting-next") return;
  session.status = "running";
  session.blockStartedAt = new Date().toISOString();
  session.elapsedCurrentBlockSeconds = 0;
  saveState();
  render();
}

function endCurrentSession() {
  const session = state.currentSession;
  if (!session) return;
  finalizeSession("partial");
}

function finishWholeSession() {
  finalizeSession("complete");
}

function finalizeSession(status) {
  const session = state.currentSession;
  if (!session) return;
  const partialCurrent = session.status === "running" || session.status === "paused"
    ? Math.min(currentBlockElapsedSeconds(session), currentBlockDuration(session))
    : 0;
  const totalSeconds = session.totalElapsedSeconds + partialCurrent;
  const durationMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const entry = {
    id: session.id,
    start: session.startedAt,
    durationMinutes,
    blocksCompleted: session.completedBlocks,
    totalBlocks: 4,
    xpEarned: session.xpEarned,
    task: session.task,
    note: status === "complete"
      ? "Completed all four focus blocks."
      : session.completedBlocks > 0
        ? "Stopped after banking completed blocks."
        : "Ended before the first block was completed.",
    status
  };
  state.sessions.push(entry);
  state.lastSessionSummary = {
    task: session.task,
    blocksCompleted: session.completedBlocks,
    durationMinutes,
    xpEarned: session.xpEarned
  };
  state.currentSession = null;
  state.ui.toast = status === "complete"
    ? {
        title: "Session complete",
        message: `+${entry.xpEarned} XP across 4 blocks`,
        expiresAt: Date.now() + 2600,
        kind: "success"
      }
    : {
        title: "Progress saved",
        message: `${entry.blocksCompleted} completed block${entry.blocksCompleted === 1 ? "" : "s"} kept`,
        expiresAt: Date.now() + 2600,
        kind: "info"
      };
  saveState();
  render();
}

function todaySummary() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessions = state.sessions.filter((session) => session.start.slice(0, 10) === todayKey);
  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const totalBlocks = sessions.reduce((sum, session) => sum + session.blocksCompleted, 0);
  const todayXp = sessions.reduce((sum, session) => sum + session.xpEarned, 0);
  return {
    focusHours: totalMinutes / 60,
    completedBlocks: Math.min(4, totalBlocks),
    todayXp
  };
}

function progressWindow(days) {
  const recent = state.sessions.slice(-days * 2);
  const buckets = new Map();
  recent.forEach((session) => {
    const key = session.start.slice(0, 10);
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: formatDayShort(session.start),
        hours: 0,
        xp: 0,
        completedBlocks: 0,
        blocks: 0
      });
    }
    const current = buckets.get(key);
    current.hours += session.durationMinutes / 60;
    current.xp += session.xpEarned;
    current.completedBlocks += session.blocksCompleted;
    current.blocks += session.totalBlocks;
  });
  const points = Array.from(buckets.values()).slice(-days);
  const totalHours = points.reduce((sum, point) => sum + point.hours, 0);
  const totalMinutes = recent.slice(-days).reduce((sum, session) => sum + session.durationMinutes, 0);
  const totalCompletedBlocks = points.reduce((sum, point) => sum + point.completedBlocks, 0);
  const totalBlocks = points.reduce((sum, point) => sum + point.blocks, 0);
  const bestDay = points.reduce((best, point) => point.hours > best.hours ? point : best, { label: "Today", hours: 0 });
  return {
    points: points.length ? points : [{ label: "Today", hours: 0 }],
    averageHours: totalHours / Math.max(1, points.length),
    totalCompletedBlocks,
    totalBlocks,
    bestDay,
    weekXp: points.reduce((sum, point) => sum + point.xp, 0),
    averageSessionLabel: formatHours((totalMinutes / Math.max(1, recent.slice(-days).length)) / 60),
    delta: 18
  };
}

function recentSessions(limit) {
  return state.sessions
    .slice()
    .sort((a, b) => new Date(b.start) - new Date(a.start))
    .slice(0, limit);
}

function filteredSessions() {
  const query = state.historyQuery.trim().toLowerCase();
  const sorted = state.sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start));
  if (!query) return sorted;
  return sorted.filter((session) => {
    const haystack = `${session.task} ${session.note} ${formatDate(session.start)} ${session.durationMinutes}`.toLowerCase();
    return haystack.includes(query);
  });
}

function scheduledTasksSorted() {
  return state.scheduleTasks
    .slice()
    .sort((a, b) => {
      const left = `${a.date}T${a.time}`;
      const right = `${b.date}T${b.time}`;
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return left.localeCompare(right);
    });
}

function tasksForDate(dateKey) {
  return scheduledTasksSorted().filter((task) => task.date === dateKey);
}

function pendingScheduleTasks(selectedDate = todayKey()) {
  return scheduledTasksSorted().filter((task) => !task.completed && task.date <= selectedDate);
}

function linkedTaskForSession(session) {
  if (!session || !session.linkedTaskId) return null;
  return state.scheduleTasks.find((task) => task.id === session.linkedTaskId) || null;
}

function scheduleWeek(dateKey) {
  const date = parseDateKey(dateKey);
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return {
      key: current.toISOString().slice(0, 10),
      weekday: current.toLocaleDateString(undefined, { weekday: "short" }),
      day: current.toLocaleDateString(undefined, { day: "numeric" })
    };
  });
}

function addDays(dateKey, days) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDateKey(dateKey) {
  const normalized = normalizeDateKey(dateKey) || todayKey();
  return new Date(`${normalized}T12:00:00`);
}

function normalizeDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
}

function nextQuarterHour(minutes) {
  return Math.ceil(minutes / 15) * 15;
}

function timeFromMinutes(minutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, minutes));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function totalBlocksCompleted() {
  return state.sessions.reduce((sum, session) => sum + session.blocksCompleted, 0);
}

function currentRank() {
  const level = currentLevel();
  return RANK_TIERS.reduce((current, rank) => level >= rank.minLevel ? rank : current, RANK_TIERS[0]);
}

function upcomingRank() {
  const level = currentLevel();
  return RANK_TIERS.find((rank) => rank.minLevel > level) || null;
}

function currentLevel() {
  const xp = Math.max(0, Number(state.totalXp || 0));
  let level = 1;
  while (xp >= xpToReachLevel(level + 1)) {
    level += 1;
  }
  return level;
}

function levelProgress() {
  const level = currentLevel();
  const floor = xpToReachLevel(level);
  const ceiling = xpToReachLevel(level + 1);
  return Math.max(0, Math.min(100, ((state.totalXp - floor) / Math.max(1, ceiling - floor)) * 100));
}

function xpToNextLevel() {
  return Math.max(0, xpToReachLevel(currentLevel() + 1) - state.totalXp);
}

function xpNeededForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return Math.round((XP_BASE * Math.pow(safeLevel, XP_GROWTH)) + (safeLevel * XP_LEVEL_BONUS));
}

function xpToReachLevel(level) {
  const target = Math.max(1, Math.floor(Number(level) || 1));
  let total = 0;
  for (let current = 1; current < target; current += 1) {
    total += xpNeededForLevel(current);
  }
  return total;
}

function exportHistory() {
  const blob = new Blob([JSON.stringify(state.sessions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `deecadence-history-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function openFeedbackSurvey() {
  window.location.href = "./deecadence_feedback_form_reference.html";
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatMinutes(value) {
  return `${Math.round(Number(value || 0))}m`;
}

function formatHours(value) {
  const hours = Number(value || 0);
  if (!hours) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes ? `${whole}h ${String(minutes).padStart(2, "0")}m` : `${whole}h`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDayShort(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimeRange(dateString, durationMinutes) {
  const start = new Date(dateString);
  const end = new Date(start.getTime() + (durationMinutes * 60000));
  return `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function formatHourLabel(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const value = hour % 12 || 12;
  return `${value} ${suffix}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text.slice(0, 1).toUpperCase()}${text.slice(1)}` : "";
}

function formatBlockStatus(status) {
  if (status === "completed") return "Completed";
  if (status === "active") return "Running";
  if (status === "ready") return "Ready";
  if (status === "resting") return "After break";
  return "Upcoming";
}

function formatSessionStatus(status) {
  if (status === "paused") return "Paused";
  if (status === "break") return "Recovery";
  if (status === "awaiting-next") return "Awaiting next block";
  if (status === "reward") return "Rewarding";
  return "Running";
}

function renderLineChart(points) {
  const width = 760;
  const height = 260;
  const max = Math.max(...points.map((point) => point.hours), 1);
  const gap = points.length > 1 ? (width - 120) / (points.length - 1) : 0;
  const mapped = points.map((point, index) => {
    const x = 60 + gap * index;
    const y = height - 56 - ((point.hours / max) * 150);
    return { ...point, x, y };
  });
  const linePoints = mapped.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${linePoints} ${width - 60},${height - 40} 60,${height - 40}`;
  return `
    <div class="chart-shell">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Focus progress line chart">
        <line x1="60" y1="${height - 40}" x2="${width - 60}" y2="${height - 40}" class="axis-line"></line>
        <polygon points="${areaPoints}" class="chart-area"></polygon>
        <polyline points="${linePoints}" class="chart-line"></polyline>
        ${mapped.map((point) => `
          <circle cx="${point.x}" cy="${point.y}" r="6" class="chart-dot"></circle>
          <text x="${point.x}" y="${height - 12}" text-anchor="middle" class="chart-label">${escapeHtml(point.label)}</text>
        `).join("")}
      </svg>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
