"use strict";

const APP_VERSION = "3.2.0";
const STORAGE_KEY = "deecadence_app_v3";
const LEGACY_KEYS = ["deecadence_web_app_v2", "deecadence_state_v2"];
const BREAK_SECONDS = 5 * 60;
const ONBOARDING_VERSION = 2;
// This is a launch calibration for DeeCadence's own scoring model, not a
// clinical or population norm. Replace it with an anonymized cohort median
// once the product has enough consented baseline results.
const REFERENCE_BENCHMARK = Object.freeze({ score: 70, label: "Provisional reference average", version: "launch-2026" });
const FEEDBACK_ENDPOINT = document.querySelector('meta[name="deecadence-feedback-endpoint"]')?.content.trim() || "";
const FEEDBACK_EMAIL = document.querySelector('meta[name="deecadence-feedback-email"]')?.content.trim() || "";

const RANKS = [
  { code: "E", minLevel: 1, minXp: 0, label: "Learning consistency", color: "#75d8c3", minConsistency: 0 },
  { code: "D", minLevel: 5, minXp: 1736, label: "Control is forming", color: "#3e6fe0", minConsistency: 20 },
  { code: "C", minLevel: 25, minXp: 14380, label: "Reliable under pressure", color: "#4fd8e8", minConsistency: 30 },
  { code: "B", minLevel: 45, minXp: 29403, label: "Deep work is repeatable", color: "#2fbf8f", minConsistency: 40 },
  { code: "A", minLevel: 70, minXp: 49999, label: "High consistency", color: "#e8b94c", minConsistency: 50 },
  { code: "S", minLevel: 100, minXp: 109109, label: "Elite attention control", color: "#8b7fe8", minConsistency: 60 },
  { code: "SS", minLevel: 200, minXp: 237678, label: "Rare long-term discipline", color: "#c77fe8", minConsistency: 70 },
  { code: "SSS", minLevel: 300, minXp: 460371, label: "Exceptional cadence", color: "#f0985a", minConsistency: 75 },
  { code: "L", minLevel: 500, minXp: 999999, label: "Legendary attention span", color: "#fff0b8", minConsistency: 80 },
];

const L_LEVEL_BASE_XP = 5000;
const L_LEVEL_GROWTH_XP = 50;

const DEFAULT_STATE = {
  version: 3,
  activeView: "today",
  theme: "dark",
  settings: {
    sound: false,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false,
    dailyGoal: 30,
  },
  welcomeSeen: false,
  onboardingVersion: 0,
  tourSeen: false,
  missionCompleted: false,
  missionDismissed: false,
  tipsSeen: [],
  totalXp: 0,
  highestRankCode: "E",
  tasks: [],
  sessions: [],
  currentSession: null,
  attentionTests: [],
  baselineScore: null,
  baselineTestId: "",
  baselineCompletedAt: null,
  feedbackOutbox: [],
  planView: "day",
  planMode: "schedule",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let state = loadState();
let timerHandle = null;
let toastHandle = null;
let selectedDuration = 25;
let selectedBlockCount = 4;
let selectedTaskSource = "schedule";
let selectedTaskId = "";
let editingTaskId = "";
let detailTaskId = "";
let selectedBlockFeeling = "";
let attentionRuntime = null;
let attentionTimer = null;
let attentionOrigin = "progress";
let selectedMissionMinutes = 2;
let tourStep = 0;
let tourTransitioning = false;
let tourLayoutRaf = 0;
let tourRenderToken = 0;
let tourPreviousFocus = null;
let feedbackType = "Idea";

function init() {
  validateRankLadder();
  if (evaluateRankUnlock()) saveState();
  applyPreferences();
  bindStaticEvents();
  recoverRunningSession();
  renderAll();
  startTimerLoop();
  window.setTimeout(() => {
    document.body.classList.add("booted");
    if (state.onboardingVersion < ONBOARDING_VERSION) openWelcome();
  }, 220);
  updateFeedbackDeliveryCopy();
  retryFeedbackOutbox();
}

function loadState() {
  const candidates = [STORAGE_KEY, ...LEGACY_KEYS];
  let saved = null;
  for (const key of candidates) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (parsed && typeof parsed === "object") {
        saved = parsed;
        break;
      }
    } catch { /* ignore malformed legacy state */ }
  }
  if (!saved) return structuredCloneSafe(DEFAULT_STATE);

  const next = structuredCloneSafe(DEFAULT_STATE);
  next.activeView = validView(saved.activeView || saved.route || saved.view) ? (saved.activeView || saved.route || saved.view) : "today";
  next.theme = saved.theme === "light" ? "light" : "dark";
  next.settings = {
    ...next.settings,
    ...(saved.settings || {}),
    sound: Boolean(saved.settings?.sound ?? saved.sound),
    reducedMotion: Boolean(saved.settings?.reducedMotion ?? saved.reducedMotion),
    dailyGoal: clampNumber(saved.settings?.dailyGoal ?? saved.dailyGoal, 15, 120, 30),
  };
  next.welcomeSeen = Boolean(saved.welcomeSeen ?? saved.onboarded ?? saved.ui?.welcomeSeen);
  next.onboardingVersion = clampNumber(saved.onboardingVersion, 0, ONBOARDING_VERSION, next.welcomeSeen ? 1 : 0);
  next.tourSeen = Boolean(saved.tourSeen ?? saved.ui?.tourSeen);
  next.missionCompleted = Boolean(saved.missionCompleted);
  next.missionDismissed = Boolean(saved.missionDismissed);
  next.tipsSeen = Array.isArray(saved.tipsSeen) ? saved.tipsSeen.filter((view) => validView(view)) : [];
  next.totalXp = clampNumber(saved.totalXp ?? saved.xp, 0, 1e9, 0);
  next.highestRankCode = RANKS.some((rank) => rank.code === saved.highestRankCode) ? saved.highestRankCode : "E";
  next.tasks = normalizeTasks(saved.tasks || saved.scheduleTasks || []);
  next.sessions = normalizeSessions(saved.sessions || []);
  next.currentSession = normalizeCurrentSession(saved.currentSession);
  next.attentionTests = normalizeAttentionTests(saved.attentionTests || []);
  const firstAttentionTest = next.attentionTests[0] || null;
  next.baselineScore = saved.baselineScore === null || saved.baselineScore === undefined
    ? firstAttentionTest?.score ?? null
    : clampNumber(saved.baselineScore, 0, 100, 0);
  next.baselineTestId = String(saved.baselineTestId || firstAttentionTest?.id || "");
  next.baselineCompletedAt = saved.baselineCompletedAt || firstAttentionTest?.takenAt || null;
  next.feedbackOutbox = Array.isArray(saved.feedbackOutbox) ? saved.feedbackOutbox.slice(-50) : [];
  next.planView = ["day", "week", "pending"].includes(saved.planView || saved.ui?.scheduleView) ? (saved.planView || saved.ui.scheduleView) : "day";
  next.planMode = ["schedule", "tasks"].includes(saved.planMode) ? saved.planMode : "schedule";
  return next;
}

function saveState() {
  try {
    state.version = 3;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    showToast("Storage is full. Export a backup before adding more data.", "error");
    return false;
  }
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((task) => {
    if (!task || typeof task.title !== "string" || !task.title.trim()) return null;
    const totalUnits = clampNumber(task.totalUnits ?? task.focusUnitTotal, 1, 12, 4);
    const completedUnits = clampNumber(task.completedUnits ?? task.focusUnitsCompleted, 0, totalUnits, 0);
    return {
      id: String(task.id || uid("task")),
      title: task.title.trim().slice(0, 120),
      date: validDateKey(task.date) ? task.date : todayKey(),
      time: /^\d{2}:\d{2}$/.test(task.time || "") ? task.time : "",
      estimateMinutes: clampNumber(task.estimateMinutes ?? task.duration, 5, 480, 45),
      priority: normalizePriority(task.priority),
      notes: String(task.notes || "").slice(0, 1000),
      progressType: task.progressType === "ongoing" ? "ongoing" : "countable",
      totalUnits,
      completedUnits,
      flex: task.flex === "fixed" ? "fixed" : "flexible",
      completed: Boolean(task.completed) || completedUnits >= totalUnits,
      createdAt: task.createdAt || new Date().toISOString(),
    };
  }).filter(Boolean);
}

function normalizeSessions(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((session) => {
    if (!session || !session.start) return null;
    return {
      id: String(session.id || uid("session")),
      start: new Date(session.start).toString() === "Invalid Date" ? new Date().toISOString() : new Date(session.start).toISOString(),
      end: session.end || null,
      durationMinutes: clampNumber(session.durationMinutes, 0, 1440, 0),
      blocksCompleted: clampNumber(session.blocksCompleted, 0, 12, 0),
      totalBlocks: clampNumber(session.totalBlocks, 1, 12, 4),
      xpEarned: clampNumber(session.xpEarned, 0, 1e6, 0),
      task: String(session.task || "Focus session").slice(0, 120),
      taskId: String(session.taskId || session.linkedTaskId || ""),
      status: session.status === "complete" ? "complete" : "partial",
      blockFeedback: Array.isArray(session.blockFeedback) ? session.blockFeedback.slice(0, 12) : [],
    };
  }).filter(Boolean).slice(-3000);
}

function normalizeCurrentSession(session) {
  if (!session || !Array.isArray(session.blockDurations) || !session.blockDurations.length) return null;
  const blockDurations = session.blockDurations.map((value) => clampNumber(value, 1, 86400, 60));
  const currentBlock = clampNumber(session.currentBlock ?? session.currentBlockIndex, 0, blockDurations.length - 1, 0);
  const legacyElapsed = clampNumber(session.elapsedCurrentBlockSeconds, 0, blockDurations[currentBlock], 0)
    + (session.status === "running" && session.blockStartedAt ? Math.max(0, Math.floor((Date.now() - new Date(session.blockStartedAt).getTime()) / 1000)) : 0);
  const remainingSeconds = clampNumber(session.remainingSeconds ?? (blockDurations[currentBlock] - legacyElapsed), 0, blockDurations[currentBlock], blockDurations[currentBlock]);
  const status = session.status === "awaiting-next" ? "awaiting" : ["running", "paused", "break", "reward", "awaiting"].includes(session.status) ? session.status : "paused";
  return {
    id: String(session.id || uid("session")),
    task: String(session.task || "Focus session").slice(0, 120),
    taskId: String(session.taskId || session.linkedTaskId || ""),
    totalMinutes: clampNumber(session.totalMinutes ?? session.totalSeconds / 60, 1, 1440, Math.round(blockDurations.reduce((a, b) => a + b, 0) / 60)),
    blockCount: blockDurations.length,
    blockDurations,
    currentBlock,
    completedBlocks: clampNumber(session.completedBlocks, 0, blockDurations.length, 0),
    remainingSeconds,
    status,
    endAt: Number(session.endAt) || (status === "running" ? Date.now() + remainingSeconds * 1000 : null),
    breakEndAt: Number(session.breakEndAt) || (status === "break" && session.breakStartedAt ? new Date(session.breakStartedAt).getTime() + BREAK_SECONDS * 1000 : null),
    startedAt: session.startedAt || new Date().toISOString(),
    xpEarned: clampNumber(session.xpEarned, 0, 1e6, 0),
    blockFeedback: Array.isArray(session.blockFeedback) ? session.blockFeedback : [],
    isFirstMission: Boolean(session.isFirstMission),
  };
}

function normalizeAttentionTests(tests) {
  if (!Array.isArray(tests)) return [];
  return tests.map((test) => ({
    id: String(test.id || uid("test")),
    takenAt: test.takenAt || new Date().toISOString(),
    score: clampNumber(test.score, 0, 100, 0),
    accuracy: clampNumber(test.accuracy, 0, 100, 0),
    averageReaction: test.averageReaction ? clampNumber(test.averageReaction, 1, 10000, 0) : null,
    misses: clampNumber(test.misses, 0, 99, 0),
    falseTaps: clampNumber(test.falseTaps, 0, 99, 0),
    benchmarkScore: clampNumber(test.benchmarkScore, 0, 100, REFERENCE_BENCHMARK.score),
    benchmarkVersion: String(test.benchmarkVersion || REFERENCE_BENCHMARK.version),
  })).slice(-100);
}

function bindStaticEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      recoverRunningSession();
      renderFocus();
    }
  });
  window.addEventListener("online", retryFeedbackOutbox);
  window.addEventListener("resize", scheduleTourLayout, { passive: true });
  window.addEventListener("orientationchange", scheduleTourLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleTourLayout, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleTourLayout, { passive: true });

  $$(".theme-toggle").forEach((button) => button.addEventListener("click", toggleTheme));
  $("#welcomeSkipBtn").addEventListener("click", completeOnboarding);
  $("#welcomeStartBtn").addEventListener("click", startOnboardingBaseline);
  $("#startModalCancel").addEventListener("click", closeStartModal);
  $("#startModalConfirm").addEventListener("click", startSessionFromModal);
  $("#taskModalCancel").addEventListener("click", closeTaskModal);
  $("#taskModalConfirm").addEventListener("click", saveTaskFromModal);
  $("#taskDetailClose").addEventListener("click", closeTaskDetail);
  $("#taskDetailDone").addEventListener("click", () => toggleTaskDone(detailTaskId));
  $("#taskDetailFocus").addEventListener("click", () => openStartModal(detailTaskId));
  $("#taskDetailEdit").addEventListener("click", () => openTaskModal(detailTaskId));
  $("#taskDetailDelete").addEventListener("click", () => deleteTask(detailTaskId));
  $("#addTaskBtn").addEventListener("click", () => openTaskModal());
  $("#autoArrangeBtnToday").addEventListener("click", autoArrangeToday);
  $("#autoArrangeBtnPlan").addEventListener("click", autoArrangeToday);
  $("#startNextBlockBtn").addEventListener("click", startNextTask);
  $("#exportHistoryBtn").addEventListener("click", exportHistory);
  $("#exportBackupBtn").addEventListener("click", exportBackup);
  $("#importBackupBtn").addEventListener("click", () => $("#importBackupInput").click());
  $("#importBackupInput").addEventListener("change", importBackup);
  $("#openMissionBtn").addEventListener("click", openFirstMission);
  $("#resetTipsBtn").addEventListener("click", resetContextTips);
  $("#missionSkipBtn").addEventListener("click", dismissFirstMission);
  $("#missionStartBtn").addEventListener("click", startFirstMission);
  $("#resetDataBtn").addEventListener("click", resetAllData);
  $("#soundSwitch").addEventListener("click", toggleSound);
  $("#motionSwitch").addEventListener("click", toggleMotion);
  $("#dailyGoalSelect").addEventListener("change", (event) => {
    state.settings.dailyGoal = Number(event.target.value);
    saveAndRender();
  });
  $$("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => setTheme(button.dataset.themeChoice)));

  $("#feedbackFab").addEventListener("click", openFeedback);
  $("#openFeedbackSettingsBtn").addEventListener("click", openFeedback);
  $("#feedbackCloseBtn").addEventListener("click", closeFeedback);
  $("#feedbackCancelBtn").addEventListener("click", closeFeedback);
  $("#feedbackSubmitBtn").addEventListener("click", submitFeedback);

  $("#tourSkipBtn").addEventListener("click", finishTour);
  $("#tourBackBtn").addEventListener("click", () => changeTourStep(-1));
  $("#tourNextBtn").addEventListener("click", () => changeTourStep(1));
}

function handleClick(event) {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) return setView(viewButton.dataset.view);

  const durationButton = event.target.closest("[data-min]");
  if (durationButton) return selectDuration(durationButton.dataset.min);
  const blockButton = event.target.closest("[data-block-count]");
  if (blockButton) return selectBlockCount(Number(blockButton.dataset.blockCount));
  const missionDurationButton = event.target.closest("[data-mission-minutes]");
  if (missionDurationButton) return selectMissionDuration(Number(missionDurationButton.dataset.missionMinutes));
  const sourceButton = event.target.closest("[data-start-source]");
  if (sourceButton) return selectTaskSource(sourceButton.dataset.startSource);
  const planViewButton = event.target.closest("[data-planview]");
  if (planViewButton) {
    state.planView = planViewButton.dataset.planview;
    saveAndRender();
    return;
  }
  const planModeButton = event.target.closest("[data-plan-mode]");
  if (planModeButton) {
    state.planMode = planModeButton.dataset.planMode;
    saveAndRender();
    return;
  }
  const progressTypeButton = event.target.closest("[data-progress-type]");
  if (progressTypeButton) return selectProgressType(progressTypeButton.dataset.progressType);
  const feedbackTypeButton = event.target.closest("[data-feedback-type]");
  if (feedbackTypeButton) return selectFeedbackType(feedbackTypeButton.dataset.feedbackType);
  const feelingButton = event.target.closest("[data-block-feeling]");
  if (feelingButton) return selectBlockFeedback(feelingButton.dataset.blockFeeling);

  const action = event.target.closest("[data-action]");
  if (action) handleDynamicAction(action.dataset.action, action.dataset.id || "");

  if (event.target.classList.contains("modal-overlay")) {
    if (event.target.id === "feedbackModal") closeFeedback();
    if (event.target.id === "taskModal") closeTaskModal();
    if (event.target.id === "taskDetailModal") closeTaskDetail();
    if (event.target.id === "startModal") closeStartModal();
  }
}

function handleInput(event) {
  if (event.target.id === "feedbackMessageInput") {
    $("#feedbackCharCount").textContent = String(event.target.value.length);
  }
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    closeFeedback();
    closeTaskModal();
    closeTaskDetail();
    closeStartModal();
    if (!attentionRuntime?.running) closeAttentionTest();
    if ($("#missionOverlay")?.classList.contains("open")) dismissFirstMission();
  }
  if (event.code === "Space" && attentionRuntime?.running && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    registerAttentionTap();
  }
}

function handleDynamicAction(action, id) {
  const actions = {
    "open-start": () => openStartModal(id),
    "task-detail": () => openTaskDetail(id),
    "task-edit": () => openTaskModal(id),
    "task-done": () => toggleTaskDone(id),
    "pause-session": toggleSessionPause,
    "end-session": endSessionEarly,
    "skip-break": startNextBlock,
    "continue-blocks": continueAfterReward,
    "finish-session": finishSession,
    "attention-guide": openAttentionTest,
    "attention-start": beginAttentionTest,
    "attention-tap": registerAttentionTap,
    "attention-close": closeAttentionTest,
    "attention-again": openAttentionTest,
    "attention-continue": completeOnboardingFromBaseline,
    "dismiss-context-tip": () => dismissContextTip(id),
    "history-view": () => setView("history"),
  };
  actions[action]?.();
}

function setView(view, options = {}) {
  if (!validView(view)) return;
  state.activeView = view;
  saveState();
  renderNavigation();
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
  if (view === "focus") renderFocus();
  if (view === "progress") renderProgress();
  if (view === "history") renderHistory();
  renderContextTip(view);
  if (!options.preserveScroll) {
    window.scrollTo({ top: 0, behavior: options.instant || state.settings.reducedMotion ? "auto" : "smooth" });
  }
}

function validView(view) {
  return ["today", "focus", "plan", "rank", "progress", "history", "settings"].includes(view);
}

function renderAll() {
  renderNavigation();
  renderToday();
  renderFocus();
  renderPlan();
  renderRank();
  renderProgress();
  renderHistory();
  renderSettings();
  updateFeedbackBadge();
  renderContextTip(state.activeView);
}

function renderNavigation() {
  $$("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.activeView));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${state.activeView}`));
  const active = Boolean(state.currentSession && ["running", "break", "reward", "awaiting"].includes(state.currentSession.status));
  [$("#navFocusDot"), $("#bottomNavFocusDot")].forEach((dot) => {
    if (dot) dot.style.display = active ? "inline-block" : "none";
  });
}

const CONTEXT_TIPS = {
  focus: {
    eyebrow: "Protected work",
    title: "One session can contain several finish lines.",
    body: "Each completed block becomes a checkpoint. Pause when necessary; completed work remains evidence even if the full session is not finished.",
  },
  plan: {
    eyebrow: "Plan",
    title: "Decide the work before asking yourself to focus.",
    body: "Fixed tasks keep their time. Flexible tasks can be auto-arranged around them without changing what matters most.",
  },
  rank: {
    eyebrow: "Rank",
    title: "XP opens the gate; consistency earns the badge.",
    body: "Promotion also requires active days, completed blocks and recent consistency. Rank is permanent once every requirement is met.",
  },
  progress: {
    eyebrow: "Progress",
    title: "Compare patterns, not isolated days.",
    body: "Your first baseline stays visible beside your latest result. Use sessions, cadence and repeated checks together before changing your routine.",
  },
  history: {
    eyebrow: "History",
    title: "This is the evidence ledger.",
    body: "Completed and partial sessions remain visible so returning after a difficult block still counts as useful information.",
  },
  settings: {
    eyebrow: "Settings",
    title: "Your system and data remain under your control.",
    body: "Adjust the daily goal, reduce motion, change theme, and export a backup before moving to another device.",
  },
};

function renderContextTip(view) {
  $$(".context-tip").forEach((tip) => tip.remove());
  const tip = CONTEXT_TIPS[view];
  if (!tip || state.tipsSeen.includes(view) || $("#missionOverlay")?.classList.contains("open")) return;
  const section = $(`#view-${view}`);
  const topbar = section?.querySelector(".topbar");
  if (!section || !topbar) return;
  topbar.insertAdjacentHTML("afterend", `<aside class="context-tip" aria-label="${escapeHtml(tip.eyebrow)} guidance">
    <div class="context-tip-mark" aria-hidden="true">D</div>
    <div class="context-tip-copy"><div class="attention-kicker">${escapeHtml(tip.eyebrow)} · first encounter</div><strong>${escapeHtml(tip.title)}</strong><p>${escapeHtml(tip.body)}</p></div>
    <button class="btn btn-ghost" type="button" data-action="dismiss-context-tip" data-id="${escapeHtml(view)}">Understood</button>
  </aside>`);
}

function dismissContextTip(view) {
  if (!CONTEXT_TIPS[view]) return;
  if (!state.tipsSeen.includes(view)) state.tipsSeen.push(view);
  saveState();
  renderContextTip(view);
}

function resetContextTips() {
  state.tipsSeen = [];
  saveState();
  renderContextTip(state.activeView);
  showToast("Contextual guidance will appear again as you encounter each section.", "success");
}

function renderToday() {
  renderRankConsole("today");
  const tasks = todayTasks().filter((task) => !task.completed);
  const next = tasks[0];
  $("#todayNextTaskWrap").innerHTML = next
    ? renderTaskLine(next)
    : `<div class="empty-state"><h3>No next block yet</h3><p>Add one real task or protect an open focus session.</p></div>`;
  $("#startNextBlockBtn").textContent = state.currentSession ? "Return to current session" : next ? "Start next block" : "Start an open focus block";
  $("#todayPlanList").innerHTML = tasks.length
    ? tasks.map(renderTaskLine).join("")
    : `<div class="empty-state"><p>Today is clear. Add only what is worth protecting.</p></div>`;
}

function renderTaskLine(task) {
  const units = Array.from({ length: task.totalUnits }, (_, index) => `<i class="unit-dot ${index < task.completedUnits ? "filled" : ""}"></i>`).join("");
  return `<button class="task-line task-line-button" type="button" data-action="task-detail" data-id="${escapeHtml(task.id)}">
    <div class="task-line-content">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-meta">${escapeHtml(formatTaskTime(task))} · ${task.estimateMinutes} min · ${escapeHtml(capitalize(task.priority))}</div>
      <div class="unit-rail" aria-label="${task.completedUnits} of ${task.totalUnits} pieces complete">${units}</div>
    </div>
  </button>`;
}

function renderFocus() {
  const root = $("#focusRoot");
  const session = state.currentSession;
  if (!session) {
    root.innerHTML = `<div class="card empty-focus">
      <div class="attention-kicker">Protected work</div>
      <h2>No session is running.</h2>
      <p>Choose one finish line. DeeCadence will split the time into visible blocks and preserve progress on this device.</p>
      <button class="btn btn-primary" type="button" data-action="open-start">Start a focus session</button>
    </div>`;
    return;
  }

  const missionBanner = session.isFirstMission
    ? `<div class="mission-live-banner"><span>First recovery mission</span><strong>Stay with one task. DeeCadence will explain the evidence when the block ends.</strong></div>`
    : "";

  if (session.status === "break") {
    const remaining = currentBreakRemaining(session);
    root.innerHTML = `<div class="card focus-stage">${missionBanner}
      ${renderBlockPips(session)}
      ${renderTimerRing(remaining, BREAK_SECONDS, "Recovery")}
      <div class="focus-linked">Block ${session.completedBlocks} banked. Reset before returning to <b>${escapeHtml(session.task)}</b>.</div>
      <div class="focus-controls">
        <button class="btn btn-primary" type="button" data-action="skip-break">Start next block now</button>
        <button class="btn btn-ghost" type="button" data-action="end-session">Finish here</button>
      </div>
      <div class="recovery-note">Five minutes is the ceiling, not an obligation.</div>
    </div>`;
    return;
  }

  if (session.status === "awaiting" || session.status === "reward") {
    root.innerHTML = `<div class="card focus-stage">${missionBanner}
      ${renderBlockPips(session)}
      <div class="empty-focus"><h2>Block ${session.completedBlocks} is complete.</h2><p>Bank the result, then choose whether the next block still matters.</p>
      <button class="btn btn-primary" type="button" data-action="continue-blocks">Continue session</button></div>
    </div>`;
    return;
  }

  const duration = session.blockDurations[session.currentBlock];
  const remaining = currentSessionRemaining(session);
  root.innerHTML = `<div class="card focus-stage">${missionBanner}
    ${renderBlockPips(session)}
    ${renderTimerRing(remaining, duration, session.status === "paused" ? "Paused" : `Block ${session.currentBlock + 1} of ${session.blockCount}`)}
    <div class="focus-linked">Protecting: <b>${escapeHtml(session.task)}</b></div>
    <div class="focus-controls">
      <button class="btn btn-primary" type="button" data-action="pause-session">${session.status === "paused" ? "Resume block" : "Pause block"}</button>
      <button class="btn btn-ghost" type="button" data-action="end-session">End session</button>
    </div>
    <div class="recovery-note">${session.completedBlocks} of ${session.blockCount} blocks completed · +${session.xpEarned} XP</div>
  </div>`;
}

function renderTimerRing(remaining, total, caption) {
  const circumference = 2 * Math.PI * 46;
  const progress = total ? 1 - remaining / total : 0;
  return `<div class="timer-ring-wrap">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--surface-2)" stroke-width="4"/>
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--cyan)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - progress)}"/>
    </svg>
    <div class="timer-center"><div class="timer-digits mono">${formatClock(remaining)}</div><div class="timer-caption">${escapeHtml(caption)}</div></div>
  </div>`;
}

function renderBlockPips(session) {
  return `<div class="block-indicator" aria-label="${session.completedBlocks} of ${session.blockCount} blocks complete">${Array.from({ length: session.blockCount }, (_, index) => {
    const className = index < session.completedBlocks ? "done" : index === session.currentBlock ? "current" : "";
    return `<i class="block-pip ${className}"></i>`;
  }).join("")}</div>`;
}

function renderPlan() {
  $("#view-plan").dataset.planModeCurrent = state.planMode;
  $$("[data-plan-mode]").forEach((button) => button.classList.toggle("active", button.dataset.planMode === state.planMode));
  $$("[data-planview]").forEach((button) => button.classList.toggle("active", button.dataset.planview === state.planView));
  const tasks = filteredPlanTasks();
  $("#planList").innerHTML = tasks.length
    ? `<div class="task-list-stack">${tasks.map(renderTaskCard).join("")}</div>`
    : `<div class="card empty-state"><h3>Nothing in this view</h3><p>Add a task or change the time filter.</p></div>`;
}

function renderTaskCard(task) {
  return `<article class="task-card ${task.completed ? "is-complete" : ""}">
    <div class="task-row">
      <button class="task-check" type="button" data-action="task-done" data-id="${escapeHtml(task.id)}" aria-label="${task.completed ? "Reopen" : "Complete"} ${escapeHtml(task.title)}">${task.completed ? "✓" : ""}</button>
      <button class="task-row-main" type="button" data-action="task-detail" data-id="${escapeHtml(task.id)}">
        <div class="task-card-title">${escapeHtml(task.title)}</div>
        <div class="task-card-meta">${escapeHtml(formatTaskTime(task))} · ${task.estimateMinutes} min · ${task.completedUnits}/${task.totalUnits} pieces</div>
      </button>
      <div class="task-card-actions">
        <span class="priority-pill pri-${task.priority === "medium" ? "med" : task.priority}">${escapeHtml(task.priority)}</span>
        <button class="btn btn-secondary" type="button" data-action="open-start" data-id="${escapeHtml(task.id)}">Focus</button>
        <button class="btn btn-ghost" type="button" data-action="task-edit" data-id="${escapeHtml(task.id)}">Edit</button>
      </div>
    </div>
  </article>`;
}

function renderRank() {
  renderRankConsole("rank");
  const current = currentRank();
  const currentIndex = RANKS.findIndex((rank) => rank.code === current.code);
  $("#rankLadder").innerHTML = RANKS.map((rank, index) => {
    const next = RANKS[index + 1];
    const xpRange = next ? `${formatNumber(rank.minXp)}–${formatNumber(next.minXp - 1)} XP` : `${formatNumber(rank.minXp)} XP · open ended`;
    return `<article class="rank-tile ${index <= currentIndex ? "reached" : "locked"} ${current.code === rank.code ? "current" : ""}" style="--tile-rank-color:${rank.color}">
    <div class="letter" style="color:${rank.color}">${rank.code}</div>
    <div class="range">Lv ${rank.minLevel}<br>${xpRange}</div>
  </article>`;
  }).join("");
  renderRankReadiness();
}

function renderRankReadiness() {
  const current = currentRank();
  const currentIndex = RANKS.findIndex((rank) => rank.code === current.code);
  const next = RANKS[currentIndex + 1];
  const eyebrow = $("#rankGateEyebrow");
  const title = $("#rankGateTitle");
  const body = $("#rankGateBody");
  const grid = $("#rankGateGrid");
  if (!eyebrow || !title || !body || !grid) return;
  if (!next) {
    eyebrow.textContent = "Open-ended mastery";
    title.textContent = "L-Rank has no ceiling.";
    body.textContent = "Level 500 is the gate, not the finish. Each level beyond it costs more XP than the previous one.";
    grid.innerHTML = renderGateMetric("Total XP", state.totalXp, nextLevelXpTarget(), "XP");
    return;
  }
  const evidence = rankEvidence();
  eyebrow.textContent = `Next promotion · ${next.code}-Rank`;
  title.textContent = `${next.code}-Rank must be earned four ways.`;
  body.textContent = "XP proves volume. Active days prove return. Completed blocks prove closure. Recent consistency proves the pattern still exists.";
  grid.innerHTML = [
    renderGateMetric("Total XP", state.totalXp, next.minXp, "XP"),
    renderGateMetric("Active days", evidence.activeDays, next.minLevel, "days"),
    renderGateMetric("Blocks closed", evidence.completedBlocks, next.minLevel * 4, "blocks"),
    renderGateMetric("30-day consistency", evidence.consistency, next.minConsistency, "%"),
  ].join("");
}

function renderGateMetric(label, current, target, unit) {
  const complete = current >= target;
  const percent = Math.max(0, Math.min(100, target ? current / target * 100 : 100));
  const suffix = unit === "%" ? "%" : ` ${unit}`;
  return `<article class="rank-gate-metric ${complete ? "complete" : ""}">
    <div><span>${escapeHtml(label)}</span><b>${complete ? "Ready" : `${formatNumber(current)} / ${formatNumber(target)}${suffix}`}</b></div>
    <div class="rank-gate-track"><i style="width:${percent}%"></i></div>
  </article>`;
}

function renderRankConsole(target) {
  const rank = currentRank();
  const level = currentLevel();
  const start = levelStartXp(level);
  const end = levelEndXp(level);
  const percent = Math.max(0, Math.min(100, (state.totalXp - start) / Math.max(1, end - start) * 100));
  document.documentElement.style.setProperty("--rank-glow-color", rank.color);
  const prefix = target === "today" ? "today" : "rankPage";
  const letter = $(`#${prefix}${target === "today" ? "RankLetter" : "Letter"}`);
  const label = $(`#${prefix}${target === "today" ? "RankLabel" : "Label"}`);
  const levelNode = $(`#${prefix}Level`);
  if (letter) letter.textContent = rank.code;
  if (label) label.textContent = `${rank.code}-Rank · ${rank.label}`;
  if (levelNode) levelNode.textContent = `Level ${level}`;
  if (target === "today") {
    $("#todayXpFill").style.width = `${percent}%`;
    $("#todayOrbFill").style.strokeDasharray = String(2 * Math.PI * 42);
    $("#todayOrbFill").style.strokeDashoffset = String((2 * Math.PI * 42) * (1 - percent / 100));
    $("#todayXpCaption").textContent = `${state.totalXp - start} / ${end - start} XP to next level`;
  } else {
    $("#rankPageTotalXp").textContent = `${formatNumber(state.totalXp)} total XP`;
    $("#rankOrbFill").style.strokeDasharray = String(2 * Math.PI * 42);
    $("#rankOrbFill").style.strokeDashoffset = String((2 * Math.PI * 42) * (1 - percent / 100));
  }
}

function renderProgress() {
  const stats = progressStats();
  $("#statStreak").textContent = String(stats.streak);
  $("#statFocus7").textContent = formatMinutes(stats.focus7);
  $("#statCompletion").textContent = `${stats.completion}%`;
  $("#statConsistency").textContent = String(stats.consistency);
  $("#statBlocks").textContent = String(stats.totalBlocks);

  const maxMinutes = Math.max(1, ...stats.days7.map((day) => day.minutes));
  $("#progressChart").innerHTML = stats.days7.map((day) => `<div class="bar-col" title="${escapeHtml(day.fullLabel)}: ${day.minutes} minutes">
    <div class="bar" style="height:${Math.max(3, day.minutes / maxMinutes * 100)}%"></div>
    <div class="bar-day">${escapeHtml(day.label)}</div>
  </div>`).join("");

  const latest = state.attentionTests.at(-1);
  const best = state.attentionTests.length ? Math.max(...state.attentionTests.map((test) => test.score)) : null;
  const baselineDelta = latest && state.baselineScore !== null ? latest.score - state.baselineScore : null;
  const referenceDelta = latest ? latest.score - REFERENCE_BENCHMARK.score : null;
  const insight = buildProgressInsight(stats);

  $("#progressTaskSummary").innerHTML = `<div class="progress-intelligence">
    <div class="progress-detail-grid">
      <article><span>All-time focus</span><strong>${formatMinutes(stats.allTimeMinutes)}</strong></article>
      <article><span>Best day</span><strong>${escapeHtml(stats.bestDay)}</strong></article>
      <article><span>Average block</span><strong>${formatMinutes(stats.averageBlock)}</strong></article>
      <article><span>Goal days / 30</span><strong>${stats.goalDays30}</strong></article>
    </div>

    <section>
      <div class="progress-section-head"><div><div class="attention-kicker">Last 30 days</div><h3>Cadence map</h3></div><span>${stats.activeDays30} active days</span></div>
      <div class="heatmap-wrap"><div class="focus-heatmap">${stats.days30.map((day) => `<i class="heat-day ${day.key === todayKey() ? "is-today" : ""}" data-level="${day.level}" title="${escapeHtml(day.fullLabel)}: ${day.minutes} minutes"></i>`).join("")}</div></div>
    </section>

    <div class="progress-insight"><strong>${escapeHtml(insight.title)}</strong> ${escapeHtml(insight.body)}</div>

    <section class="baseline-card">
      <div class="baseline-card-head">
        <div><div class="attention-kicker">DeeCadence baseline</div><h3>${latest ? `${latest.score}/100 most recent score` : "Measure your starting point"}</h3><p>Your first result remains the benchmark. Repeat the same short selective-attention check under similar conditions to see a trend—not to diagnose yourself.</p></div>
        <button class="btn btn-primary" type="button" data-action="attention-guide">${latest ? "Run again" : "Read rules & start"}</button>
      </div>
      <div class="baseline-metrics">
        <div><span>Starting score</span><strong>${state.baselineScore ?? "—"}</strong></div>
        <div><span>Latest score</span><strong>${latest?.score ?? "—"}</strong></div>
        <div><span>From baseline</span><strong>${baselineDelta === null ? "—" : `${baselineDelta >= 0 ? "+" : ""}${baselineDelta}`}</strong></div>
        <div><span>Reference average*</span><strong>${REFERENCE_BENCHMARK.score}</strong></div>
        <div><span>Vs reference</span><strong>${referenceDelta === null ? "—" : `${referenceDelta >= 0 ? "+" : ""}${referenceDelta}`}</strong></div>
        <div><span>Personal best</span><strong>${best ?? "—"}</strong></div>
      </div>
      <p class="benchmark-disclaimer">*Provisional internal launch calibration—not a clinical or population norm. It should be replaced by the consented DeeCadence cohort median when enough comparable results exist.</p>
    </section>

    <button class="btn btn-secondary" type="button" data-action="history-view">Review full session history</button>
  </div>`;
}

function renderHistory() {
  const sorted = [...state.sessions].sort((a, b) => new Date(b.start) - new Date(a.start));
  $("#historyList").innerHTML = sorted.length ? sorted.map((session) => `<article class="history-item">
    <div class="history-icon">${session.blocksCompleted}/${session.totalBlocks}</div>
    <div class="history-main"><div class="history-title">${escapeHtml(session.task)}</div><div class="history-sub">${escapeHtml(formatDateTime(session.start))} · ${formatMinutes(session.durationMinutes)} · ${session.status}</div></div>
    <div class="history-xp">+${session.xpEarned} XP</div>
  </article>`).join("") : `<div class="empty-state"><h3>No completed sessions yet</h3><p>Your first protected block will appear here.</p></div>`;
}

function renderSettings() {
  $("#soundSwitch").classList.toggle("on", state.settings.sound);
  $("#soundSwitch").setAttribute("aria-pressed", String(state.settings.sound));
  $("#motionSwitch").classList.toggle("on", state.settings.reducedMotion);
  $("#motionSwitch").setAttribute("aria-pressed", String(state.settings.reducedMotion));
  $("#dailyGoalSelect").value = String(state.settings.dailyGoal);
  $$("[data-theme-choice]").forEach((button) => button.classList.toggle("active", button.dataset.themeChoice === state.theme));
  updateFeedbackDeliveryCopy();
}

function progressStats() {
  const days7 = buildDailySeries(7);
  const days30 = buildDailySeries(30);
  const focus7 = days7.reduce((sum, day) => sum + day.minutes, 0);
  const allTimeMinutes = state.sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const totalBlocks = state.sessions.reduce((sum, session) => sum + session.blocksCompleted, 0);
  const totalPossible = state.sessions.reduce((sum, session) => sum + session.totalBlocks, 0);
  const completion = totalPossible ? Math.round(totalBlocks / totalPossible * 100) : 0;
  const activeDays30 = days30.filter((day) => day.minutes > 0).length;
  const goalDays30 = days30.filter((day) => day.minutes >= state.settings.dailyGoal).length;
  const consistency = Math.round((activeDays30 / 30 * 55) + (goalDays30 / 30 * 45));
  const best = days30.reduce((winner, day) => day.minutes > winner.minutes ? day : winner, { minutes: 0, fullLabel: "—" });
  return {
    days7,
    days30,
    focus7,
    allTimeMinutes,
    totalBlocks,
    completion,
    consistency,
    activeDays30,
    goalDays30,
    streak: calculateStreak(),
    bestDay: best.minutes ? best.fullLabel.split(",")[0] : "—",
    averageBlock: totalBlocks ? Math.round(allTimeMinutes / totalBlocks) : 0,
  };
}

function buildDailySeries(count) {
  const totals = new Map();
  state.sessions.forEach((session) => {
    const key = localDateKey(session.start);
    totals.set(key, (totals.get(key) || 0) + session.durationMinutes);
  });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - index));
    const key = dateKey(date);
    const minutes = Math.round(totals.get(key) || 0);
    return {
      key,
      minutes,
      level: minutes === 0 ? 0 : minutes < 15 ? 1 : minutes < 30 ? 2 : minutes < 60 ? 3 : 4,
      label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
      fullLabel: date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
    };
  });
}

function buildProgressInsight(stats) {
  if (!state.sessions.length) return { title: "Start with evidence.", body: "Complete one block. DeeCadence needs real sessions before it can identify your rhythm." };
  if (stats.consistency >= 75) return { title: "Your rhythm is becoming reliable.", body: "The next risk is volume inflation. Keep the daily goal realistic enough to survive difficult weeks." };
  if (stats.activeDays30 >= 10 && stats.goalDays30 < 5) return { title: "You return often, but blocks are short.", body: "Protect one longer block on your strongest day instead of forcing every day to carry equal weight." };
  if (stats.activeDays30 < 5) return { title: "Frequency is the bottleneck.", body: "A smaller daily floor will produce better data than occasional heroic sessions." };
  return { title: "The system has a pulse.", body: "Keep sessions comparable for another week; then use the cadence map and baseline trend to change one variable at a time." };
}

function openStartModal(taskId = "") {
  if (state.currentSession) {
    closeTaskDetail();
    closeStartModal();
    setView("focus");
    showToast("Your current session is still available.");
    return;
  }
  selectedTaskId = taskId || todayTasks().find((task) => !task.completed)?.id || "";
  selectedDuration = 25;
  selectedBlockCount = 4;
  selectedTaskSource = selectedTaskId ? "schedule" : "input";
  renderStartModalControls();
  closeTaskDetail();
  openModal("#startModal");
}

function renderStartModalControls() {
  $$("[data-min]").forEach((button) => button.classList.toggle("active", String(selectedDuration) === button.dataset.min));
  $$("[data-block-count]").forEach((button) => button.classList.toggle("active", Number(button.dataset.blockCount) === selectedBlockCount));
  $$("[data-start-source]").forEach((button) => button.classList.toggle("active", button.dataset.startSource === selectedTaskSource));
  $("#customMinWrap").style.display = selectedDuration === "custom" ? "flex" : "none";
  $("#scheduleTaskField").style.display = selectedTaskSource === "schedule" ? "flex" : "none";
  $("#inputTaskField").style.display = selectedTaskSource === "input" ? "flex" : "none";
  const available = state.tasks.filter((task) => !task.completed);
  $("#linkTaskSelect").innerHTML = available.length
    ? available.map((task) => `<option value="${escapeHtml(task.id)}" ${task.id === selectedTaskId ? "selected" : ""}>${escapeHtml(task.title)}</option>`).join("")
    : `<option value="">No open scheduled tasks</option>`;
  if (!selectedTaskId && available[0]) selectedTaskId = available[0].id;
  $("#startTaskSourceHint").textContent = selectedTaskSource === "schedule" ? "Progress will move with the linked task." : "Use a task that is not on your schedule.";
  $("#blockCountHint").textContent = `${selectedBlockCount} block${selectedBlockCount === 1 ? "" : "s"}; each completed block earns XP and creates a checkpoint.`;
}

function selectDuration(value) {
  selectedDuration = value === "custom" ? "custom" : Number(value);
  renderStartModalControls();
}

function selectBlockCount(value) {
  selectedBlockCount = clampNumber(value, 1, 4, 4);
  renderStartModalControls();
}

function selectTaskSource(value) {
  selectedTaskSource = value === "input" ? "input" : "schedule";
  renderStartModalControls();
}

function startSessionFromModal() {
  const minutes = selectedDuration === "custom" ? Number($("#customMinInput").value) : Number(selectedDuration);
  if (!Number.isFinite(minutes) || minutes < 4 || minutes > 240) return showToast("Choose 4–240 minutes.", "error");
  if (selectedTaskSource === "schedule") selectedTaskId = $("#linkTaskSelect").value;
  const linkedTask = state.tasks.find((task) => task.id === selectedTaskId);
  const inputTitle = $("#inputTaskTitle").value.trim();
  const task = selectedTaskSource === "schedule" ? linkedTask?.title : inputTitle;
  if (!task) return showToast("Choose or enter one task.", "error");

  const totalSeconds = Math.round(minutes * 60);
  const base = Math.floor(totalSeconds / selectedBlockCount);
  const blockDurations = Array.from({ length: selectedBlockCount }, (_, index) => base + (index === selectedBlockCount - 1 ? totalSeconds - base * selectedBlockCount : 0));
  state.currentSession = {
    id: uid("session"),
    task,
    taskId: linkedTask?.id || "",
    totalMinutes: minutes,
    blockCount: selectedBlockCount,
    blockDurations,
    currentBlock: 0,
    completedBlocks: 0,
    remainingSeconds: blockDurations[0],
    status: "running",
    endAt: Date.now() + blockDurations[0] * 1000,
    breakEndAt: null,
    startedAt: new Date().toISOString(),
    xpEarned: 0,
    blockFeedback: [],
  };
  closeStartModal();
  saveState();
  setView("focus");
  renderAll();
}

function closeStartModal() { closeModal("#startModal"); }

function startNextTask() {
  if (state.currentSession) return setView("focus");
  const next = todayTasks().find((task) => !task.completed);
  openStartModal(next?.id || "");
}

function toggleSessionPause() {
  const session = state.currentSession;
  if (!session) return;
  if (session.status === "running") {
    session.remainingSeconds = currentSessionRemaining(session);
    session.endAt = null;
    session.status = "paused";
  } else if (session.status === "paused") {
    session.endAt = Date.now() + session.remainingSeconds * 1000;
    session.status = "running";
  }
  saveState();
  renderFocus();
}

function currentSessionRemaining(session) {
  if (session.status === "running" && session.endAt) return Math.max(0, Math.ceil((session.endAt - Date.now()) / 1000));
  return Math.max(0, Number(session.remainingSeconds || 0));
}

function currentBreakRemaining(session) {
  if (session.status === "break" && session.breakEndAt) return Math.max(0, Math.ceil((session.breakEndAt - Date.now()) / 1000));
  return BREAK_SECONDS;
}

function startTimerLoop() {
  window.clearInterval(timerHandle);
  timerHandle = window.setInterval(() => {
    const session = state.currentSession;
    if (!session) return;
    if (session.status === "running") {
      const remaining = currentSessionRemaining(session);
      session.remainingSeconds = remaining;
      if (remaining <= 0) completeBlock();
      else if (state.activeView === "focus") renderFocus();
    } else if (session.status === "break") {
      if (currentBreakRemaining(session) <= 0) startNextBlock();
      else if (state.activeView === "focus") renderFocus();
    }
  }, 1000);
}

function recoverRunningSession() {
  const session = state.currentSession;
  if (!session) return;
  if (session.status === "running" && currentSessionRemaining(session) <= 0) completeBlock();
  if (session.status === "break" && currentBreakRemaining(session) <= 0) startNextBlock();
}

function completeBlock() {
  const session = state.currentSession;
  if (!session || session.status !== "running") return;
  const seconds = session.blockDurations[session.currentBlock];
  const xp = Math.max(5, Math.round(seconds / 60)) + (session.currentBlock === session.blockCount - 1 ? 5 : 0);
  session.completedBlocks += 1;
  session.remainingSeconds = 0;
  session.endAt = null;
  session.xpEarned += xp;
  session.status = "reward";
  state.totalXp += xp;
  advanceLinkedTask(session.taskId);
  selectedBlockFeeling = "";
  saveState();
  showRewardReveal(xp);
  if (state.settings.sound) playCompletionChime();
  renderAll();
}

function showRewardReveal(xp) {
  const session = state.currentSession;
  const rank = currentRank();
  $("#revealLevel").textContent = `Lv ${currentLevel()}`;
  $("#revealRankName").textContent = `${rank.code}-Rank`;
  $("#revealXpGained").textContent = `+${xp} XP`;
  $("#revealRemaining").textContent = `${Math.max(0, levelEndXp(currentLevel()) - state.totalXp)} XP to next level`;
  $("#revealTaskLine").textContent = `${session.task} · Block ${session.completedBlocks} of ${session.blockCount}`;
  $("#revealFlags").innerHTML = session.isFirstMission
    ? `<div class="mission-evidence"><div><span>Focused time</span><strong>${session.totalMinutes} min banked</strong></div><div><span>Progress</span><strong>1 block closed</strong></div><div><span>Rank evidence</span><strong>+${xp} XP recorded</strong></div></div>`
    : session.completedBlocks === session.blockCount ? `<div class="reveal-flag">Full session cleared</div>` : "";
  $("#blockFeedbackNote").value = "";
  $$("[data-block-feeling]").forEach((button) => button.classList.remove("active"));
  $("#revealActions").innerHTML = session.completedBlocks >= session.blockCount
    ? `<button class="btn btn-primary" type="button" data-action="finish-session">${session.isFirstMission ? "Save and open my dashboard" : "Finish and save session"}</button>`
    : `<button class="btn btn-primary" type="button" data-action="continue-blocks">Take recovery break</button><button class="btn btn-ghost" type="button" data-action="finish-session">Stop and save here</button>`;
  $("#revealOverlay").classList.add("open");
  setModalState();
}

function selectBlockFeedback(feeling) {
  selectedBlockFeeling = feeling;
  $$("[data-block-feeling]").forEach((button) => button.classList.toggle("active", button.dataset.blockFeeling === feeling));
}

function storeBlockFeedback() {
  const session = state.currentSession;
  if (!session) return;
  session.blockFeedback.push({
    block: session.completedBlocks,
    feeling: selectedBlockFeeling,
    note: $("#blockFeedbackNote").value.trim().slice(0, 120),
  });
}

function continueAfterReward() {
  const session = state.currentSession;
  if (!session) return;
  storeBlockFeedback();
  $("#revealOverlay").classList.remove("open");
  session.status = "break";
  session.breakEndAt = Date.now() + BREAK_SECONDS * 1000;
  session.currentBlock = session.completedBlocks;
  saveState();
  setModalState();
  renderAll();
}

function startNextBlock() {
  const session = state.currentSession;
  if (!session) return;
  if (session.completedBlocks >= session.blockCount) return finishSession();
  session.currentBlock = session.completedBlocks;
  session.remainingSeconds = session.blockDurations[session.currentBlock];
  session.status = "running";
  session.breakEndAt = null;
  session.endAt = Date.now() + session.remainingSeconds * 1000;
  saveState();
  renderAll();
}

function endSessionEarly() {
  if (!state.currentSession) return;
  if (!window.confirm("End this session and save the completed work?")) return;
  finishSession();
}

function finishSession() {
  const session = state.currentSession;
  if (!session) return;
  if ($("#revealOverlay").classList.contains("open")) storeBlockFeedback();
  const completedSeconds = session.blockDurations.slice(0, session.completedBlocks).reduce((sum, value) => sum + value, 0);
  const partialSeconds = session.status === "running" || session.status === "paused"
    ? Math.max(0, session.blockDurations[session.currentBlock] - currentSessionRemaining(session))
    : 0;
  const durationMinutes = Math.max(0, Math.round((completedSeconds + partialSeconds) / 60));
  if (durationMinutes > 0 || session.completedBlocks > 0) {
    state.sessions.push({
      id: session.id,
      start: session.startedAt,
      end: new Date().toISOString(),
      durationMinutes,
      blocksCompleted: session.completedBlocks,
      totalBlocks: session.blockCount,
      xpEarned: session.xpEarned,
      task: session.task,
      taskId: session.taskId,
      status: session.completedBlocks >= session.blockCount ? "complete" : "partial",
      blockFeedback: session.blockFeedback,
    });
    state.sessions = state.sessions.slice(-3000);
  }
  const unlockedRank = evaluateRankUnlock();
  const completedFirstMission = Boolean(session.isFirstMission && session.completedBlocks >= session.blockCount);
  if (completedFirstMission) {
    state.missionCompleted = true;
    state.missionDismissed = false;
    if (!state.tipsSeen.includes("focus")) state.tipsSeen.push("focus");
  }
  state.currentSession = null;
  $("#revealOverlay").classList.remove("open");
  saveState();
  setModalState();
  renderAll();
  setView("today");
  showToast(
    unlockedRank
      ? `${unlockedRank.code}-Rank earned. The gate is permanent.`
      : completedFirstMission ? "First mission complete. Your evidence is now saved." : "Session saved. The evidence is now in Progress.",
    "success",
  );
}

function advanceLinkedTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.progressType === "ongoing") return;
  task.completedUnits = Math.min(task.totalUnits, task.completedUnits + 1);
  task.completed = task.completedUnits >= task.totalUnits;
}

function openTaskModal(taskId = "") {
  editingTaskId = taskId;
  const task = state.tasks.find((item) => item.id === taskId);
  $("#taskModalTitle").textContent = task ? "Edit task" : "Add task";
  $("#taskTitleInput").value = task?.title || "";
  $("#taskDateInput").value = task?.date || todayKey();
  $("#taskTimeInput").value = task?.time || "";
  $("#taskDurationInput").value = String(task?.estimateMinutes || 45);
  $("#taskPriorityInput").value = task?.priority || "high";
  $("#taskUnitsInput").value = String(task?.totalUnits || 4);
  $("#taskFlexInput").value = task?.flex || "flexible";
  $("#taskNotesInput").value = task?.notes || "";
  selectProgressType(task?.progressType || "countable");
  closeTaskDetail();
  openModal("#taskModal");
}

function selectProgressType(type) {
  const selected = type === "ongoing" ? "ongoing" : "countable";
  $$("[data-progress-type]").forEach((button) => button.classList.toggle("active", button.dataset.progressType === selected));
  $("#taskUnitsFieldWrap").style.display = selected === "countable" ? "flex" : "none";
  $("#progressTypeSeg").dataset.selected = selected;
  $("#progressTypeHint").textContent = selected === "countable" ? "Each completed focus block advances one piece." : "Time is recorded without forcing a finish count.";
}

function saveTaskFromModal() {
  const title = $("#taskTitleInput").value.trim();
  if (!title) return showToast("Give the task a clear title.", "error");
  const existing = state.tasks.find((item) => item.id === editingTaskId);
  const totalUnits = Number($("#taskUnitsInput").value) || 4;
  const data = {
    id: existing?.id || uid("task"),
    title: title.slice(0, 120),
    date: $("#taskDateInput").value || todayKey(),
    time: $("#taskTimeInput").value,
    estimateMinutes: clampNumber($("#taskDurationInput").value, 5, 480, 45),
    priority: normalizePriority($("#taskPriorityInput").value),
    notes: $("#taskNotesInput").value.trim().slice(0, 1000),
    progressType: $("#progressTypeSeg").dataset.selected || "countable",
    totalUnits,
    completedUnits: Math.min(existing?.completedUnits || 0, totalUnits),
    flex: $("#taskFlexInput").value === "fixed" ? "fixed" : "flexible",
    completed: existing?.completed || false,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  if (existing) Object.assign(existing, data);
  else state.tasks.push(data);
  closeTaskModal();
  saveAndRender();
  showToast(existing ? "Task updated." : "Task added.", "success");
}

function closeTaskModal() { closeModal("#taskModal"); }

function openTaskDetail(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  detailTaskId = id;
  $("#taskDetailBody").innerHTML = `<div class="task-detail-head"><div><div class="attention-kicker">${escapeHtml(task.priority)} priority</div><h3 id="taskDetailTitle">${escapeHtml(task.title)}</h3></div></div>
    <div class="task-detail-grid">
      <div><span>Date</span><strong>${escapeHtml(formatDateKey(task.date))}</strong></div>
      <div><span>Time</span><strong>${escapeHtml(task.time || "Flexible")}</strong></div>
      <div><span>Estimate</span><strong>${task.estimateMinutes} min</strong></div>
      <div><span>Progress</span><strong>${task.completedUnits}/${task.totalUnits}</strong></div>
    </div>
    ${task.notes ? `<div class="task-detail-notes"><span>Notes</span><p>${escapeHtml(task.notes)}</p></div>` : ""}`;
  $("#taskDetailDone").textContent = task.completed ? "Reopen" : "Mark done";
  openModal("#taskDetailModal");
}

function closeTaskDetail() { closeModal("#taskDetailModal"); }

function toggleTaskDone(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedUnits = task.completed ? task.totalUnits : Math.min(task.completedUnits, Math.max(0, task.totalUnits - 1));
  closeTaskDetail();
  saveAndRender();
}

function deleteTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || !window.confirm(`Delete “${task.title}”?`)) return;
  state.tasks = state.tasks.filter((item) => item.id !== id);
  closeTaskDetail();
  saveAndRender();
}

function autoArrangeToday() {
  const tasks = todayTasks().filter((task) => !task.completed && task.flex === "flexible");
  if (!tasks.length) return showToast("No flexible tasks need arranging.");
  let cursor = Math.max(9 * 60, Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15);
  tasks.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
  tasks.forEach((task) => {
    task.time = `${String(Math.floor(cursor / 60) % 24).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
    cursor += Math.max(15, task.estimateMinutes);
  });
  saveAndRender();
  showToast("Today’s flexible tasks were arranged by priority.", "success");
}

function filteredPlanTasks() {
  const today = new Date(`${todayKey()}T12:00:00`);
  return [...state.tasks].filter((task) => {
    if (state.planView === "pending") return !task.completed && task.date < todayKey();
    if (state.planView === "week") {
      const date = new Date(`${task.date}T12:00:00`);
      const days = Math.floor((date - today) / 86400000);
      return days >= 0 && days < 7;
    }
    return task.date === todayKey();
  }).sort(taskSort);
}

function todayTasks() { return state.tasks.filter((task) => task.date === todayKey()).sort(taskSort); }

function openWelcome() {
  $("#welcomeOverlay").classList.add("open");
  $("#welcomeOverlay").setAttribute("aria-hidden", "false");
  setModalState();
}

function startOnboardingBaseline() {
  openAttentionTest({ origin: "onboarding" });
}

function completeOnboarding() {
  state.welcomeSeen = true;
  state.onboardingVersion = ONBOARDING_VERSION;
  $("#welcomeOverlay").classList.remove("open");
  $("#welcomeOverlay").setAttribute("aria-hidden", "true");
  saveState();
  setModalState();
  setView("today", { instant: true });
  window.setTimeout(openFirstMission, 220);
}

function completeOnboardingFromBaseline() {
  window.clearTimeout(attentionTimer);
  attentionRuntime = null;
  attentionOrigin = "progress";
  closeModal("#attentionTestModal");
  completeOnboarding();
}

function openFirstMission() {
  if (state.currentSession) {
    setView("focus");
    showToast("Finish or save the current session before starting another mission.");
    return;
  }
  selectedMissionMinutes = 2;
  $("#missionTaskInput").value = "";
  selectMissionDuration(selectedMissionMinutes);
  $("#missionOverlay").classList.add("open");
  $("#missionOverlay").setAttribute("aria-hidden", "false");
  setModalState();
  window.setTimeout(() => $("#missionTaskInput").focus({ preventScroll: true }), 80);
}

function dismissFirstMission() {
  state.missionDismissed = true;
  $("#missionOverlay").classList.remove("open");
  $("#missionOverlay").setAttribute("aria-hidden", "true");
  saveState();
  setModalState();
  setView("today", { instant: true });
  showToast("The first recovery mission remains available in Settings.");
}

function selectMissionDuration(minutes) {
  selectedMissionMinutes = [2, 5, 15, 25].includes(minutes) ? minutes : 2;
  $$('[data-mission-minutes]').forEach((button) => button.classList.toggle("active", Number(button.dataset.missionMinutes) === selectedMissionMinutes));
}

function startFirstMission() {
  if (state.currentSession) return dismissFirstMission();
  const title = $("#missionTaskInput").value.trim();
  if (!title) {
    $("#missionTaskInput").focus();
    return showToast("Name one real task before starting.", "error");
  }
  const task = {
    id: uid("task"),
    title: title.slice(0, 90),
    date: todayKey(),
    time: "",
    estimateMinutes: selectedMissionMinutes,
    priority: "high",
    notes: "First Recovery Mission",
    progressType: "countable",
    totalUnits: 1,
    completedUnits: 0,
    flex: "flexible",
    completed: false,
    createdAt: new Date().toISOString(),
  };
  state.tasks.push(task);
  const seconds = selectedMissionMinutes * 60;
  state.currentSession = {
    id: uid("session"),
    task: task.title,
    taskId: task.id,
    totalMinutes: selectedMissionMinutes,
    blockCount: 1,
    blockDurations: [seconds],
    currentBlock: 0,
    completedBlocks: 0,
    remainingSeconds: seconds,
    status: "running",
    endAt: Date.now() + seconds * 1000,
    breakEndAt: null,
    startedAt: new Date().toISOString(),
    xpEarned: 0,
    blockFeedback: [],
    isFirstMission: true,
  };
  state.missionDismissed = false;
  if (!state.tipsSeen.includes("focus")) state.tipsSeen.push("focus");
  $("#missionOverlay").classList.remove("open");
  $("#missionOverlay").setAttribute("aria-hidden", "true");
  saveState();
  setModalState();
  setView("focus", { instant: true });
  renderAll();
  showToast("Mission started. Stay with one task until the block ends.", "success");
}

const TOUR_STEPS = [
  { view: "today", selector: '[data-tour="next-block"]', title: "Keep the next action obvious", body: "One task stays in front. The rest of the plan remains available without competing for attention." },
  { view: "focus", selector: '[data-tour="focus-root"]', title: "Protect one block", body: "The timer survives tab changes and screen rotation because the end time—not a fragile counter—is stored." },
  { view: "plan", selector: '[data-tour="plan-controls"]', title: "Shape the work before starting", body: "Add the work that matters, then schedule it. Flexible tasks can move; fixed commitments stay put." },
  { view: "today", selector: '[data-tour="today-rank"]', title: "Rank is evidence, not decoration", body: "Completed focus minutes become XP. Promotion also requires active days, completed blocks, and recent consistency." },
  { view: "progress", selector: ".baseline-card", title: "Your starting score stays visible", body: "Progress keeps your first baseline, latest score, provisional reference average, and trend together. Compare repeated checks—not one isolated result." },
  { view: "settings", selector: "#exportBackupBtn", title: "Your data remains yours", body: "Export a complete backup before changing devices or clearing browser storage." },
];

function startTour() {
  tourRenderToken += 1;
  tourStep = 0;
  tourTransitioning = false;
  tourPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  $("#tourOverlay").classList.add("open");
  $("#tourOverlay").setAttribute("aria-hidden", "false");
  $("#tourCard").classList.remove("is-positioned");
  renderTourStep();
  setModalState();
}

async function renderTourStep() {
  const token = ++tourRenderToken;
  const step = TOUR_STEPS[tourStep];
  tourTransitioning = true;
  setTourButtonsDisabled(true);
  setView(step.view, { instant: true });
  $$(".tour-highlight").forEach((node) => node.classList.remove("tour-highlight"));
  $("#tourCard").classList.remove("is-positioned");
  $("#tourCount").textContent = `Step ${tourStep + 1} of ${TOUR_STEPS.length}`;
  $("#tourProgress").innerHTML = TOUR_STEPS.map((_, index) => `<i class="${index === tourStep ? "active" : index < tourStep ? "done" : ""}"></i>`).join("");
  $("#tourTitle").textContent = step.title;
  $("#tourBody").textContent = step.body;
  $("#tourBackBtn").disabled = tourStep === 0;
  $("#tourNextBtn").textContent = tourStep === TOUR_STEPS.length - 1 ? "Finish" : "Next";

  await nextPaint(2);
  if (token !== tourRenderToken || !$("#tourOverlay").classList.contains("open")) return;

  const target = findTourTarget(step);
  target.classList.add("tour-highlight");
  $("#tourOverlay").dataset.mode = getTourLayoutMode();
  await scrollTargetIntoTourZone(target);
  if (token !== tourRenderToken || !$("#tourOverlay").classList.contains("open")) return;

  layoutTour(target);
  tourTransitioning = false;
  setTourButtonsDisabled(false);
  $("#tourBackBtn").disabled = tourStep === 0;
  $("#tourTitle").setAttribute("tabindex", "-1");
  $("#tourTitle").focus({ preventScroll: true });
}

function positionTour() {
  scheduleTourLayout();
}

function changeTourStep(delta) {
  if (tourTransitioning) return;
  if (delta > 0 && tourStep === TOUR_STEPS.length - 1) return finishTour();
  tourStep = Math.max(0, Math.min(TOUR_STEPS.length - 1, tourStep + delta));
  renderTourStep();
}

function finishTour() {
  tourRenderToken += 1;
  tourTransitioning = false;
  window.cancelAnimationFrame(tourLayoutRaf);
  state.tourSeen = true;
  $$(".tour-highlight").forEach((node) => node.classList.remove("tour-highlight"));
  $("#tourOverlay").classList.remove("open");
  $("#tourOverlay").setAttribute("aria-hidden", "true");
  $("#tourOverlay").removeAttribute("data-mode");
  $("#tourCard").classList.remove("is-positioned");
  clearTourInlineStyles();
  saveState();
  setModalState();
  setView("today", { instant: true });
  tourPreviousFocus?.focus?.({ preventScroll: true });
  tourPreviousFocus = null;
}

function setTourButtonsDisabled(disabled) {
  $("#tourNextBtn").disabled = disabled;
  $("#tourBackBtn").disabled = disabled || tourStep === 0;
}

function findTourTarget(step) {
  const preferred = $(step.selector);
  if (preferred && preferred.getClientRects().length !== 0) return preferred;
  return $(`#view-${step.view}`) || $("main") || document.body;
}

function nextPaint(frames = 1) {
  return new Promise((resolve) => {
    const tick = (remaining) => window.requestAnimationFrame(() => remaining <= 1 ? resolve() : tick(remaining - 1));
    tick(frames);
  });
}

function getTourViewport() {
  const visual = window.visualViewport;
  const left = visual?.offsetLeft || 0;
  const top = visual?.offsetTop || 0;
  const width = visual?.width || window.innerWidth;
  const height = visual?.height || window.innerHeight;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function getTourLayoutMode() {
  const viewport = getTourViewport();
  if (viewport.width <= 860 && viewport.width > viewport.height && viewport.height <= 620) return "side-sheet";
  if (viewport.width <= 860) return "bottom-sheet";
  return "floating";
}

function isCompactTourViewport() {
  return getTourLayoutMode() !== "floating";
}

async function scrollTargetIntoTourZone(target) {
  const viewport = getTourViewport();
  const mode = getTourLayoutMode();
  const card = $("#tourCard");
  const cardHeight = Math.min(card.scrollHeight || 280, viewport.height * 0.55);
  const compactBottomGap = 92;
  const safeTop = viewport.top + 18;
  const safeBottom = mode === "bottom-sheet"
    ? Math.max(safeTop + 100, viewport.bottom - cardHeight - compactBottomGap - 18)
    : viewport.bottom - 24;
  const rect = target.getBoundingClientRect();
  const targetTop = rect.top + viewport.top;
  const targetBottom = rect.bottom + viewport.top;
  const targetCenter = (targetTop + targetBottom) / 2;
  const safeCenter = (safeTop + safeBottom) / 2;
  const targetFits = targetTop >= safeTop && targetBottom <= safeBottom;
  if (targetFits || !Number.isFinite(targetCenter)) return;

  const delta = targetCenter - safeCenter;
  if (Math.abs(delta) < 4) return;
  const behavior = state.settings.reducedMotion ? "auto" : "smooth";
  window.scrollBy({ top: delta, left: 0, behavior });
  await waitForScrollEnd(behavior === "smooth" ? 520 : 40);
}

function waitForScrollEnd(maxWait) {
  return new Promise((resolve) => {
    let settleTimer = 0;
    const finish = () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallback);
      window.removeEventListener("scroll", onScroll);
      resolve();
    };
    const onScroll = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(finish, 90);
    };
    const fallback = window.setTimeout(finish, maxWait);
    window.addEventListener("scroll", onScroll, { passive: true });
  });
}

function chooseTourPlacement(targetRect, cardSize, viewport) {
  const gap = 18;
  const pad = 16;
  const minLeft = viewport.left + pad;
  const maxLeft = viewport.right - cardSize.width - pad;
  const minTop = viewport.top + pad;
  const maxTop = viewport.bottom - cardSize.height - pad;
  const clampX = (value) => Math.max(minLeft, Math.min(maxLeft, value));
  const clampY = (value) => Math.max(minTop, Math.min(maxTop, value));
  const candidates = [
    { placement: "right", fits: targetRect.right + gap + cardSize.width <= viewport.right - pad, left: targetRect.right + gap, top: clampY(targetRect.top) },
    { placement: "left", fits: targetRect.left - gap - cardSize.width >= viewport.left + pad, left: targetRect.left - gap - cardSize.width, top: clampY(targetRect.top) },
    { placement: "bottom", fits: targetRect.bottom + gap + cardSize.height <= viewport.bottom - pad, left: clampX(targetRect.left), top: targetRect.bottom + gap },
    { placement: "top", fits: targetRect.top - gap - cardSize.height >= viewport.top + pad, left: clampX(targetRect.left), top: targetRect.top - gap - cardSize.height },
  ];
  const winner = candidates.find((candidate) => candidate.fits);
  if (winner) return winner;
  return {
    placement: "center",
    left: clampX(viewport.left + (viewport.width - cardSize.width) / 2),
    top: clampY(viewport.top + (viewport.height - cardSize.height) / 2),
  };
}

function layoutTour(target = findTourTarget(TOUR_STEPS[tourStep])) {
  if (!$("#tourOverlay").classList.contains("open") || !target) return;
  const overlay = $("#tourOverlay");
  const card = $("#tourCard");
  const spotlight = $("#tourSpotlight");
  const viewport = getTourViewport();
  const mode = getTourLayoutMode();
  const compact = mode !== "floating";
  overlay.dataset.mode = mode;

  card.classList.remove("is-positioned");
  if (compact) {
    card.style.removeProperty("left");
    card.style.removeProperty("top");
    card.dataset.placement = mode;
  } else {
    card.style.right = "auto";
    card.style.bottom = "auto";
    const measured = card.getBoundingClientRect();
    const cardSize = { width: measured.width || 360, height: measured.height || 260 };
    const placement = chooseTourPlacement(target.getBoundingClientRect(), cardSize, viewport);
    card.dataset.placement = placement.placement;
    card.style.left = `${Math.round(placement.left)}px`;
    card.style.top = `${Math.round(placement.top)}px`;
  }

  const rect = target.getBoundingClientRect();
  const spotlightPad = compact ? 6 : 9;
  const spotLeft = Math.max(viewport.left + 4, rect.left - spotlightPad);
  const spotTop = Math.max(viewport.top + 4, rect.top - spotlightPad);
  const spotRight = Math.min(viewport.right - 4, rect.right + spotlightPad);
  const spotBottom = Math.min(viewport.bottom - 4, rect.bottom + spotlightPad);
  spotlight.style.left = `${Math.round(spotLeft)}px`;
  spotlight.style.top = `${Math.round(spotTop)}px`;
  spotlight.style.width = `${Math.max(0, Math.round(spotRight - spotLeft))}px`;
  spotlight.style.height = `${Math.max(0, Math.round(spotBottom - spotTop))}px`;
  card.classList.add("is-positioned");
}

function scheduleTourLayout() {
  if (!$("#tourOverlay")?.classList.contains("open")) return;
  window.cancelAnimationFrame(tourLayoutRaf);
  tourLayoutRaf = window.requestAnimationFrame(() => layoutTour());
}

function clearTourInlineStyles() {
  const card = $("#tourCard");
  const spotlight = $("#tourSpotlight");
  ["left", "top", "right", "bottom"].forEach((property) => card.style.removeProperty(property));
  card.removeAttribute("data-placement");
  ["left", "top", "width", "height"].forEach((property) => spotlight.style.removeProperty(property));
}

function openAttentionTest(options = {}) {
  window.clearTimeout(attentionTimer);
  attentionRuntime = null;
  if (options.origin) attentionOrigin = options.origin;
  const onboarding = attentionOrigin === "onboarding";
  $("#attentionTestBody").innerHTML = `<section class="test-guide">
    <div class="attention-kicker">${onboarding ? "Step 1 of 3 · " : ""}14-second DeeCadence baseline</div>
    <h3 id="attentionTestTitle">One rule: respond only to FOCUS.</h3>
    <p>This checks selective attention: noticing one target while refusing irrelevant signals. Sit normally, silence notifications, and use this same device for fairer future comparisons.</p>
    <div class="test-rules">
      <div class="test-rule"><b>1</b><div><strong>Keep your eyes on the centre.</strong><span>A new word appears about every 0.8 seconds.</span></div></div>
      <div class="test-rule"><b>2</b><div><strong>Tap or press Space only for FOCUS.</strong><span>Ignore SCROLL, REPLY, NEW, WATCH, and every other word.</span></div></div>
      <div class="test-rule"><b>3</b><div><strong>Respond once, then wait.</strong><span>Missed targets and taps on the wrong word reduce the score.</span></div></div>
    </div>
    <div class="test-demo"><span>If you see</span><strong>FOCUS</strong><span>tap once</span></div>
    <div class="test-rule-note">The score combines accuracy and response time. It is a product benchmark, not a medical diagnosis.</div>
    <div class="modal-actions"><button class="btn btn-ghost" type="button" data-action="attention-close">${onboarding ? "Back" : "Not now"}</button><button class="btn btn-primary" type="button" data-action="attention-start">Start after countdown</button></div>
  </section>`;
  openModal("#attentionTestModal");
}

function beginAttentionTest() {
  const sequences = [
    ["SCROLL", "FOCUS", "REPLY", "CHECK", "FOCUS", "SKIP", "NEW", "FOCUS", "WATCH", "REFRESH", "FOCUS", "LIKE", "PAUSE", "FOCUS", "SWITCH", "NEXT", "FOCUS", "DONE"],
    ["WATCH", "NEXT", "FOCUS", "NEW", "REPLY", "FOCUS", "SCROLL", "LIKE", "FOCUS", "CHECK", "SKIP", "PAUSE", "FOCUS", "REFRESH", "FOCUS", "SWITCH", "DONE", "FOCUS"],
  ];
  attentionRuntime = { sequence: sequences[state.attentionTests.length % sequences.length], index: -1, hits: 0, misses: 0, falseTaps: 0, reactions: [], shownAt: 0, hitCurrent: false, running: true };
  $("#attentionTestBody").innerHTML = `<section class="test-live">
    <div class="test-live-head"><span>Selective attention</span><span data-test-count>Preparing…</span></div>
    <div class="test-live-progress"><i data-test-progress></i></div>
    <button class="test-signal" type="button" data-action="attention-tap" aria-label="Tap only when the word Focus appears">3</button>
    <p class="test-live-note">Press Space or tap the word only when it says FOCUS.</p>
  </section>`;
  let countdown = 3;
  const runCountdown = () => {
    if (!attentionRuntime?.running) return;
    const signal = $(".test-signal");
    signal.textContent = String(countdown);
    countdown -= 1;
    if (countdown < 0) showNextAttentionSignal();
    else attentionTimer = window.setTimeout(runCountdown, 500);
  };
  runCountdown();
}

function showNextAttentionSignal() {
  const runtime = attentionRuntime;
  if (!runtime?.running) return;
  if (runtime.index >= 0 && runtime.sequence[runtime.index] === "FOCUS" && !runtime.hitCurrent) runtime.misses += 1;
  runtime.index += 1;
  if (runtime.index >= runtime.sequence.length) return finishAttentionTest();
  const word = runtime.sequence[runtime.index];
  runtime.hitCurrent = false;
  runtime.shownAt = performance.now();
  const signal = $(".test-signal");
  signal.textContent = word;
  signal.classList.toggle("is-target", word === "FOCUS");
  $("[data-test-count]").textContent = `${runtime.index + 1} / ${runtime.sequence.length}`;
  $("[data-test-progress]").style.width = `${(runtime.index + 1) / runtime.sequence.length * 100}%`;
  attentionTimer = window.setTimeout(showNextAttentionSignal, 780);
}

function registerAttentionTap() {
  const runtime = attentionRuntime;
  if (!runtime?.running || runtime.index < 0) return;
  const word = runtime.sequence[runtime.index];
  if (word === "FOCUS" && !runtime.hitCurrent) {
    runtime.hitCurrent = true;
    runtime.hits += 1;
    runtime.reactions.push(Math.round(performance.now() - runtime.shownAt));
    $(".test-signal").textContent = "CAUGHT";
    $(".test-signal").classList.remove("is-target");
  } else if (word !== "FOCUS") {
    runtime.falseTaps += 1;
    $(".test-signal").textContent = "WAIT";
  }
}

function finishAttentionTest() {
  const runtime = attentionRuntime;
  if (!runtime) return;
  runtime.running = false;
  const targets = runtime.sequence.filter((word) => word === "FOCUS").length;
  const accuracy = Math.max(0, Math.round(runtime.hits / targets * 100 - runtime.falseTaps * 8));
  const averageReaction = runtime.reactions.length ? Math.round(runtime.reactions.reduce((sum, value) => sum + value, 0) / runtime.reactions.length) : null;
  const reactionScore = averageReaction ? Math.max(0, Math.min(100, Math.round(120 - averageReaction / 8))) : 0;
  const score = Math.max(0, Math.min(100, Math.round(accuracy * .78 + reactionScore * .22)));
  const result = {
    id: uid("test"),
    takenAt: new Date().toISOString(),
    score,
    accuracy,
    averageReaction,
    misses: runtime.misses,
    falseTaps: runtime.falseTaps,
    benchmarkScore: REFERENCE_BENCHMARK.score,
    benchmarkVersion: REFERENCE_BENCHMARK.version,
  };
  state.attentionTests.push(result);
  if (state.baselineScore === null || !state.baselineTestId) {
    state.baselineScore = score;
    state.baselineTestId = result.id;
    state.baselineCompletedAt = result.takenAt;
  }
  saveState();
  const previous = state.attentionTests.at(-2);
  const change = previous ? score - previous.score : null;
  const referenceDelta = score - REFERENCE_BENCHMARK.score;
  const referencePosition = Math.abs(referenceDelta) <= 5
    ? "within the reference band"
    : referenceDelta > 0 ? `${referenceDelta} points above the reference` : `${Math.abs(referenceDelta)} points below the reference`;
  const onboarding = attentionOrigin === "onboarding";
  $("#attentionTestBody").innerHTML = `<section class="test-result">
    <div class="attention-kicker">${onboarding ? "Step 2 of 3 · " : ""}${previous ? "New check saved" : "Starting baseline saved"}</div>
    <h3 id="attentionTestTitle">${score}<span class="score-denominator">/100</span></h3>
    <p>${previous ? `That is ${change >= 0 ? "+" : ""}${change} compared with your previous check.` : `This is your personal starting point. You landed ${referencePosition}.`} Treat the pattern across several checks as useful—not one isolated score.</p>
    <div class="benchmark-comparison" style="--score-position:${score}%">
      <div class="benchmark-comparison-head"><span>Your score <strong>${score}</strong></span><span>${REFERENCE_BENCHMARK.label} <strong>${REFERENCE_BENCHMARK.score}</strong></span></div>
      <div class="benchmark-track"><i></i><b style="left:${REFERENCE_BENCHMARK.score}%" aria-label="Reference average ${REFERENCE_BENCHMARK.score}"></b><em style="left:${score}%" aria-label="Your score ${score}"></em></div>
      <small>${referencePosition}. The reference is an internal launch calibration and will be replaced by DeeCadence's consented cohort median.</small>
    </div>
    <div class="test-result-grid">
      <div><span>Accuracy</span><strong>${accuracy}%</strong></div>
      <div><span>Reaction</span><strong>${averageReaction ? `${averageReaction}ms` : "—"}</strong></div>
      <div><span>Misses</span><strong>${runtime.misses}</strong></div>
      <div><span>Early taps</span><strong>${runtime.falseTaps}</strong></div>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" type="button" data-action="attention-again">Try again</button><button class="btn btn-primary" type="button" data-action="${onboarding ? "attention-continue" : "attention-close"}">${onboarding ? "Start first mission" : "Return to progress"}</button></div>
  </section>`;
  renderProgress();
}

function closeAttentionTest() {
  if (attentionRuntime?.running && !window.confirm("Stop this attention check? The unfinished result will not be saved.")) return;
  window.clearTimeout(attentionTimer);
  attentionRuntime = null;
  closeModal("#attentionTestModal");
  if (attentionOrigin !== "onboarding") attentionOrigin = "progress";
}

function openFeedback() {
  feedbackType = "Idea";
  $("#feedbackMessageInput").value = "";
  $("#feedbackEmailInput").value = "";
  $("#feedbackCharCount").textContent = "0";
  selectFeedbackType("Idea");
  updateFeedbackDeliveryCopy();
  openModal("#feedbackModal");
  window.setTimeout(() => $("#feedbackMessageInput").focus(), 80);
}

function closeFeedback() { closeModal("#feedbackModal"); }

function selectFeedbackType(type) {
  feedbackType = ["Bug", "Confusing", "Idea", "Other"].includes(type) ? type : "Other";
  $$("[data-feedback-type]").forEach((button) => button.classList.toggle("active", button.dataset.feedbackType === feedbackType));
}

function feedbackDeliveryMode() {
  if (FEEDBACK_ENDPOINT) return "endpoint";
  if (FEEDBACK_EMAIL) return "email";
  return "outbox";
}

function updateFeedbackDeliveryCopy() {
  const mode = feedbackDeliveryMode();
  const pending = state.feedbackOutbox.length;
  const settingCopy = mode === "endpoint"
    ? `Connected to the developer receiver${pending ? ` · ${pending} queued` : ""}.`
    : mode === "email"
      ? "Uses your email app to address the developer."
      : `Receiver not configured${pending ? ` · ${pending} saved locally` : ""}. Add an endpoint or email in index.html.`;
  if ($("#feedbackDeliveryStatus")) $("#feedbackDeliveryStatus").textContent = settingCopy;
  if ($("#feedbackDeliveryNote")) {
    $("#feedbackDeliveryNote").textContent = mode === "endpoint"
      ? "This report will be sent to the configured DeeCadence developer receiver."
      : mode === "email"
        ? "Submitting opens a pre-addressed email draft. You remain in control of sending it."
        : "No receiver is configured yet. Submitting safely stores this report in the on-device outbox; it is not falsely marked as delivered.";
  }
}

async function submitFeedback() {
  const message = $("#feedbackMessageInput").value.trim();
  if (message.length < 8) return showToast("Add a little more detail so the report is useful.", "error");
  const payload = {
    id: uid("feedback"),
    type: feedbackType,
    message,
    replyEmail: $("#feedbackEmailInput").value.trim().slice(0, 120),
    sentAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    context: $("#feedbackContextInput").checked ? anonymousFeedbackContext() : null,
  };
  const button = $("#feedbackSubmitBtn");
  button.disabled = true;
  button.textContent = "Sending…";
  const mode = feedbackDeliveryMode();
  try {
    if (mode === "endpoint") {
      const response = await fetch(FEEDBACK_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`Receiver returned ${response.status}`);
      closeFeedback();
      showToast("Feedback delivered to the developer.", "success");
    } else if (mode === "email") {
      const subject = encodeURIComponent(`[DeeCadence ${feedbackType}] Product feedback`);
      const body = encodeURIComponent(`${message}\n\nReply email: ${payload.replyEmail || "Not provided"}\n\nContext:\n${JSON.stringify(payload.context, null, 2)}`);
      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
      closeFeedback();
      showToast("Email draft opened. Send it when ready.");
    } else {
      state.feedbackOutbox.push(payload);
      state.feedbackOutbox = state.feedbackOutbox.slice(-50);
      saveState();
      closeFeedback();
      showToast("Saved to the feedback outbox. A receiver still needs to be configured.");
    }
  } catch {
    state.feedbackOutbox.push(payload);
    state.feedbackOutbox = state.feedbackOutbox.slice(-50);
    saveState();
    closeFeedback();
    showToast("Could not reach the receiver. Feedback was queued safely.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Send feedback";
    updateFeedbackBadge();
    updateFeedbackDeliveryCopy();
  }
}

async function retryFeedbackOutbox() {
  if (!FEEDBACK_ENDPOINT || !navigator.onLine || !state.feedbackOutbox.length) return;
  const remaining = [];
  for (const payload of state.feedbackOutbox) {
    try {
      const response = await fetch(FEEDBACK_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) remaining.push(payload);
    } catch { remaining.push(payload); }
  }
  if (remaining.length !== state.feedbackOutbox.length) {
    state.feedbackOutbox = remaining;
    saveState();
    updateFeedbackBadge();
    updateFeedbackDeliveryCopy();
  }
}

function anonymousFeedbackContext() {
  const stats = progressStats();
  return {
    view: state.activeView,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    platform: navigator.userAgentData?.platform || navigator.platform || "unknown",
    online: navigator.onLine,
    theme: state.theme,
    reducedMotion: state.settings.reducedMotion,
    sessionCount: state.sessions.length,
    taskCount: state.tasks.length,
    totalBlocks: stats.totalBlocks,
    consistency: stats.consistency,
    attentionTests: state.attentionTests.length,
  };
}

function updateFeedbackBadge() {
  const badge = $("#feedbackQueueBadge");
  const count = state.feedbackOutbox.length;
  badge.hidden = count === 0;
  badge.textContent = String(Math.min(99, count));
}

function exportHistory() {
  downloadJson(`deecadence-history-${todayKey()}.json`, { exportedAt: new Date().toISOString(), sessions: state.sessions });
}

function exportBackup() {
  downloadJson(`deecadence-backup-${todayKey()}.json`, { product: "DeeCadence", appVersion: APP_VERSION, exportedAt: new Date().toISOString(), state });
  showToast("Backup exported.", "success");
}

function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = parsed.state || parsed;
      if (!incoming || !Array.isArray(incoming.tasks) || !Array.isArray(incoming.sessions)) throw new Error("Invalid backup");
      if (!window.confirm("Replace this device’s current DeeCadence data with the imported backup?")) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
      state = loadState();
      applyPreferences();
      renderAll();
      showToast("Backup restored.", "success");
    } catch { showToast("That file is not a valid DeeCadence backup.", "error"); }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!window.confirm("Reset all DeeCadence tasks, sessions, ranks, tests, and settings on this device? Export a backup first if needed.")) return;
  state = structuredCloneSafe(DEFAULT_STATE);
  saveState();
  applyPreferences();
  renderAll();
  openWelcome();
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toggleTheme() { setTheme(state.theme === "dark" ? "light" : "dark"); }

function setTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  applyPreferences();
  saveState();
  renderSettings();
}

function toggleSound() {
  state.settings.sound = !state.settings.sound;
  saveAndRender();
}

function toggleMotion() {
  state.settings.reducedMotion = !state.settings.reducedMotion;
  applyPreferences();
  saveAndRender();
}

function applyPreferences() {
  document.documentElement.dataset.theme = state.theme;
  document.body.dataset.theme = state.theme;
  document.documentElement.dataset.reducedMotion = String(state.settings.reducedMotion);
  document.body.dataset.reducedMotion = String(state.settings.reducedMotion);
}

function playCompletionChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(540, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(760, context.currentTime + .18);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.08, context.currentTime + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .36);
  } catch { /* sound is optional */ }
}

function openModal(selector) {
  $(selector)?.classList.add("open");
  setModalState();
}

function closeModal(selector) {
  $(selector)?.classList.remove("open");
  setModalState();
}

function setModalState() {
  const open = Boolean($(".modal-overlay.open, .welcome-overlay.open, .mission-overlay.open, .reveal-overlay.open, .tour-overlay.open"));
  document.body.classList.toggle("modal-open", open);
}

function showToast(message, kind = "info") {
  const toast = $("#toast");
  window.clearTimeout(toastHandle);
  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.classList.add("show");
  toastHandle = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function saveAndRender() {
  saveState();
  renderAll();
}

function levelForXp(rawXp) {
  const xp = Math.max(0, Number(rawXp) || 0);
  const last = RANKS.at(-1);
  if (xp >= last.minXp) {
    const delta = xp - last.minXp;
    const b = L_LEVEL_BASE_XP - L_LEVEL_GROWTH_XP / 2;
    const extraLevels = Math.floor((-b + Math.sqrt(b * b + 2 * L_LEVEL_GROWTH_XP * delta)) / L_LEVEL_GROWTH_XP);
    return last.minLevel + Math.max(0, extraLevels);
  }
  for (let index = 0; index < RANKS.length - 1; index += 1) {
    const start = RANKS[index];
    const end = RANKS[index + 1];
    if (xp < end.minXp) {
      const xpSpan = end.minXp - start.minXp;
      const levelSpan = end.minLevel - start.minLevel;
      return start.minLevel + Math.floor((xp - start.minXp) * levelSpan / xpSpan);
    }
  }
  return last.minLevel;
}

function currentLevel() { return levelForXp(state.totalXp); }

function levelStartXp(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const last = RANKS.at(-1);
  if (safeLevel >= last.minLevel) {
    const extra = safeLevel - last.minLevel;
    return last.minXp + L_LEVEL_BASE_XP * extra + L_LEVEL_GROWTH_XP * extra * (extra - 1) / 2;
  }
  for (let index = 0; index < RANKS.length - 1; index += 1) {
    const start = RANKS[index];
    const end = RANKS[index + 1];
    if (safeLevel >= start.minLevel && safeLevel < end.minLevel) {
      const xpSpan = end.minXp - start.minXp;
      const levelSpan = end.minLevel - start.minLevel;
      return start.minXp + Math.ceil((safeLevel - start.minLevel) * xpSpan / levelSpan);
    }
  }
  return 0;
}

function levelEndXp(level) { return levelStartXp(level + 1); }
function nextLevelXpTarget() { return levelEndXp(currentLevel()); }
function rankForXp(xp) { return [...RANKS].reverse().find((rank) => xp >= rank.minXp) || RANKS[0]; }
function currentRank() { return RANKS.find((rank) => rank.code === state.highestRankCode) || RANKS[0]; }

function rankEvidence() {
  const activeDays = new Set(state.sessions.filter((session) => session.durationMinutes > 0).map((session) => localDateKey(session.start))).size;
  const completedBlocks = state.sessions.reduce((sum, session) => sum + session.blocksCompleted, 0);
  return { activeDays, completedBlocks, consistency: progressStats().consistency };
}

function meetsRankGate(rank, evidence = rankEvidence()) {
  if (rank.code === "E") return true;
  return state.totalXp >= rank.minXp
    && evidence.activeDays >= rank.minLevel
    && evidence.completedBlocks >= rank.minLevel * 4
    && evidence.consistency >= rank.minConsistency;
}

function evaluateRankUnlock() {
  let currentIndex = Math.max(0, RANKS.findIndex((rank) => rank.code === state.highestRankCode));
  const evidence = rankEvidence();
  let unlocked = null;
  while (currentIndex < RANKS.length - 1 && meetsRankGate(RANKS[currentIndex + 1], evidence)) {
    currentIndex += 1;
    unlocked = RANKS[currentIndex];
  }
  state.highestRankCode = RANKS[currentIndex].code;
  return unlocked;
}

function validateRankLadder() {
  const codes = new Set();
  RANKS.forEach((rank, index) => {
    if (codes.has(rank.code)) throw new Error(`Duplicate rank code: ${rank.code}`);
    codes.add(rank.code);
    if (index > 0 && rank.minLevel <= RANKS[index - 1].minLevel) throw new Error(`Rank levels must increase at ${rank.code}`);
    if (index > 0 && rank.minXp <= RANKS[index - 1].minXp) throw new Error(`Rank XP must increase at ${rank.code}`);
    if (rankForXp(rank.minXp).code !== rank.code) throw new Error(`Rank XP boundary failed at ${rank.code}`);
    if (levelForXp(rank.minXp) !== rank.minLevel) throw new Error(`Level boundary failed at ${rank.code}`);
    if (levelStartXp(rank.minLevel) !== rank.minXp) throw new Error(`Level start failed at ${rank.code}`);
    if (index > 0 && rankForXp(rank.minXp - 1).code !== RANKS[index - 1].code) throw new Error(`Pre-boundary failed at ${rank.code}`);
  });
}

init();

function calculateStreak() {
  const totals = new Map();
  state.sessions.forEach((session) => {
    const key = localDateKey(session.start);
    totals.set(key, (totals.get(key) || 0) + session.durationMinutes);
  });
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if ((totals.get(dateKey(cursor)) || 0) < state.settings.dailyGoal) cursor.setDate(cursor.getDate() - 1);
  while ((totals.get(dateKey(cursor)) || 0) >= state.settings.dailyGoal) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function taskSort(a, b) {
  return Number(a.completed) - Number(b.completed) || priorityWeight(b.priority) - priorityWeight(a.priority) || (a.time || "99:99").localeCompare(b.time || "99:99");
}

function priorityWeight(priority) { return priority === "high" ? 3 : priority === "medium" ? 2 : 1; }
function normalizePriority(priority) { return ["high", "medium", "low"].includes(String(priority).toLowerCase()) ? String(priority).toLowerCase() : "medium"; }
function formatTaskTime(task) { return task.time ? `${formatDateKey(task.date)} at ${task.time}` : `${formatDateKey(task.date)} · flexible time`; }
function formatDateKey(key) { return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function formatDateTime(value) { return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function localDateKey(value) { return dateKey(new Date(value)); }
function todayKey() { return dateKey(new Date()); }
function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function validDateKey(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }
function formatClock(seconds) { const safe = Math.max(0, Math.ceil(seconds)); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }
function formatMinutes(minutes) { const rounded = Math.round(minutes || 0); return rounded >= 60 ? `${Math.floor(rounded / 60)}h${rounded % 60 ? ` ${rounded % 60}m` : ""}` : `${rounded}m`; }
function formatNumber(value) { return new Intl.NumberFormat().format(Math.round(value || 0)); }
function capitalize(value) { return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1); }
function clampNumber(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback; }
function structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
