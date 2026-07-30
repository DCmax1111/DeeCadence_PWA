const STORAGE_KEY = "orbit-polymath-v3";
const MOBILE_VIEW_QUERY = window.matchMedia("(max-width: 780px)");
let mobileRuntime = MOBILE_VIEW_QUERY.matches;

function isMobileRuntime() {
  return mobileRuntime;
}

function syncMobileRuntime() {
  mobileRuntime = MOBILE_VIEW_QUERY.matches;
  document.documentElement.dataset.mobileRuntime = mobileRuntime ? "true" : "false";
}
const LEGACY_STORAGE_KEY = "orbit-polymath-v2";
const APP_VERSION = "2026.07.local";
const REMINDER_CHECK_INTERVAL_MS = 30000;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const JS_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = ["Morning", "Deep work", "Evening"];

const DOMAINS = {
  spirit: { name: "Spirit", color: "#7b8f5d", icon: "Sp", description: "Prayer, scripture, reflection and inner alignment." },
  body: { name: "Body", color: "#d48263", icon: "Bo", description: "Strength, mobility, recovery and physical care." },
  scholar: { name: "Scholar", color: "#668da1", icon: "Sc", description: "School, reading, research and structured learning." },
  creator: { name: "Creator", color: "#b47c9b", icon: "Cr", description: "Writing, drawing, music and things brought into the world." },
  builder: { name: "Builder", color: "#b59152", icon: "Bu", description: "Code, products, business systems and useful experiments." },
  steward: { name: "Steward", color: "#4d876b", icon: "St", description: "Money, home, planning and responsibilities kept in order." },
  connection: { name: "Connection", color: "#a36d56", icon: "Co", description: "Family, church, community and meaningful outreach." }
};

const LEGACY_WEEKLY_DAYS = {
  "business-dms": ["Monday", "Tuesday", "Thursday"],
  coding: ["Tuesday", "Saturday"],
  drawing: ["Tuesday"],
  writing: ["Wednesday", "Friday", "Saturday", "Sunday"],
  laundry: ["Tuesday", "Thursday"],
  stroll: ["Monday", "Tuesday", "Thursday", "Friday", "Saturday", "Sunday"],
  "weekly-review": ["Sunday"],
  church: ["Sunday"],
  "pm-tool": ["Saturday"],
  "selar-product": ["Saturday"]
};

const lectureTasks = {
  Monday: [["GET 322", "8-10"], ["CPE 322", "10-12"], ["GET 323 Practical", "1-2"], ["GET 323", "2-4"]],
  Tuesday: [["CPE 321", "10-12"], ["GET 321", "1-3"]],
  Wednesday: [["ENT 321", "1-3"]],
  Thursday: [["GET 324", "10-12"]],
  Friday: [["GET 322", "8-9"], ["GET 323", "9-10"], ["GET 324 Practical", "10-12"], ["GET 321", "3-5"]],
  Saturday: [],
  Sunday: []
};

const FRICTIONS = [
  { id: "phone-drift", name: "Phone drift while studying", cue: "Put it out of reach, then restart for 2 minutes." },
  { id: "revenge-scroll", name: "Late-night revenge scrolling", cue: "Charge the phone away from bed and begin one night anchor." },
  { id: "day-lost", name: "The day is already lost thinking", cue: "Do one minimum version before judging the day." },
  { id: "avoidance-loop", name: "Avoiding difficult work", cue: "Name the next two-minute entry point." }
];

const TEMPLATE_LIBRARY = [
  {
    id: "student",
    name: "Student mastery",
    description: "Lecture clarity, assignments, review, and exam preparation.",
    tasks: [
      ["lecture-check", "Confirm lecture status", "scholar", "weekly", "07:30", "Send one classmate a message", "Morning", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "study,lecture"],
      ["assignment-inbox", "Assignment inbox sweep", "scholar", "daily", "18:00", "Open the assignment list", "Evening", [], "study,school"],
      ["teach-back", "Teach back one concept", "scholar", "weekly", "20:30", "Explain it in one sentence", "Evening", ["Tuesday", "Friday"], "study,review"]
    ]
  },
  {
    id: "polymath",
    name: "Polymath foundation",
    description: "A balanced set for body, study, creativity, spirit, and stewardship.",
    tasks: [
      ["range-review", "Two-domain range review", "steward", "weekly", "17:00", "Name two domains touched", "Evening", ["Sunday"], "review,polymath"],
      ["tiny-creation", "Tiny creation proof", "creator", "daily", "20:00", "Create for five minutes", "Evening", [], "creation,kaizen"],
      ["body-floor", "Body floor routine", "body", "daily", "04:45", "One pushup and one stretch", "Morning", [], "fitness,minimum"]
    ]
  },
  {
    id: "creator",
    name: "Creator engine",
    description: "Writing, drawing, packaging, and shipping creative products.",
    tasks: [
      ["idea-capture", "Capture one idea", "creator", "daily", "13:00", "Write one rough sentence", "Deep work", [], "writing,ideas"],
      ["ship-artifact", "Ship one small artifact", "builder", "weekly", "15:00", "Name the artifact", "Deep work", ["Saturday"], "selar,product"],
      ["portfolio-proof", "Update creative portfolio", "creator", "weekly", "16:00", "Add one line or image", "Deep work", ["Friday"], "portfolio,creation"]
    ]
  },
  {
    id: "entrepreneur",
    name: "Builder business",
    description: "DMs, follow-ups, offer creation, and money awareness.",
    tasks: [
      ["prospect-followup", "Prospect follow-up", "builder", "weekly", "11:00", "Send one thoughtful follow-up", "Deep work", ["Monday", "Thursday"], "business,dms"],
      ["offer-polish", "Polish one offer", "builder", "weekly", "14:00", "Improve one sentence", "Deep work", ["Saturday"], "business,offer"],
      ["cash-snapshot", "Cash snapshot", "steward", "weekly", "18:30", "Log one number", "Evening", ["Sunday"], "finance,business"]
    ]
  },
  {
    id: "language",
    name: "Language ladder",
    description: "A light Korean-style learning loop with recall and speaking.",
    tasks: [
      ["phrase-recall", "Recall yesterday's phrase", "scholar", "daily", "19:00", "Say one phrase aloud", "Evening", [], "korean,language"],
      ["sentence-build", "Build one sentence", "scholar", "weekly", "19:20", "Swap one word", "Evening", ["Tuesday", "Thursday"], "korean,language"],
      ["listening-touch", "Listen for five minutes", "scholar", "weekly", "19:40", "Play one short clip", "Evening", ["Saturday"], "korean,listening"]
    ]
  }
];

const seedGoals = [
  { id: "goal-semester", name: "Finish the semester with calm mastery", domain: "scholar", progress: 62, date: "2026-08-14", note: "Learn deeply enough to explain each core course simply." },
  { id: "goal-product", name: "Ship the first polymath product", domain: "builder", progress: 38, date: "2026-07-31", note: "Turn useful writing and systems into a small paid artifact." },
  { id: "goal-korean", name: "Hold a five-minute Korean conversation", domain: "scholar", progress: 24, date: "2026-10-01", note: "Build speaking confidence through tiny daily contact." },
  { id: "goal-body", name: "Build a resilient morning body", domain: "body", progress: 71, date: "2026-09-01", note: "Strength and mobility without punishing volume." }
];

const seedTasks = [
  ["wake", "Wake up by 4 am", "body", "daily", "04:00", "Sit up and put both feet down", "Morning", [], "morning,body", "goal-body"],
  ["morning-prayer", "Morning prayer", "spirit", "daily", "04:05", "One honest minute", "Morning", [], "prayer,spirit", ""],
  ["wash-face", "Wash face and restroom", "body", "daily", "04:15", "Splash water on your face", "Morning", [], "morning,body", "goal-body"],
  ["bible", "Bible reading", "spirit", "daily", "04:25", "Read one verse", "Morning", [], "bible,spirit", ""],
  ["exercise", "Body activation circuit", "body", "daily", "04:40", "One pushup and 20-second plank", "Morning", [], "fitness,morning", "goal-body"],
  ["shower", "Shower", "body", "daily", "05:05", "Two-minute rinse", "Morning", [], "body,morning", ""],
  ["study", "School study", "scholar", "daily", "05:20", "Open notes and solve one question", "Deep work", [], "study,school", "goal-semester"],
  ["family-prayer", "Family prayers", "connection", "daily", "05:50", "Be present for the closing prayer", "Morning", [], "family,prayer", ""],
  ["assignments", "Assignments and note making", "scholar", "daily", "06:10", "Write one paragraph", "Deep work", [], "assignments,school", "goal-semester"],
  ["goals", "Set the day's goals", "steward", "daily", "06:30", "Choose one must-win", "Morning", [], "planning,steward", ""],
  ["reading", "Read", "scholar", "daily", "12:30", "Read two pages", "Deep work", [], "reading,study", ""],
  ["finance", "Track finances", "steward", "daily", "18:30", "Log one expense", "Evening", [], "finance,steward", ""],
  ["language", "Practice Korean", "scholar", "daily", "19:00", "Learn one phrase", "Evening", [], "korean,language", "goal-korean"],
  ["creation", "Creation hour", "creator", "daily", "20:00", "Create for five minutes", "Evening", [], "creation,writing", "goal-product"],
  ["journal", "Journal and meditate", "spirit", "daily", "21:00", "Write one true sentence", "Evening", [], "journal,meditation", ""],
  ["night-reset", "Night shutdown", "steward", "daily", "21:20", "Wash one dish and stretch", "Evening", [], "shutdown,steward", ""],
  ["night-prayer", "Night prayer and affirmation", "spirit", "daily", "21:40", "One prayer and one sentence", "Evening", [], "prayer,night", ""],
  ["sleep", "Sleep on time", "body", "daily", "22:00", "Put the phone beyond reach", "Evening", [], "sleep,body", "goal-body"],
  ["business-dms", "Business outreach", "builder", "weekly", "09:00", "Send one useful DM", "Deep work", ["Monday", "Tuesday", "Thursday"], "business,dms", "goal-product"],
  ["coding", "Coding practice", "builder", "weekly", "14:00", "Open the project and fix one thing", "Deep work", ["Tuesday", "Saturday"], "coding,builder", "goal-product"],
  ["drawing", "Drawing practice", "creator", "weekly", "16:00", "Draw one shape", "Deep work", ["Tuesday"], "drawing,creator", ""],
  ["writing", "Writing session", "creator", "weekly", "15:00", "Write fifty words", "Deep work", ["Wednesday", "Friday", "Saturday", "Sunday"], "writing,creator", "goal-product"],
  ["laundry", "Laundry", "steward", "weekly", "17:00", "Gather clothes in one place", "Evening", ["Tuesday", "Thursday"], "home,steward", ""],
  ["stroll", "Evening stroll", "body", "weekly", "19:30", "Walk outside for five minutes", "Evening", ["Monday", "Tuesday", "Thursday", "Friday", "Saturday", "Sunday"], "walk,body", ""],
  ["weekly-review", "Weekly review and next-week plan", "steward", "weekly", "17:30", "Answer one review prompt", "Evening", ["Sunday"], "review,planning", ""],
  ["church", "Church service", "connection", "weekly", "08:00", "Prepare clothing the night before", "Deep work", ["Sunday"], "church,connection", ""],
  ["pm-tool", "Build project manager tool", "builder", "weekly", "10:00", "Ship one tiny improvement", "Deep work", ["Saturday"], "coding,product", "goal-product"],
  ["selar-product", "Turn writing into a Selar product", "builder", "weekly", "13:00", "Name one sellable artifact", "Deep work", ["Saturday"], "selar,product", "goal-product"]
].map(([id, name, domain, schedule, time, minimum, period, days, tags, goalId], index) => ({
  id,
  name,
  domain,
  schedule,
  time,
  minimum,
  period,
  days,
  tags: tags.split(","),
  note: minimum,
  duration: index < 8 ? 5 : 20,
  everyDays: 2,
  monthlyDay: 1,
  season: "Foundation",
  stackAfter: index > 0 && index < 8 ? seedStackBase(index) : "",
  goalId,
  archived: false,
  createdAt: Date.now() - (seedTasksLengthHint() - index) * 1000
}));

let state = loadState();
let currentRoute = "today";
let taskFilter = "all";
let selectedDateOffset = 0;
let activeDayPickerDays = [];
let routineState = null;
let focusState = null;
let reminderTimer = null;
let selectedDomain = "scholar";
let proofLinkGoalId = "";

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TOPBAR_CONTEXT = {
  today: ["Today", "Tiny proof first"],
  tasks: ["Tasks", "Edit the system"],
  goals: ["Goals", "Proof linked to direction"],
  insights: ["Insights", "Signals, not judgment"],
  domains: ["Domains", "Balanced growth"],
  review: ["Review", "Close the loop"]
};

init();

function seedTasksLengthHint() {
  return 28;
}

function seedStackBase(index) {
  const order = ["wake", "morning-prayer", "wash-face", "bible", "exercise", "shower", "study"];
  return order[index - 1] || "";
}

function init() {
  populateStaticSelects();
  applyPreferences();
  bindShell();
  renderAll();
  restoreReview();
  startReminderEngine();
  setInterval(renderDate, 60000);
  if (!state.onboardingComplete) setTimeout(openGuide, 250);
}

function defaultState() {
  return {
    tasks: clone(seedTasks),
    goals: clone(seedGoals),
    completions: {},
    microWins: {},
    friction: {},
    lectures: {},
    reviews: [],
    focusSessions: [],
    routineSessions: [],
    activeRoutine: null,
    frozenDomains: [],
    reminders: [],
    account: null,
    notificationPermission: "default",
    onboardingComplete: false,
    currentSeason: "Foundation",
    preferences: { name: "Daniel O.", fontSize: "normal", accent: "green", theme: "system" }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return defaultState();
    return migrateState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

function migrateState(saved) {
  if (saved?.app === "Orbit" && saved?.data) return migrateState(saved.data);
  const base = defaultState();
  const migrated = {
    ...base,
    ...saved,
    preferences: { ...base.preferences, ...(saved.preferences || {}) },
    currentSeason: saved.currentSeason || saved.preferences?.currentSeason || "Foundation",
    tasks: Array.isArray(saved.tasks) && saved.tasks.length ? saved.tasks.map(normalizeTask) : base.tasks,
    goals: Array.isArray(saved.goals) && saved.goals.length ? saved.goals.map(normalizeGoal) : base.goals,
    completions: saved.completions || {},
    microWins: saved.microWins || {},
    friction: normalizeFrictionState(saved.friction || {}),
    lectures: saved.lectures || {},
    reviews: saved.reviews || [],
    focusSessions: saved.focusSessions || [],
    routineSessions: saved.routineSessions || [],
    activeRoutine: saved.activeRoutine || null,
    frozenDomains: normalizeFrozenDomains(saved.frozenDomains),
    reminders: Array.isArray(saved.reminders) ? saved.reminders.map(normalizeReminder) : [],
    account: saved.account || null,
    notificationPermission: saved.notificationPermission || "default"
  };
  return migrated;
}

function normalizeReminder(reminder) {
  return {
    id: reminder.id || makeId("reminder"),
    name: reminder.name || "Orbit reminder",
    time: reminder.time || "06:00",
    message: reminder.message || "Start tiny. One honest proof is enough.",
    repeat: reminder.repeat || "daily",
    taskId: reminder.taskId || "",
    active: reminder.active !== false,
    lastFired: reminder.lastFired || "",
    createdAt: reminder.createdAt || Date.now()
  };
}

function normalizeTask(task) {
  const legacyDays = LEGACY_WEEKLY_DAYS[task.id] || [];
  const schedule = task.schedule === "weekly" ? "weekly" : task.schedule || "daily";
  const tags = Array.isArray(task.tags) ? task.tags : String(task.tags || "").split(",").map(cleanTag).filter(Boolean);
  return {
    id: task.id || makeId("task"),
    name: task.name || "Untitled task",
    domain: DOMAINS[task.domain] ? task.domain : "steward",
    schedule,
    time: task.time || "Flexible",
    minimum: task.minimum || "",
    period: PERIODS.includes(task.period) ? task.period : "Deep work",
    note: task.note || "",
    days: Array.isArray(task.days) && task.days.length ? task.days : legacyDays,
    everyDays: Number(task.everyDays) || 2,
    monthlyDay: Number(task.monthlyDay) || 1,
    season: task.season || "Foundation",
    dueDate: task.dueDate || "",
    duration: Number(task.duration) || 10,
    tags,
    stackAfter: task.stackAfter || "",
    goalId: task.goalId || "",
    archived: Boolean(task.archived),
    createdAt: task.createdAt || Date.now()
  };
}

function normalizeGoal(goal) {
  return {
    id: goal.id || makeId("goal"),
    name: goal.name || "Untitled goal",
    domain: DOMAINS[goal.domain] ? goal.domain : "scholar",
    progress: Math.min(100, Math.max(0, Number(goal.progress) || 0)),
    date: goal.date || "",
    note: goal.note || ""
  };
}

function normalizeFrozenDomains(value) {
  const list = Array.isArray(value) ? value : Object.keys(value || {}).filter(id => value[id]);
  return [...new Set(list.filter(id => DOMAINS[id]))];
}

function normalizeFrictionState(records) {
  const output = {};
  Object.entries(records).forEach(([key, day]) => {
    output[key] = {};
    Object.entries(day || {}).forEach(([id, value]) => {
      output[key][id] = normalizeFrictionRecord(value);
    });
  });
  return output;
}

function normalizeFrictionRecord(value) {
  if (typeof value === "string") return { status: value, trigger: "", replacement: "", recoveryMins: 0, note: "", at: new Date().toISOString() };
  return {
    status: value?.status || "",
    trigger: value?.trigger || "",
    replacement: value?.replacement || "",
    recoveryMins: Number(value?.recoveryMins) || 0,
    note: value?.note || "",
    at: value?.at || new Date().toISOString()
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindShell() {
  $$("[data-route]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.route)));
  $$("[data-route-jump]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.routeJump)));
  $$("[data-add-task]").forEach(button => button.addEventListener("click", () => openEntityModal("task")));
  $$("[data-add-goal]").forEach(button => button.addEventListener("click", () => openEntityModal("goal")));

  $("#quickAddButton").addEventListener("click", () => openEntityModal("task"));
  $("#utilityMenuButton").addEventListener("click", event => {
    event.stopPropagation();
    toggleUtilityMenu();
  });
  $("#utilityMenu").addEventListener("click", event => event.stopPropagation());
  document.addEventListener("click", event => { if (!event.target.closest?.(".utility-menu")) closeUtilityMenu(); });
  $("#backupButton").addEventListener("click", () => { closeUtilityMenu(); backupAllData(); });
  $("#reminderButton").addEventListener("click", () => { closeUtilityMenu(); openReminderModal(); });
  $("#loginButton").addEventListener("click", () => { closeUtilityMenu(); openLoginModal(); });
  syncMobileRuntime();
  const mobileRuntimeHandler = () => {
    syncMobileRuntime();
    renderAll();
  };
  if (MOBILE_VIEW_QUERY.addEventListener) {
    MOBILE_VIEW_QUERY.addEventListener("change", mobileRuntimeHandler);
  } else {
    MOBILE_VIEW_QUERY.addListener(mobileRuntimeHandler);
  }
  $("#mobileMenu").addEventListener("click", openSidebar);
  $("#sidebarClose").addEventListener("click", closeSidebar);
  $("#sidebarScrim").addEventListener("click", closeSidebar);
  $("#profileButton").addEventListener("click", openSettings);
  $("#settingsClose").addEventListener("click", closeSettings);
  $("#settingsBackdrop").addEventListener("click", event => { if (event.target.id === "settingsBackdrop") closeSettings(); });
  $("#settingsForm").addEventListener("submit", event => { event.preventDefault(); closeSettings(); toast("Profile preferences saved"); });
  $("#displayName").addEventListener("input", event => updatePreference("name", event.target.value));
  $("#currentSeason").addEventListener("change", event => {
    state.currentSeason = event.target.value;
    saveState();
    renderAll();
    toast(`${state.currentSeason} season enabled`);
  });
  $("#fontSizeOptions").addEventListener("click", event => {
    const button = event.target.closest("[data-font-size]");
    if (button) updatePreference("fontSize", button.dataset.fontSize);
  });
  $("#accentOptions").addEventListener("click", event => {
    const button = event.target.closest("[data-accent]");
    if (button) updatePreference("accent", button.dataset.accent);
  });
  $("#themeOptions").addEventListener("click", event => {
    const button = event.target.closest("[data-theme-choice]");
    if (button) updatePreference("theme", button.dataset.themeChoice);
  });
  $("#themeToggle").addEventListener("click", toggleTheme);
  systemTheme.addEventListener("change", () => { if (state.preferences.theme === "system") applyPreferences(); });

  $("#modalClose").addEventListener("click", closeModal);
  $("#modalCancel").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", event => { if (event.target.id === "modalBackdrop") closeModal(); });
  $("#entityForm").addEventListener("submit", saveEntity);
  $("#entitySchedule").addEventListener("change", refreshEntityFormVisibility);
  $("#dayPicker").addEventListener("click", event => {
    const button = event.target.closest("[data-day]");
    if (!button) return;
    button.classList.toggle("active");
    activeDayPickerDays = $$("[data-day].active", $("#dayPicker")).map(item => item.dataset.day);
  });

  $("#previousDay").addEventListener("click", () => changeDay(-1));
  $("#nextDay").addEventListener("click", () => changeDay(1));
  $("#todayPicker").addEventListener("click", () => { selectedDateOffset = 0; renderAll(); });
  $("#adjustLoad").addEventListener("click", adjustDayLoad);

  $("#taskSearch").addEventListener("input", renderTaskLibrary);
  $("#domainFilter").addEventListener("change", renderTaskLibrary);
  $("#tagFilter").addEventListener("change", renderTaskLibrary);
  $("#globalSearch").addEventListener("input", event => {
    if (!event.target.value.trim()) return;
    navigate("tasks");
    $("#taskSearch").value = event.target.value;
    renderTaskLibrary();
  });
  $("#taskFilters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    taskFilter = button.dataset.filter;
    $$("button", $("#taskFilters")).forEach(item => item.classList.toggle("active", item === button));
    renderTaskLibrary();
  });

  $("#exportJson").addEventListener("click", exportJson);
  $("#exportCsv").addEventListener("click", exportCsv);
  $("#importDataButton").addEventListener("click", () => $("#importDataInput").click());
  $("#importDataInput").addEventListener("change", importData);

  $("#saveReview").addEventListener("click", saveReview);
  $("#openGuide").addEventListener("click", openGuide);
  $("#closeGuide").addEventListener("click", closeGuide);
  $("#skipGuide").addEventListener("click", closeGuide);
  $("#finishGuide").addEventListener("click", finishGuide);
  $("#onboardingBackdrop").addEventListener("click", event => { if (event.target.id === "onboardingBackdrop") closeGuide(); });

  $("#frictionClose").addEventListener("click", closeFrictionModal);
  $("#frictionCancel").addEventListener("click", closeFrictionModal);
  $("#frictionBackdrop").addEventListener("click", event => { if (event.target.id === "frictionBackdrop") closeFrictionModal(); });
  $("#frictionForm").addEventListener("submit", saveFrictionDetail);

  $("#startRoutineButton").addEventListener("click", openRoutineModal);
  $("#routineClose").addEventListener("click", closeRoutineModal);
  $("#routineBackdrop").addEventListener("click", event => { if (event.target.id === "routineBackdrop") closeRoutineModal(); });
  $("#routineStart").addEventListener("click", startRoutineTimer);
  $("#routinePause").addEventListener("click", pauseRoutineTimer);
  $("#routineSkip").addEventListener("click", skipRoutineStep);
  $("#routineExtend").addEventListener("click", extendRoutineStep);
  $("#routineFinish").addEventListener("click", finishRoutineSession);
  $("#routineAutoNext").addEventListener("change", () => {
    if (routineState) routineState.autoNext = $("#routineAutoNext").checked;
    persistRoutineState();
  });
  window.addEventListener("beforeunload", persistRoutineState);

  $("#startFocusButton").addEventListener("click", openFocusModal);
  $("#startFocusTop").addEventListener("click", () => { closeUtilityMenu(); openFocusModal(); });
  $("#focusClose").addEventListener("click", closeFocusModal);
  $("#focusBackdrop").addEventListener("click", event => { if (event.target.id === "focusBackdrop") closeFocusModal(); });
  $("#focusStart").addEventListener("click", startFocusTimer);
  $("#focusPause").addEventListener("click", pauseFocusTimer);
  $("#focusExtend").addEventListener("click", extendFocusTimer);
  $("#focusFinish").addEventListener("click", finishFocusSession);
  $("#focusMinutes").addEventListener("input", resetFocusClock);

  $("#openStackBuilder").addEventListener("click", openStackModal);
  $("#stackClose").addEventListener("click", closeStackModal);
  $("#stackCancel").addEventListener("click", closeStackModal);
  $("#stackBackdrop").addEventListener("click", event => { if (event.target.id === "stackBackdrop") closeStackModal(); });
  $("#stackForm").addEventListener("submit", saveStack);

  $("#loginClose").addEventListener("click", closeLoginModal);
  $("#loginBackdrop").addEventListener("click", event => { if (event.target.id === "loginBackdrop") closeLoginModal(); });
  $("#loginForm").addEventListener("submit", saveLogin);
  $("#logoutButton").addEventListener("click", logout);

  $("#reminderClose").addEventListener("click", closeReminderModal);
  $("#reminderBackdrop").addEventListener("click", event => { if (event.target.id === "reminderBackdrop") closeReminderModal(); });
  $("#enableNotifications").addEventListener("click", enableNotifications);
  $("#reminderForm").addEventListener("submit", saveReminder);

  $("#historyClose").addEventListener("click", closeHistoryModal);
  $("#historyBackdrop").addEventListener("click", event => { if (event.target.id === "historyBackdrop") closeHistoryModal(); });

  $("#proofLinkClose").addEventListener("click", closeProofLinkModal);
  $("#proofLinkDone").addEventListener("click", closeProofLinkModal);
  $("#proofLinkCreate").addEventListener("click", createProofHabitFromModal);
  $("#proofHabitSearch").addEventListener("input", renderProofLinkModal);
  $("#proofLinkBackdrop").addEventListener("click", event => { if (event.target.id === "proofLinkBackdrop") closeProofLinkModal(); });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#globalSearch").focus();
    }
    if (event.key === "Escape") {
      closeUtilityMenu();
      closeModal();
      closeSettings();
      closeSidebar();
      closeGuide();
      closeFrictionModal();
      closeRoutineModal();
      closeFocusModal();
      closeStackModal();
      closeLoginModal();
      closeReminderModal();
      closeHistoryModal();
      closeProofLinkModal();
    }
  });
}

function populateStaticSelects() {
  $("#entityDomain").innerHTML = Object.entries(DOMAINS).map(([id, item]) => `<option value="${id}">${item.name}</option>`).join("");
  $("#domainFilter").innerHTML = `<option value="all">All domains</option>${Object.entries(DOMAINS).map(([id, item]) => `<option value="${id}">${item.name}</option>`).join("")}`;
  renderDayPicker(DAYS);
}

function renderDayPicker(selected = []) {
  activeDayPickerDays = selected;
  $("#dayPicker").innerHTML = DAYS.map(day => `<button type="button" data-day="${day}" class="${selected.includes(day) ? "active" : ""}">${day.slice(0, 3)}</button>`).join("");
}

function populateLinkSelects(excludeTaskId = "") {
  const taskOptions = activeTasks()
    .filter(task => task.id !== excludeTaskId)
    .map(task => `<option value="${task.id}">${escapeHtml(task.name)}</option>`)
    .join("");
  $("#stackAfterSelect").innerHTML = `<option value="">No stack trigger</option>${taskOptions}`;
  $("#stackBase").innerHTML = taskOptions || `<option value="">Add a task first</option>`;
  $("#stackNext").innerHTML = taskOptions || `<option value="">Add a task first</option>`;
  $("#goalLinkSelect").innerHTML = `<option value="">No linked goal</option>${state.goals.map(goal => `<option value="${goal.id}">${escapeHtml(goal.name)}</option>`).join("")}`;
}

function navigate(route) {
  currentRoute = route;
  $$(".view").forEach(view => view.classList.toggle("active", view.dataset.view === route));
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.route === route));
  $$(".mobile-dock [data-route]").forEach(item => item.classList.toggle("active", item.dataset.route === route));
  syncTopbarContext();
  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderAll();
}

function toggleUtilityMenu() {
  const menu = $("#utilityMenu");
  const button = $("#utilityMenuButton");
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
}

function closeUtilityMenu() {
  const menu = $("#utilityMenu");
  const button = $("#utilityMenuButton");
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  button?.setAttribute("aria-expanded", "false");
}

function syncTopbarContext() {
  const [title, subtext] = TOPBAR_CONTEXT[currentRoute] || TOPBAR_CONTEXT.today;
  const titleNode = $("#topbarRouteTitle");
  const subtextNode = $("#topbarRouteSubtext");
  if (titleNode) titleNode.textContent = title;
  if (subtextNode) subtextNode.textContent = subtext;
}

function renderAll() {
  renderDate();
  syncTopbarContext();
  renderMetrics();
  renderTodayTasks();
  renderDomains();
  renderStackCard();
  renderGoalSpotlight();
  renderRecoveryCard();
  renderFriction();
  renderTemplates();
  renderTagFilter();
  renderTaskLibrary();
  renderGoals();
  if ($("#proofLinkBackdrop")?.hidden === false) renderProofLinkModal();
  renderInsights();
  renderDomainBoard();
  renderReviewStats();
  renderMobileSummary();
  renderReminderList();
  renderRoutineLauncher();
  syncAccountUi();
  $("#taskNavCount").textContent = activeTasks().length;
  $("#seasonName").textContent = state.currentSeason;
  $("#seasonNote").textContent = seasonCopy(state.currentSeason);
  $("#seasonMeter").style.width = `${Math.min(92, Math.max(24, buildAnalytics(7).completionRate))}%`;
}

function renderDate() {
  const date = dateFromOffset(selectedDateOffset);
  $("#todayDate").textContent = date.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  $("#todayPicker").textContent = selectedDateOffset === 0 ? "Today" : date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  $("#greetingWord").textContent = selectedDateOffset === 0 ? timeGreeting(new Date()) : selectedDateOffset > 0 ? "Planning ahead" : "Reviewing";
}

function renderMetrics() {
  const key = dateKey();
  const todayTasks = tasksForKey(key);
  const done = todayTasks.filter(task => isDone(task.id, key)).length;
  const micro = todayTasks.filter(task => isMicro(task.id, key)).length;
  const todayRate = percent((done + micro * 0.5) / Math.max(todayTasks.length, 1));
  const week = buildAnalytics(7);
  const activeDomainIds = activeDomainIdsForAnalytics(week);
  const availableDomains = availableDomainIds();
  const domainsTouched = activeDomainIds.length;

  $("#domainActiveCount").textContent = `${domainsTouched}/${availableDomains.length || Object.keys(DOMAINS).length}`;
  renderOrbitPlanets(activeDomainIds);
  $("#orbitSignalTitle").textContent = signalTitle(week, todayRate);
  $("#orbitSignalCopy").textContent = signalCopy(week);

  const metrics = isMobileRuntime()
    ? [
      ["Today", `${todayRate}%`, `${done} full, ${micro} min`, week.bars],
      ["Momentum", String(week.proofScore), `${week.activeDays} active days`, week.bars],
      ["Breadth", `${domainsTouched}/${availableDomains.length || 7}`, "Domains touched", week.bars]
    ]
    : [
      ["Today's progress", `${todayRate}%`, `${done} full wins, ${micro} minimum wins`, week.bars],
      ["Momentum", String(week.proofScore), `${week.activeDays} active days in range`, week.bars],
      ["Recovery", `${week.recoveryLabel}`, `${week.restarts} gentle restarts`, week.bars],
      ["Breadth this week", `${domainsTouched} / ${availableDomains.length || 7}`, "Domains with real proof", week.bars]
    ];

  $("#metricGrid").innerHTML = metrics.map(([label, value, note, bars]) => `
    <article class="metric-card">
      <small>${label}</small>
      <strong>${value}</strong>
      <p>${note}</p>
      <span class="metric-spark">${bars.map(height => `<i style="height:${Math.max(5, height)}px"></i>`).join("")}</span>
    </article>
  `).join("");
}

function renderOrbitPlanets(activeDomainIds) {
  const root = $("#orbitPlanets");
  if (!root) return;
  const count = activeDomainIds.length;
  root.innerHTML = activeDomainIds.map((id, index) => {
    const item = DOMAINS[id];
    const angle = Math.round((360 / Math.max(count, 1)) * index + 12);
    const distance = index % 2 ? 120 : 88;
    const speed = 18 + index * 3;
    return `<i class="planet" title="${escapeHtml(item.name)} active" style="--orbit-angle:${angle}deg; --orbit-distance:${distance}px; --orbit-speed:${speed}s; --planet-color:${item.color}"></i>`;
  }).join("");
}

function renderMobileSummary() {
  const key = dateKey();
  const tasks = tasksForKey(key);
  const open = tasks.filter(task => !isDone(task.id, key)).length;
  const done = tasks.filter(task => isDone(task.id, key)).length;
  const micro = tasks.filter(task => isMicro(task.id, key)).length;
  const next = tasks.find(task => !isDone(task.id, key));
  $("#mobileTodayStrip").innerHTML = `
    <article><span>Open</span><strong>${open}</strong></article>
    <article><span>Done</span><strong>${done}</strong></article>
    <article><span>Minimum</span><strong>${micro}</strong></article>
    <button class="mobile-next-card" ${next ? `data-mobile-next="${next.id}"` : "disabled"}>
      <span>Next</span><strong>${next ? escapeHtml(next.name) : "All clear"}</strong>
    </button>
  `;
  const nextButton = $("[data-mobile-next]", $("#mobileTodayStrip"));
  if (nextButton) nextButton.addEventListener("click", () => $("#dayPlan").scrollIntoView({ behavior: "smooth" }));
}

function renderTodayTasks() {
  const key = dateKey();
  const tasks = tasksForKey(key);
  const openTasks = tasks.filter(task => !isDone(task.id, key));
  const completedTasks = tasks.filter(task => isDone(task.id, key));
  const grouped = [...PERIODS, "Flexible"];
  const activeHtml = grouped.map(group => {
    const items = openTasks.filter(task => (task.period || "Flexible") === group);
    if (!items.length) return "";
    return `<div class="task-group"><div class="task-group-label">${group}</div>${items.map(task => todayTaskTemplate(task, key)).join("")}</div>`;
  }).join("");
  const emptyHtml = openTasks.length ? "" : `<div class="empty-active-plan"><strong>All planned tasks are cleared.</strong><span>Beautiful. Your remaining work is only lectures, reflection, or rest.</span></div>`;
  $("#todayTaskGroups").innerHTML = activeHtml + emptyHtml + lectureBlock(key) + completedLayer(completedTasks, key);

  bindTaskActions($("#todayTaskGroups"));
  bindLectureActions();
  const done = tasks.filter(task => isDone(task.id, key)).length;
  const micro = tasks.filter(task => isMicro(task.id, key)).length;
  $("#planProgress").style.width = `${percent((done + micro * 0.5) / Math.max(tasks.length, 1))}%`;
  $("#loadChip").innerHTML = loadChip(tasks.length);
}

function completedLayer(tasks, key) {
  if (!tasks.length) return "";
  return `<details class="completed-layer">
    <summary><span>Completed today</span><strong>${tasks.length}</strong><small>Collapsed proof layer</small></summary>
    <div class="completed-layer-body">${tasks.map(task => todayTaskTemplate(task, key, { completedLayer: true })).join("")}</div>
  </details>`;
}

function todayTaskTemplate(task, key, options = {}) {
  if (isMobileRuntime()) return todayTaskMobileTemplate(task, key, options);
  const d = domain(task.domain);
  const micro = isMicro(task.id, key);
  const done = isDone(task.id, key);
  const stack = task.stackAfter ? `<span class="stack-note">After ${escapeHtml(taskName(task.stackAfter))}</span>` : "";
  const goal = task.goalId ? `<span class="goal-note">${escapeHtml(goalName(task.goalId))}</span>` : "";
  const tags = task.tags?.length ? `<span class="tag-strip">${task.tags.slice(0, 3).map(tag => `<i>${escapeHtml(tag)}</i>`).join("")}</span>` : "";
  return `<article class="today-task ${done ? "done" : ""} ${options.completedLayer ? "in-completed-layer" : ""}" data-task-row="${task.id}">
    <button class="task-check" data-complete="${task.id}" aria-label="${done ? "Reopen" : "Mark"} ${escapeHtml(task.name)}">${done ? "Undo" : "OK"}</button>
    <div>
      <span class="task-name">${escapeHtml(task.name)}</span>
      <span class="task-detail"><i class="domain-dot" style="--domain-color:${d.color}"></i>${d.name}${stack}${goal}${tags}</span>
      <span class="task-detail help-line">${done ? "Full win counted. Expand this layer anytime to reopen it." : micro ? "Minimum version counted." : escapeHtml(task.minimum || "No minimum version set yet.")}</span>
    </div>
    <div class="task-menu">
      <span class="task-time">${escapeHtml(task.time || "Flexible")} - ${task.duration || 10}m</span>
      ${done ? "" : `<button data-micro="${task.id}" class="micro-button">Minimum</button>`}
      <button data-menu="${task.id}" aria-label="Task actions">...</button>
    </div>
  </article>`;
}

function todayTaskMobileTemplate(task, key, options = {}) {
  const d = domain(task.domain);
  const micro = isMicro(task.id, key);
  const done = isDone(task.id, key);
  const time = task.time || "Flexible";
  const meta = done ? "Completed today" : micro ? "Minimum counted" : escapeHtml(task.minimum || "Minimum not set");
  return `<article class="today-task mobile-task-row ${done ? "done" : ""} ${options.completedLayer ? "in-completed-layer" : ""}" data-task-row="${task.id}">
    <button class="task-check" data-complete="${task.id}" aria-label="${done ? "Reopen" : "Mark"} ${escapeHtml(task.name)}">${done ? "Undo" : "OK"}</button>
    <div>
      <span class="task-name">${escapeHtml(task.name)}</span>
      <span class="task-detail"><i class="domain-dot" style="--domain-color:${d.color}"></i>${escapeHtml(d.name)}<span class="mobile-time-chip">${escapeHtml(time)}</span><span>${meta}</span></span>
    </div>
    <div class="task-menu">
      ${done ? "" : `<button data-micro="${task.id}" class="micro-button">Minimum</button>`}
      <button data-menu="${task.id}" aria-label="Task actions">...</button>
    </div>
  </article>`;
}

function lectureBlock(key) {
  const lectures = lectureTasks[dayNameForKey(key)] || [];
  if (!lectures.length) return "";
  if (isMobileRuntime()) return mobileLectureBlock(key, lectures);
  return `<div class="task-group"><div class="task-group-label">Flexible lectures - may not hold</div>${lectures.map(([name, time]) => {
    const id = lectureId(key, name);
    const status = state.lectures[key]?.[id] || "";
    return `<article class="today-task lecture-task ${status ? "done" : ""}">
      <button class="task-check ${status === "attended" ? "lecture-attended" : ""}" data-lecture-status="${id}" data-status="attended">OK</button>
      <div><span class="task-name">${escapeHtml(name)}</span><span class="task-detail"><i class="domain-dot" style="--domain-color:${DOMAINS.scholar.color}"></i>${time} - mark whether it held</span></div>
      <div class="lecture-actions">
        <button class="${status === "attended" ? "active" : ""}" data-lecture-status="${id}" data-status="attended">Attended</button>
        <button class="${status === "cancelled" ? "active" : ""}" data-lecture-status="${id}" data-status="cancelled">Did not hold</button>
      </div>
    </article>`;
  }).join("")}</div>`;
}

function mobileLectureBlock(key, lectures) {
  return `<div class="task-group mobile-lecture-group"><div class="task-group-label">Lectures - may not hold</div>${lectures.map(([name, time]) => {
    const id = lectureId(key, name);
    const status = state.lectures[key]?.[id] || "";
    return `<article class="today-task lecture-task mobile-task-row ${status ? "done" : ""}">
      <button class="task-check ${status === "attended" ? "lecture-attended" : ""}" data-lecture-status="${id}" data-status="attended">OK</button>
      <div><span class="task-name">${escapeHtml(name)}</span><span class="task-detail"><i class="domain-dot" style="--domain-color:${DOMAINS.scholar.color}"></i>${escapeHtml(time)}<span>${status === "cancelled" ? "Did not hold" : status === "attended" ? "Attended" : "Confirm"}</span></span></div>
      <div class="lecture-actions">
        <button class="${status === "attended" ? "active" : ""}" data-lecture-status="${id}" data-status="attended">Attended</button>
        <button class="${status === "cancelled" ? "active" : ""}" data-lecture-status="${id}" data-status="cancelled">No class</button>
      </div>
    </article>`;
  }).join("")}</div>`;
}

function bindTaskActions(root) {
  $$("[data-complete]", root).forEach(button => button.addEventListener("click", () => toggleComplete(button.dataset.complete)));
  $$("[data-micro]", root).forEach(button => button.addEventListener("click", () => countMicro(button.dataset.micro)));
  $$("[data-menu]", root).forEach(button => button.addEventListener("click", event => openTaskMenu(event, button.dataset.menu)));
}

function bindLectureActions() {
  $$("[data-lecture-status]").forEach(button => button.addEventListener("click", () => {
    const key = dateKey();
    state.lectures[key] = state.lectures[key] || {};
    state.lectures[key][button.dataset.lectureStatus] = button.dataset.status;
    saveState();
    renderAll();
    toast(button.dataset.status === "attended" ? "Lecture attendance logged" : "Lecture marked as not held");
  }));
}

function toggleComplete(id, forcedValue = null) {
  const key = dateKey();
  state.completions[key] = state.completions[key] || {};
  const next = forcedValue === null ? !state.completions[key][id] : forcedValue;
  state.completions[key][id] = next;
  if (next && state.microWins[key]) delete state.microWins[key][id];
  saveState();
  renderAll();
  toast(next ? "Full win counted. Keep the rhythm gentle." : "Task reopened");
}

function countMicro(id) {
  const key = dateKey();
  state.microWins[key] = state.microWins[key] || {};
  state.microWins[key][id] = true;
  saveState();
  renderAll();
  toast("Minimum version counted. Continuity protected.");
}

function openTaskMenu(event, id) {
  event.stopPropagation();
  $$(".task-popover").forEach(item => item.remove());
  const owner = event.currentTarget.closest(".task-menu") || event.currentTarget.closest(".goal-menu");
  const task = state.tasks.find(item => item.id === id);
  const popover = document.createElement("div");
  const shouldOpenUp = event.currentTarget.getBoundingClientRect().bottom > window.innerHeight - 180;
  popover.className = `task-popover ${shouldOpenUp ? "open-up" : ""}`;
  popover.innerHTML = `
    <button data-edit-action>Edit</button>
    <button data-history-action>History</button>
    <button data-archive-action>${task?.archived ? "Restore" : "Archive"}</button>
    <button class="danger" data-delete-action>Delete</button>
  `;
  owner.appendChild(popover);
  $("[data-edit-action]", popover).addEventListener("click", () => openEntityModal("task", id));
  $("[data-history-action]", popover).addEventListener("click", () => openHistoryModal(id));
  $("[data-archive-action]", popover).addEventListener("click", () => archiveTask(id));
  $("[data-delete-action]", popover).addEventListener("click", () => deleteTask(id));
  setTimeout(() => document.addEventListener("click", () => popover.remove(), { once: true }), 0);
}

function archiveTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  task.archived = !task.archived;
  saveState();
  renderAll();
  toast(task.archived ? "Task archived" : "Task restored");
}

function deleteTask(id) {
  const task = state.tasks.find(item => item.id === id);
  state.tasks = state.tasks.filter(item => item.id !== id);
  state.tasks.forEach(item => {
    if (item.stackAfter === id) item.stackAfter = "";
    if (item.goalId === id) item.goalId = "";
  });
  saveState();
  renderAll();
  toast(`Deleted "${task?.name || "task"}"`);
}

function renderDomains() {
  const analytics = buildAnalytics(7);
  const limit = isMobileRuntime() ? 4 : 5;
  $("#domainList").innerHTML = Object.entries(DOMAINS).slice(0, limit).map(([id, item]) => {
    const value = analytics.domainScores[id]?.score || 0;
    const frozen = isDomainFrozen(id);
    return `<div class="domain-row" style="--domain-color:${item.color}">
      <span class="domain-symbol">${item.icon}</span>
      <div><strong>${item.name}</strong><div class="domain-meter"><span style="width:${frozen ? 0 : value}%"></span></div></div>
      <small>${frozen ? "Frozen" : `${value}%`}</small>
    </div>`;
  }).join("");
}

function renderStackCard() {
  const stacks = activeTasks().filter(task => task.stackAfter);
  const stackLimit = isMobileRuntime() ? 2 : 5;
  $("#stackCard").innerHTML = `
    <p class="overline">HABIT STACKS</p>
    <h3>Action chains</h3>
    ${isMobileRuntime() ? "" : `<p class="mini-help">A stack means: after one anchor, do the next tiny action.</p>`}
    <div class="stack-list">
      ${stacks.length ? stacks.slice(0, stackLimit).map(task => `<div><strong>${escapeHtml(taskName(task.stackAfter))}</strong><span>then ${escapeHtml(task.name)}</span></div>`).join("") : `<div><strong>No stacks yet</strong><span>Attach habits so the next action is obvious.</span></div>`}
    </div>
    <button class="card-link" id="openStackFromCard">Build a new stack <span>-></span></button>
  `;
  $("#openStackFromCard").addEventListener("click", openStackModal);
}

function renderGoalSpotlight() {
  const goal = [...state.goals].sort((a, b) => goalProofScore(b.id, 7) - goalProofScore(a.id, 7))[0];
  if (!goal) {
    $("#goalSpotlight").innerHTML = `<p class="overline">GOAL IN ORBIT</p><h3>No active goal yet</h3><button class="card-link" data-add-goal>Start one <span>-></span></button>`;
    $("[data-add-goal]", $("#goalSpotlight")).addEventListener("click", () => openEntityModal("goal"));
    return;
  }
  const linked = linkedTasks(goal.id);
  const proof = goalProofScore(goal.id, 7);
  if (isMobileRuntime()) {
    $("#goalSpotlight").innerHTML = `
      <p class="overline">GOAL IN ORBIT</p>
      <h3>${escapeHtml(goal.name)}</h3>
      <div class="goal-progress-head"><span>${linked.length} proof habit${linked.length === 1 ? "" : "s"}</span><strong>${proof}</strong></div>
      <div class="goal-progress"><span style="width:${Math.min(100, proof * 10)}%"></span></div>
      <button class="card-link" data-route-jump="goals">Open goals <span>-></span></button>
    `;
    $("[data-route-jump]", $("#goalSpotlight")).addEventListener("click", event => navigate(event.currentTarget.dataset.routeJump));
    return;
  }
  $("#goalSpotlight").innerHTML = `
    <p class="overline">GOAL IN ORBIT</p>
    <h3>${escapeHtml(goal.name)}</h3>
    <p>${escapeHtml(goal.note)}</p>
    <div class="goal-progress-head"><span>${linked.length} proof habit${linked.length === 1 ? "" : "s"} this week</span><strong>${proof}</strong></div>
    <div class="goal-progress"><span style="width:${Math.min(100, proof * 10)}%"></span></div>
  `;
}

function renderRecoveryCard() {
  const analytics = buildAnalytics(7);
  $("#recoveryCard").innerHTML = `
    <div class="recovery-icon">R</div>
    <div><p class="overline">RECOVERY WINS</p><h3>${analytics.restarts} restart${analytics.restarts === 1 ? "" : "s"}</h3>${isMobileRuntime() ? "" : `<p>${analytics.slips ? `${analytics.slips} slip${analytics.slips === 1 ? "" : "s"} logged. Recovery data beats pretending.` : "No slips logged in this range. Keep observing without pressure."}</p>`}</div>
  `;
}

function renderFriction() {
  const key = dateKey();
  const current = state.friction[key] || {};
  $("#frictionLog").innerHTML = FRICTIONS.map(item => {
    const record = normalizeFrictionRecord(current[item.id] || {});
    const status = record.status;
    return `<div class="friction-item">
      <div><strong>${item.name}</strong><small>${record.trigger ? `Trigger: ${escapeHtml(record.trigger)}` : item.cue}</small>${record.replacement ? `<small>Replacement: ${escapeHtml(record.replacement)}</small>` : ""}</div>
      <div class="friction-actions">
        <button class="${status === "resisted" ? "active" : ""}" data-friction="${item.id}" data-friction-status="resisted">Resisted</button>
        <button class="${status === "slipped" ? "active" : ""}" data-friction="${item.id}" data-friction-status="slipped">Slipped</button>
      </div>
    </div>`;
  }).join("");
  $$("[data-friction]").forEach(button => button.addEventListener("click", () => openFrictionModal(button.dataset.friction, button.dataset.frictionStatus)));
}

function renderTemplates() {
  $("#templatePanel").innerHTML = `
    <details class="template-drawer">
      <summary>
        <span><i>Routine packs</i><strong>${TEMPLATE_LIBRARY.length} editable packs</strong></span>
        <small>Use these only when you want to add a proven mini-system.</small>
      </summary>
      <div class="template-grid">
        ${TEMPLATE_LIBRARY.map(template => `<button data-template="${template.id}"><strong>${template.name}</strong><span>${template.description}</span></button>`).join("")}
      </div>
    </details>
  `;
  $$("[data-template]").forEach(button => button.addEventListener("click", () => applyTemplate(button.dataset.template)));
}

function renderTaskLibrary() {
  const root = $("#taskLibraryList");
  syncTaskFilterButtons();
  const query = $("#taskSearch")?.value.trim().toLowerCase() || "";
  const domainFilter = $("#domainFilter")?.value || "all";
  const tagFilter = $("#tagFilter")?.value || "all";
  const key = dateKey();
  const filtered = state.tasks.filter(task => {
    if (taskFilter === "archived") {
      if (!task.archived) return false;
    } else if (task.archived) {
      return false;
    }
    if (taskFilter === "today" && !taskMatchesDate(task, key)) return false;
    if (taskFilter === "daily" && task.schedule !== "daily") return false;
    if (taskFilter === "weekly" && task.schedule !== "weekly") return false;
    if (taskFilter === "custom" && !["every-x", "monthly", "seasonal", "once"].includes(task.schedule)) return false;
    if (domainFilter !== "all" && task.domain !== domainFilter) return false;
    if (tagFilter !== "all" && !task.tags.includes(tagFilter)) return false;
    if (query) {
      const haystack = `${task.name} ${task.minimum} ${task.note} ${domain(task.domain).name} ${task.tags.join(" ")} ${goalName(task.goalId)}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const shouldGroupCompleted = taskFilter !== "archived";
  const openTasks = shouldGroupCompleted ? filtered.filter(task => !isDone(task.id, key)) : filtered;
  const completedTasks = shouldGroupCompleted ? filtered.filter(task => isDone(task.id, key)) : [];
  const openHtml = openTasks.map(task => taskLibraryRow(task, key)).join("");
  const emptyHtml = !filtered.length
    ? `<div class="empty-state compact-empty"><strong>No tasks found</strong>Try another filter, import data, or install a template.</div>`
    : !openTasks.length
      ? `<div class="empty-state compact-empty"><strong>All matching tasks are complete.</strong>Open the completed layer below if you need to undo one.</div>`
      : "";
  root.innerHTML = openHtml + emptyHtml + completedTaskLibraryLayer(completedTasks, key);
  bindTaskActions(root);
}

function taskLibraryRow(task, key) {
  if (isMobileRuntime()) return taskLibraryMobileRow(task, key);
  const d = domain(task.domain);
  const done = isDone(task.id, key);
  const proof = taskProof(task.id, 14);
  const stackLabel = task.stackAfter ? `After ${taskName(task.stackAfter)}` : "No stack";
  const goalLabel = task.goalId ? goalName(task.goalId) : "No goal";
  const tags = task.tags || [];
  return `<article class="library-row ${done ? "done library-row-complete" : ""}">
    <div class="library-task">
      <button class="task-check ${done ? "checked" : ""}" data-complete="${task.id}" aria-label="${done ? "Reopen" : "Mark"} ${escapeHtml(task.name)}">${done ? "Undo" : "OK"}</button>
      <div>
        <strong>${escapeHtml(task.name)}</strong>
        <small>${done ? "Completed today" : escapeHtml(task.minimum || "No minimum version set")}</small>
        <span class="tag-strip">${tags.map(tag => `<i>${escapeHtml(tag)}</i>`).join("")}</span>
        <span class="mobile-row-meta">
          <i class="domain-mobile" style="--domain-color:${d.color}">${escapeHtml(d.name)}</i>
          <i>${escapeHtml(scheduleLabel(task))}</i>
          <i>${escapeHtml(stackLabel)}</i>
          <i>${proof.full} full / ${proof.micro} min</i>
        </span>
      </div>
    </div>
    <span class="domain-chip" style="--domain-color:${d.color}"><i></i>${escapeHtml(d.name)}</span>
    <span class="schedule-chip">${escapeHtml(scheduleLabel(task))}</span>
    <span class="stack-goal-cell">${escapeHtml(stackLabel)}<small>${escapeHtml(goalLabel)}</small></span>
    <span class="row-progress">${proof.full} full / ${proof.micro} min<span><i style="width:${Math.min(100, proof.score * 10)}%"></i></span></span>
    <div class="task-menu"><button data-menu="${task.id}" aria-label="Task actions">...</button></div>
  </article>`;
}

function taskLibraryMobileRow(task, key) {
  const d = domain(task.domain);
  const done = isDone(task.id, key);
  return `<article class="library-row mobile-library-row ${done ? "done library-row-complete" : ""}">
    <div class="library-task">
      <button class="task-check ${done ? "checked" : ""}" data-complete="${task.id}" aria-label="${done ? "Reopen" : "Mark"} ${escapeHtml(task.name)}">${done ? "Undo" : "OK"}</button>
      <div>
        <strong>${escapeHtml(task.name)}</strong>
        <small>${done ? "Completed today" : escapeHtml(task.minimum || "Minimum not set")}</small>
        <span class="mobile-row-meta">
          <i class="domain-mobile" style="--domain-color:${d.color}">${escapeHtml(d.name)}</i>
          <i>${escapeHtml(scheduleLabel(task))}</i>
        </span>
      </div>
    </div>
    <div class="task-menu"><button data-menu="${task.id}" aria-label="Task actions">...</button></div>
  </article>`;
}

function completedTaskLibraryLayer(tasks, key) {
  if (!tasks.length) return "";
  return `<details class="completed-layer library-completed-layer">
    <summary><span>Completed today</span><strong>${tasks.length}</strong><small>Hidden from active work</small></summary>
    <div class="completed-layer-body">${tasks.map(task => taskLibraryRow(task, key)).join("")}</div>
  </details>`;
}

function syncTaskFilterButtons() {
  $$("#taskFilters [data-filter]").forEach(button => button.classList.toggle("active", button.dataset.filter === taskFilter));
}

function renderGoals() {
  const avg = Math.round(state.goals.reduce((sum, goal) => sum + Number(goal.progress), 0) / Math.max(state.goals.length, 1));
  const linkedCount = state.tasks.filter(task => task.goalId && !task.archived).length;
  const weekProof = Math.round(state.goals.reduce((sum, goal) => sum + goalProofScore(goal.id, 7), 0));
  const goalMetrics = isMobileRuntime()
    ? [
      ["Goals", state.goals.length, "Active"],
      ["Proof", weekProof, "This week"],
      ["Linked", linkedCount, "Habits"]
    ]
    : [
      ["Active goals", state.goals.length, "Long arcs"],
      ["Average progress", `${avg}%`, "Self-reported"],
      ["Linked habits", linkedCount, "Daily proof"],
      ["Proof this week", weekProof, "Full + minimum"]
    ];
  $("#goalSummary").innerHTML = goalMetrics.map(([label, value, note]) => `<article class="summary-card goal-kpi"><span><small>${label}</small><em>${note}</em></span><strong>${value}</strong></article>`).join("");

  $("#goalGrid").innerHTML = state.goals.length ? state.goals.map(goal => {
    const d = domain(goal.domain);
    const linked = linkedTasks(goal.id);
    const proof = goalProofScore(goal.id, 7);
    const linkedPreview = linked.length ? linked.slice(0, 3).map(task => `<span>${escapeHtml(task.name)}</span>`).join("") : `<span>No proof habit linked yet</span>`;
    if (isMobileRuntime()) return mobileGoalCard(goal, d, linked, proof, linkedPreview);
    return `<article class="goal-card" style="--domain-color:${d.color}">
      <div class="goal-menu"><button class="more-button" data-goal-menu="${goal.id}">...</button></div>
      <div class="goal-card-main">
        <span class="goal-icon">${d.icon}</span>
        <div>
          <span class="goal-domain">${escapeHtml(d.name)}</span>
          <h3>${escapeHtml(goal.name)}</h3>
          <p>${escapeHtml(goal.note)}</p>
        </div>
      </div>
      <div class="linked-proof">${linkedPreview}</div>
      <div class="goal-card-footer">
        <div class="goal-progress-head"><span>${proof} proof actions this week</span><strong>${goal.progress}%</strong></div>
        <div class="goal-progress"><span style="width:${goal.progress}%"></span></div>
        <div class="goal-footer-row">
          <small>${goal.date ? `Target ${formatDate(goal.date)}` : "Open horizon"}</small>
          <button type="button" class="goal-proof-button" data-goal-proof="${goal.id}">${linked.length ? "Find next proof" : "Link proof habit"}</button>
        </div>
      </div>
    </article>`;
  }).join("") : `<article class="empty-state card"><strong>Your next horizon starts here</strong>Add a goal and connect it to one tiny recurring action.</article>`;
  $$("[data-goal-menu]").forEach(button => button.addEventListener("click", event => openGoalMenu(event, button.dataset.goalMenu)));
  $$("[data-goal-proof]").forEach(button => button.addEventListener("click", () => openGoalProofAction(button.dataset.goalProof)));
}

function mobileGoalCard(goal, d, linked, proof, linkedPreview) {
  return `<article class="goal-card mobile-goal-card" style="--domain-color:${d.color}">
    <div class="goal-menu"><button class="more-button" data-goal-menu="${goal.id}">...</button></div>
    <div class="goal-card-main">
      <span class="goal-icon">${d.icon}</span>
      <div>
        <span class="goal-domain">${escapeHtml(d.name)}</span>
        <h3>${escapeHtml(goal.name)}</h3>
        <p>${escapeHtml(goal.note || "No note yet.")}</p>
      </div>
    </div>
    <div class="linked-proof">${linkedPreview}</div>
    <div class="goal-card-footer">
      <div class="goal-progress-head"><span>${proof} proof this week</span><strong>${goal.progress}%</strong></div>
      <div class="goal-progress"><span style="width:${goal.progress}%"></span></div>
      <div class="goal-footer-row">
        <small>${goal.date ? formatDate(goal.date) : "Open horizon"}</small>
        <button type="button" class="goal-proof-button" data-goal-proof="${goal.id}">${linked.length ? "Next proof" : "Link habit"}</button>
      </div>
    </div>
  </article>`;
}

function openGoalMenu(event, id) {
  event.stopPropagation();
  $$(".task-popover").forEach(item => item.remove());
  const owner = event.currentTarget.closest(".goal-menu");
  const pop = document.createElement("div");
  const shouldOpenUp = event.currentTarget.getBoundingClientRect().bottom > window.innerHeight - 150;
  pop.className = `task-popover ${shouldOpenUp ? "open-up" : ""}`;
  pop.innerHTML = `<button data-edit-action>Edit</button><button class="danger" data-delete-action>Delete</button>`;
  owner.appendChild(pop);
  $("[data-edit-action]", pop).addEventListener("click", () => openEntityModal("goal", id));
  $("[data-delete-action]", pop).addEventListener("click", () => deleteGoal(id));
  setTimeout(() => document.addEventListener("click", () => pop.remove(), { once: true }), 0);
}

function deleteGoal(id) {
  const goal = state.goals.find(item => item.id === id);
  state.goals = state.goals.filter(item => item.id !== id);
  state.tasks.forEach(task => { if (task.goalId === id) task.goalId = ""; });
  saveState();
  renderAll();
  toast(`Deleted "${goal?.name || "goal"}"`);
}

function openGoalProofAction(goalId) {
  openProofLinkModal(goalId);
}

function openProofLinkModal(goalId) {
  const goal = state.goals.find(item => item.id === goalId);
  if (!goal) {
    toast("That goal could not be found");
    return;
  }
  proofLinkGoalId = goalId;
  $("#proofHabitSearch").value = "";
  $("#proofLinkBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  renderProofLinkModal();
  setTimeout(() => $("#proofHabitSearch").focus(), 80);
}

function closeProofLinkModal() {
  const backdrop = $("#proofLinkBackdrop");
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  proofLinkGoalId = "";
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function renderProofLinkModal() {
  if (!proofLinkGoalId || $("#proofLinkBackdrop")?.hidden !== false) return;
  const goal = state.goals.find(item => item.id === proofLinkGoalId);
  if (!goal) {
    closeProofLinkModal();
    return;
  }
  const linked = linkedTasks(goal.id);
  const candidates = proofHabitCandidates(goal, $("#proofHabitSearch").value);
  const goalDomain = domain(goal.domain);
  const proof = goalProofScore(goal.id, 14);

  $("#proofLinkTitle").textContent = `Proof habits for ${goal.name}`;
  $("#proofGoalPanel").style.setProperty("--domain-color", goalDomain.color);
  $("#proofGoalPanel").innerHTML = `
    <span class="proof-goal-icon">${goalDomain.icon}</span>
    <div>
      <small>${escapeHtml(goalDomain.name)} goal</small>
      <h3>${escapeHtml(goal.name)}</h3>
      <p>${escapeHtml(goal.note || "No note yet. Link a tiny repeatable action so progress becomes visible.")}</p>
    </div>
    <div class="proof-goal-stats">
      <span><strong>${linked.length}</strong><small>Linked habits</small></span>
      <span><strong>${proof}</strong><small>14-day proof</small></span>
    </div>
  `;
  $("#proofLinkedCount").textContent = `${linked.length} linked`;
  $("#proofSuggestionCount").textContent = `${candidates.length} found`;
  $("#proofLinkedList").innerHTML = linked.length
    ? linked.map(task => proofHabitRow(task, goal, "linked")).join("")
    : proofEmptyState("No habits are proving this goal yet.", "Link one existing habit or create a new tiny proof habit below.");
  $("#proofSuggestionList").innerHTML = candidates.length
    ? candidates.map(task => proofHabitRow(task, goal, "candidate")).join("")
    : proofEmptyState("No unlinked habits match this search.", "Create a new proof habit, or clear the search to see more options.");

  $$("[data-proof-link]").forEach(button => button.addEventListener("click", () => linkProofHabit(button.dataset.proofLink)));
  $$("[data-proof-unlink]").forEach(button => button.addEventListener("click", () => unlinkProofHabit(button.dataset.proofUnlink)));
  $$("[data-proof-view]").forEach(button => button.addEventListener("click", () => showProofHabitInTaskLibrary(button.dataset.proofView)));
}

function proofHabitCandidates(goal, query = "") {
  const needle = query.trim().toLowerCase();
  return activeTasks()
    .filter(task => !task.goalId)
    .filter(task => {
      if (!needle) return true;
      return [
        task.name,
        task.minimum,
        task.note,
        domain(task.domain).name,
        scheduleLabel(task),
        (task.tags || []).join(" ")
      ].some(value => String(value || "").toLowerCase().includes(needle));
    })
    .sort((a, b) => proofCandidateScore(b, goal) - proofCandidateScore(a, goal) || a.name.localeCompare(b.name))
    .slice(0, 12);
}

function proofCandidateScore(task, goal) {
  let score = 0;
  if (task.domain === goal.domain) score += 5;
  if (taskMatchesDate(task, dateKey())) score += 3;
  if (task.schedule === "daily") score += 2;
  if (task.minimum) score += 1;
  if ((task.tags || []).some(tag => ["proof", "kaizen", "daily"].includes(tag))) score += 1;
  return score;
}

function proofHabitRow(task, goal, mode) {
  const taskDomain = domain(task.domain);
  const proof = taskProof(task.id, 14);
  const proofLabel = proof.full || proof.micro ? `${proof.full} full / ${proof.micro} min` : "No proof yet";
  const sameDomain = task.domain === goal.domain;
  return `<article class="proof-habit-row" style="--domain-color:${taskDomain.color}">
    <span class="proof-habit-marker">${taskDomain.icon}</span>
    <div class="proof-habit-copy">
      <strong>${escapeHtml(task.name)}</strong>
      <span>${escapeHtml(task.minimum || task.note || "Add a minimum version so this can survive difficult days.")}</span>
      <div class="proof-habit-meta">
        <i>${escapeHtml(taskDomain.name)}</i>
        <i>${escapeHtml(scheduleLabel(task))}</i>
        <i>${proofLabel}</i>
        ${sameDomain ? "<i>Same domain</i>" : ""}
      </div>
    </div>
    <div class="proof-habit-actions">
      ${mode === "linked"
        ? `<button type="button" data-proof-view="${task.id}">View</button><button type="button" class="danger" data-proof-unlink="${task.id}">Unlink</button>`
        : `<button type="button" class="primary-mini-button" data-proof-link="${task.id}">Link</button>`}
    </div>
  </article>`;
}

function proofEmptyState(title, copy) {
  return `<article class="proof-empty"><strong>${title}</strong><span>${copy}</span></article>`;
}

function linkProofHabit(taskId) {
  const goal = state.goals.find(item => item.id === proofLinkGoalId);
  const task = state.tasks.find(item => item.id === taskId);
  if (!goal || !task) return;
  task.goalId = goal.id;
  saveState();
  renderAll();
  toast(`Linked "${task.name}" as proof for "${goal.name}"`);
}

function unlinkProofHabit(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  task.goalId = "";
  saveState();
  renderAll();
  toast(`Unlinked "${task.name}"`);
}

function showProofHabitInTaskLibrary(taskId) {
  const task = taskById(taskId);
  if (!task) return;
  closeProofLinkModal();
  navigate("tasks");
  taskFilter = "all";
  syncTaskFilterButtons();
  $("#taskSearch").value = task.name;
  $("#domainFilter").value = task.domain;
  $("#tagFilter").value = "all";
  renderTaskLibrary();
  toast(`Showing proof habit: ${task.name}`);
}

function createProofHabitFromModal() {
  const goal = state.goals.find(item => item.id === proofLinkGoalId);
  if (!goal) return;
  closeProofLinkModal();
  openEntityModal("task");
  $("#goalLinkSelect").value = goal.id;
  $("#entityDomain").value = goal.domain;
  $("#entityName").placeholder = `e.g. 10-minute proof for ${goal.name.slice(0, 34)}`;
  $("#entityMinimum").placeholder = "What tiny action proves this goal on a hard day?";
  $("#entityTags").value = "proof, kaizen";
  $("#entityNote").value = `Proof habit for: ${goal.name}`;
  toast("New habit will be linked to this goal");
}

function renderInsights() {
  const range = Number($("#insightRange")?.value || 7);
  const analytics = buildAnalytics(range);
  const insightMetrics = isMobileRuntime()
    ? [
      ["Complete", `${analytics.completionRate}%`, `${analytics.done}/${analytics.scheduled} scheduled`],
      ["Minimum", analytics.micro, "Zero-day protection"],
      ["Focus", analytics.focusMinutes, `${analytics.focusCount} session${analytics.focusCount === 1 ? "" : "s"}`]
    ]
    : [
      ["Completion rate", `${analytics.completionRate}%`, `${analytics.done} full wins from ${analytics.scheduled} scheduled tasks`],
      ["Minimum wins", analytics.micro, "Tiny versions that prevented zero days"],
      ["Resistance wins", analytics.resisted, `${analytics.slips} slips logged as recovery data`],
      ["Focus minutes", analytics.focusMinutes, `${analytics.focusCount} saved focus session${analytics.focusCount === 1 ? "" : "s"}`]
    ];
  $("#insightMetrics").innerHTML = insightMetrics.map(([label, value, note]) => `<article class="insight-metric"><small>${label}</small><strong>${value}</strong><p>${note}</p></article>`).join("");

  $("#weeklyChart").innerHTML = analytics.lastSeven.map(day => `
    <div class="bar-column">
      <div class="bar ${day.key === todayKey() ? "today" : ""}" style="--height:${Math.max(5, day.percent)}%"><em>${day.percent}%</em></div>
      <small>${day.label}</small>
    </div>
  `).join("");
  $("#trendChip").textContent = analytics.trendLabel;
  $("#weeklyChartInsight").textContent = weeklyChartInsight(analytics);
  $("#domainAnalytics").innerHTML = Object.entries(DOMAINS).map(([id, item]) => {
    const score = analytics.domainScores[id]?.score || 0;
    const proof = analytics.domainScores[id]?.proof || 0;
    const frozen = isDomainFrozen(id);
    return `<div class="domain-analytic-row ${frozen ? "frozen-domain" : ""}" style="--domain-color:${item.color}"><strong>${item.name}</strong><div class="domain-meter"><span style="width:${frozen ? 0 : score}%"></span></div><span>${frozen ? "Ice" : proof}</span></div>`;
  }).join("");
  $("#insightStory").innerHTML = insightStory(analytics);
  $("#heatmap").innerHTML = analytics.heatmap.map(day => `<i title="${day.key}: ${day.proof} proof actions" data-level="${day.level}"></i>`).join("");
  const apply = $("[data-apply-suggestion]", $("#insightStory"));
  if (apply) apply.addEventListener("click", applyInsightSuggestion);
}

function weeklyChartInsight(analytics) {
  const best = analytics.lastSeven.reduce((winner, day) => day.percent > winner.percent ? day : winner, { label: "-", percent: 0 });
  if (!analytics.done && !analytics.micro) return "Start with one minimum win today. The chart will become useful after the first proof.";
  if (analytics.completionRate < 35) return "The load is too loud right now. Protect three anchors and let everything else become optional minimums.";
  return `Best recent day hit ${best.percent}%. Repeat the cue from that day before adding more habits.`;
}

function renderDomainBoard() {
  const analytics = buildAnalytics(30);
  const entries = Object.entries(DOMAINS);
  if (!DOMAINS[selectedDomain]) selectedDomain = entries[0][0];
  const detail = DOMAINS[selectedDomain];
  const detailFrozen = isDomainFrozen(selectedDomain);
  const detailScore = analytics.domainScores[selectedDomain]?.score || 0;
  const detailProof = analytics.domainScores[selectedDomain]?.proof || 0;
  const detailTasks = domainTasks(selectedDomain);
  const detailGoals = state.goals.filter(goal => goal.domain === selectedDomain);
  const nextTask = detailFrozen ? null : detailTasks.find(task => taskMatchesDate(task, dateKey()) && !isDone(task.id)) || detailTasks[0];
  const available = availableDomainIds();
  const active = activeDomainIdsForAnalytics(analytics);
  $("#domainBoard").innerHTML = `
    <div class="domain-health-layout">
      <section class="card domain-health-list">
        <div class="card-head compact-head"><div><p class="overline">DOMAIN HEALTH</p><h2>Balance board</h2></div><span class="positive-chip">${active.length}/${available.length || Object.keys(DOMAINS).length} active</span></div>
        <div class="domain-health-rows">
          ${entries.map(([id, item]) => {
            const score = analytics.domainScores[id]?.score || 0;
            const proof = analytics.domainScores[id]?.proof || 0;
            const taskCount = domainTasks(id).length;
            const goalCount = state.goals.filter(goal => goal.domain === id).length;
            const frozen = isDomainFrozen(id);
            return isMobileRuntime()
              ? `<button type="button" class="domain-health-row mobile-domain-row ${selectedDomain === id ? "active" : ""} ${frozen ? "frozen-domain" : ""}" data-domain-pick="${id}" style="--domain-color:${item.color}">
                <span class="domain-symbol">${item.icon}</span>
                <span><strong>${escapeHtml(item.name)}</strong><small>${frozen ? "Frozen - hidden from today" : `${proof} proof - ${taskCount} tasks`}</small></span>
                <span class="domain-meter"><i style="width:${frozen ? 0 : score}%"></i></span>
              </button>`
              : `<button type="button" class="domain-health-row ${selectedDomain === id ? "active" : ""} ${frozen ? "frozen-domain" : ""}" data-domain-pick="${id}" style="--domain-color:${item.color}">
                <span class="domain-symbol">${item.icon}</span>
                <span><strong>${escapeHtml(item.name)}</strong><small>${frozen ? "Frozen - protected pause" : domainStatus(score, proof)}</small></span>
                <span class="domain-meter"><i style="width:${frozen ? 0 : score}%"></i></span>
                <em>${frozen ? "Frozen" : `${proof} proof`}</em>
                <em>${taskCount} tasks</em>
                <em>${goalCount} goals</em>
              </button>`;
          }).join("")}
        </div>
      </section>
      <section class="card domain-detail-card" style="--domain-color:${detail.color}">
        <div class="domain-detail-head">
          <span class="domain-symbol">${detail.icon}</span>
          <div><p class="overline">SELECTED DOMAIN</p><h2>${escapeHtml(detail.name)}</h2><p>${escapeHtml(detail.description)}</p></div>
        </div>
        <div class="domain-detail-stats">
          <article><small>30-day alive score</small><strong>${detailScore}%</strong></article>
          <article><small>Proof actions</small><strong>${detailProof}</strong></article>
          <article><small>Linked goals</small><strong>${detailGoals.length}</strong></article>
        </div>
        <div class="domain-meter domain-detail-meter"><span style="width:${detailFrozen ? 0 : detailScore}%"></span></div>
        <div class="domain-focus-line">
          <strong>${detailFrozen ? "This domain is frozen for now" : nextTask ? `Next tiny proof: ${escapeHtml(nextTask.name)}` : "No practices in this domain yet"}</strong>
          <span>${detailFrozen ? "Frozen domains stay saved but leave today's active load, routine sessions, and orbit count." : nextTask ? escapeHtml(nextTask.minimum || "Do the smallest honest version.") : "Add a simple repeatable action to keep this self alive."}</span>
        </div>
        <div class="domain-detail-actions">
          <button type="button" class="primary-button" data-domain-tasks="${selectedDomain}">View domain tasks</button>
          <button type="button" class="secondary-button" data-domain-new-task="${selectedDomain}">Add practice</button>
          <button type="button" class="secondary-button domain-freeze-button" data-domain-freeze="${selectedDomain}">${detailFrozen ? "Unfreeze domain" : "Freeze domain"}</button>
        </div>
      </section>
    </div>
  `;
  $$("[data-domain-pick]").forEach(button => button.addEventListener("click", () => {
    selectedDomain = button.dataset.domainPick;
    renderDomainBoard();
  }));
  $$("[data-domain-tasks]").forEach(button => button.addEventListener("click", () => viewDomainTasks(button.dataset.domainTasks)));
  $$("[data-domain-new-task]").forEach(button => button.addEventListener("click", () => openDomainTaskModal(button.dataset.domainNewTask)));
  $$("[data-domain-freeze]").forEach(button => button.addEventListener("click", () => toggleDomainFreeze(button.dataset.domainFreeze)));
}

function domainStatus(score, proof) {
  if (!proof) return "Needs one tiny doorway";
  if (score >= 70) return "Strong and visible";
  if (score >= 40) return "Alive, keep it light";
  return "Protected minimum needed";
}

function toggleDomainFreeze(domainId) {
  if (!DOMAINS[domainId]) return;
  const frozen = new Set(frozenDomainIds());
  if (frozen.has(domainId)) {
    frozen.delete(domainId);
    toast(`${DOMAINS[domainId].name} is active again`);
  } else {
    frozen.add(domainId);
    toast(`${DOMAINS[domainId].name} frozen. Its tasks are paused from today and routine sessions.`);
  }
  state.frozenDomains = [...frozen];
  if (routineState?.tasks?.some(task => task.domain === domainId)) {
    pauseRoutineTimer();
    pruneRoutineFrozenTasks();
  }
  saveState();
  renderAll();
}

function viewDomainTasks(domainId) {
  selectedDomain = domainId;
  navigate("tasks");
  taskFilter = "all";
  syncTaskFilterButtons();
  $("#taskSearch").value = "";
  $("#domainFilter").value = domainId;
  $("#tagFilter").value = "all";
  renderTaskLibrary();
  toast(`${DOMAINS[domainId].name} tasks filtered`);
}

function openDomainTaskModal(domainId) {
  selectedDomain = domainId;
  openEntityModal("task");
  $("#entityDomain").value = domainId;
  $("#entityName").placeholder = `One tiny ${DOMAINS[domainId].name.toLowerCase()} practice`;
}

function renderReviewStats() {
  const analytics = buildAnalytics(7);
  $("#reviewStats").innerHTML = [
    [analytics.done, "completed actions"],
    [analytics.micro, "minimum wins"],
    [analytics.resisted, "urges resisted"],
    [activeDomainIdsForAnalytics(analytics).length, "domains touched"]
  ].map(([value, label]) => `<div class="review-stat"><strong>${value}</strong><small>${label}</small></div>`).join("");

  $("#reviewSuggestions").innerHTML = `<h3>Next-week suggestions</h3>${weeklySuggestions(analytics).map(item => `<p>${escapeHtml(item)}</p>`).join("")}`;
}

function renderTagFilter() {
  const current = $("#tagFilter").value || "all";
  const tags = [...new Set(activeTasks().flatMap(task => task.tags || []))].sort();
  $("#tagFilter").innerHTML = `<option value="all">All tags</option>${tags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
  $("#tagFilter").value = tags.includes(current) ? current : "all";
}

function openEntityModal(type, id = "") {
  const isTask = type === "task";
  const item = isTask ? state.tasks.find(task => task.id === id) : state.goals.find(goal => goal.id === id);
  populateLinkSelects(id);
  $("#entityType").value = type;
  $("#entityId").value = id;
  $("#modalEyebrow").textContent = id ? "EDIT DETAILS" : isTask ? "NEW PRACTICE" : "NEW HORIZON";
  $("#modalTitle").textContent = `${id ? "Edit" : "Add"} ${type}`;
  $("#saveEntity").textContent = `Save ${type}`;

  $("#taskFields").hidden = !isTask;
  $("#taskPeriodField").hidden = !isTask;
  $("#taskLinkFields").hidden = !isTask;
  $("#taskMetaFields").hidden = !isTask;
  $("#minimumField").hidden = !isTask;
  $("#goalFields").hidden = isTask;
  $("#dayPicker").hidden = !isTask;
  $("#advancedScheduleFields").hidden = !isTask;

  $("#entityName").placeholder = isTask ? "e.g. Read two pages" : "e.g. Finish the semester with calm mastery";
  $("#entityName").value = item?.name || "";
  $("#entityDomain").value = item?.domain || "scholar";
  $("#entityPeriod").value = item?.period || "Deep work";
  $("#entitySchedule").value = item?.schedule || "daily";
  $("#entityTime").value = item?.time || "Flexible";
  $("#entityDuration").value = item?.duration || 10;
  $("#entityEveryDays").value = item?.everyDays || 2;
  $("#entityMonthlyDay").value = item?.monthlyDay || 1;
  $("#entitySeason").value = item?.season || state.currentSeason;
  $("#entityTags").value = (item?.tags || []).join(", ");
  $("#stackAfterSelect").value = item?.stackAfter || "";
  $("#goalLinkSelect").value = item?.goalId || "";
  $("#entityMinimum").value = item?.minimum || "";
  $("#entityNote").value = item?.note || "";
  $("#goalDate").value = item?.date || "";
  $("#goalProgress").value = item?.progress || 0;
  renderDayPicker(item?.days || []);
  refreshEntityFormVisibility();
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#entityName").focus(), 50);
}

function refreshEntityFormVisibility() {
  const schedule = $("#entitySchedule").value;
  $("#dayPicker").classList.toggle("soft-hidden", !["weekly"].includes(schedule));
  $("#entityEveryDays").closest("label").classList.toggle("soft-hidden", schedule !== "every-x");
  $("#entityMonthlyDay").closest("label").classList.toggle("soft-hidden", schedule !== "monthly");
  $("#entitySeason").closest("label").classList.toggle("soft-hidden", schedule !== "seasonal");
}

function closeModal() {
  $("#modalBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function saveEntity(event) {
  event.preventDefault();
  const type = $("#entityType").value;
  const id = $("#entityId").value;
  const common = {
    name: $("#entityName").value.trim(),
    domain: $("#entityDomain").value,
    note: $("#entityNote").value.trim()
  };
  if (type === "task") {
    const existing = state.tasks.find(task => task.id === id);
    let days = activeDayPickerDays;
    if ($("#entitySchedule").value === "weekly" && !days.length) days = [dayNameForKey(dateKey())];
    const item = {
      id: id || makeId("task"),
      ...common,
      schedule: $("#entitySchedule").value,
      time: $("#entityTime").value.trim() || "Flexible",
      period: $("#entityPeriod").value,
      duration: Number($("#entityDuration").value) || 10,
      everyDays: Number($("#entityEveryDays").value) || 2,
      monthlyDay: Number($("#entityMonthlyDay").value) || 1,
      season: $("#entitySeason").value,
      dueDate: existing?.dueDate || ($("#entitySchedule").value === "once" ? dateKey() : ""),
      days,
      tags: $("#entityTags").value.split(",").map(cleanTag).filter(Boolean),
      stackAfter: $("#stackAfterSelect").value === id ? "" : $("#stackAfterSelect").value,
      goalId: $("#goalLinkSelect").value,
      minimum: $("#entityMinimum").value.trim(),
      archived: existing?.archived || false,
      createdAt: existing?.createdAt || Date.now()
    };
    if (existing) Object.assign(existing, item);
    else state.tasks.unshift(item);
  } else {
    const existing = state.goals.find(goal => goal.id === id);
    const item = {
      id: id || makeId("goal"),
      ...common,
      date: $("#goalDate").value,
      progress: Math.min(100, Math.max(0, Number($("#goalProgress").value) || 0))
    };
    if (existing) Object.assign(existing, item);
    else state.goals.unshift(item);
  }
  saveState();
  closeModal();
  renderAll();
  toast(`${type === "task" ? "Task" : "Goal"} saved to your orbit`);
}

function openSettings() {
  closeSidebar();
  syncPreferenceControls();
  $("#settingsBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#displayName").focus(), 50);
}

function closeSettings() {
  $("#settingsBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function applyPreferences() {
  const prefs = state.preferences;
  const resolvedTheme = prefs.theme === "system" ? (systemTheme.matches ? "dark" : "light") : prefs.theme;
  document.documentElement.dataset.accent = prefs.accent;
  document.documentElement.dataset.fontSize = prefs.fontSize;
  document.documentElement.dataset.theme = resolvedTheme;
  $("#themeToggle").textContent = resolvedTheme === "dark" ? "Dark" : "Light";
  $("#themeToggle").setAttribute("aria-label", resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  const fullName = prefs.name.trim() || "Explorer";
  const firstName = fullName.split(/\s+/)[0];
  $("#profileName").textContent = fullName;
  $("#greetingName").textContent = firstName;
  $("#profileInitials").textContent = fullName.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  syncPreferenceControls();
}

function syncPreferenceControls() {
  if (!$("#displayName")) return;
  if (document.activeElement !== $("#displayName")) $("#displayName").value = state.preferences.name;
  $("#currentSeason").value = state.currentSeason;
  $("#guideSeason").value = state.currentSeason;
  $$("[data-font-size]").forEach(button => button.classList.toggle("active", button.dataset.fontSize === state.preferences.fontSize));
  $$("[data-accent]").forEach(button => button.classList.toggle("active", button.dataset.accent === state.preferences.accent));
  $$("[data-theme-choice]").forEach(button => button.classList.toggle("active", button.dataset.themeChoice === state.preferences.theme));
}

function updatePreference(key, value) {
  state.preferences[key] = value;
  saveState();
  applyPreferences();
}

function toggleTheme() {
  const activeTheme = document.documentElement.dataset.theme;
  updatePreference("theme", activeTheme === "dark" ? "light" : "dark");
  toast(`${activeTheme === "dark" ? "Light" : "Dark"} theme enabled`);
}

function openSidebar() {
  $("#sidebar").classList.add("open");
  document.body.classList.add("drawer-open");
}

function closeSidebar() {
  $("#sidebar").classList.remove("open");
  document.body.classList.remove("drawer-open");
}

function openGuide() {
  syncPreferenceControls();
  $("#onboardingBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeGuide() {
  $("#onboardingBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function finishGuide() {
  state.currentSeason = $("#guideSeason").value;
  state.onboardingComplete = true;
  saveState();
  closeGuide();
  renderAll();
  toast("Guide completed. Start with one tiny proof.");
}

function openFrictionModal(id, status) {
  const key = dateKey();
  const record = normalizeFrictionRecord(state.friction[key]?.[id] || {});
  $("#frictionId").value = id;
  $("#frictionStatus").value = status;
  $("#frictionTitle").textContent = status === "resisted" ? "Resistance counted" : "Slip recovery";
  $("#frictionTrigger").value = record.trigger || "";
  $("#frictionReplacement").value = record.replacement || "";
  $("#frictionRecovery").value = record.recoveryMins || (status === "resisted" ? 1 : 5);
  $("#frictionNote").value = record.note || "";
  $("#frictionBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#frictionTrigger").focus(), 50);
}

function closeFrictionModal() {
  $("#frictionBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function saveFrictionDetail(event) {
  event.preventDefault();
  const key = dateKey();
  state.friction[key] = state.friction[key] || {};
  state.friction[key][$("#frictionId").value] = {
    status: $("#frictionStatus").value,
    trigger: $("#frictionTrigger").value.trim(),
    replacement: $("#frictionReplacement").value.trim(),
    recoveryMins: Number($("#frictionRecovery").value) || 0,
    note: $("#frictionNote").value.trim(),
    at: new Date().toISOString()
  };
  saveState();
  closeFrictionModal();
  renderAll();
  toast($("#frictionStatus").value === "resisted" ? "Resistance counted as progress" : "Slip logged. Recovery is now visible.");
}

function openRoutineModal() {
  ensureRoutineState();
  $("#routineBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  renderRoutineTimer();
}

function closeRoutineModal() {
  persistRoutineState();
  $("#routineBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function currentRoutineTasks() {
  return tasksForKey(dateKey()).filter(task => !isDone(task.id) && !task.archived);
}

function ensureRoutineState() {
  const key = dateKey();
  if (routineState?.key === key) {
    refreshRoutineTaskList();
    if (!routineState) routineState = createRoutineState(currentRoutineTasks(), key);
    return routineState;
  }
  clearRoutineTimerOnly();
  const restored = hydrateRoutineSnapshot(state.activeRoutine, key);
  routineState = restored || createRoutineState(currentRoutineTasks(), key);
  if (routineState.running) {
    routineState.running = false;
    startRoutineTimer();
  }
  persistRoutineState();
  return routineState;
}

function createRoutineState(tasks, key) {
  return {
    key,
    tasks,
    index: 0,
    seconds: routineSecondsForTask(tasks[0]),
    timer: null,
    running: false,
    startedAt: Date.now(),
    completed: 0,
    skipped: 0,
    autoNext: true
  };
}

function hydrateRoutineSnapshot(snapshot, key) {
  if (!snapshot || snapshot.key !== key) return null;
  const tasks = (snapshot.taskIds || []).map(taskById).filter(task => task && !task.archived && !isDomainFrozen(task.domain) && taskMatchesDate(task, key));
  if (!tasks.length) return null;
  let seconds = Math.max(0, Number(snapshot.seconds) || routineSecondsForTask(tasks[0]));
  if (snapshot.running && snapshot.lastTick) {
    seconds = Math.max(0, seconds - Math.floor((Date.now() - Number(snapshot.lastTick)) / 1000));
  }
  const index = Math.min(Math.max(0, Number(snapshot.index) || 0), tasks.length - 1);
  return {
    key,
    tasks,
    index,
    seconds,
    timer: null,
    running: Boolean(snapshot.running),
    startedAt: Number(snapshot.startedAt) || Date.now(),
    completed: Number(snapshot.completed) || 0,
    skipped: Number(snapshot.skipped) || 0,
    autoNext: snapshot.autoNext !== false
  };
}

function refreshRoutineTaskList() {
  if (!routineState) return;
  const currentTaskId = routineState.tasks[routineState.index]?.id;
  routineState.tasks = routineState.tasks.filter(task => task && !task.archived && !isDomainFrozen(task.domain) && taskMatchesDate(task, routineState.key));
  if (!routineState.tasks.length) {
    clearRoutineSession();
    return;
  }
  const currentIndex = routineState.tasks.findIndex(task => task.id === currentTaskId);
  routineState.index = currentIndex >= 0 ? currentIndex : Math.min(routineState.index, routineState.tasks.length - 1);
  if (!routineState.seconds) routineState.seconds = routineSecondsForTask(routineState.tasks[routineState.index]);
}

function pruneRoutineFrozenTasks() {
  if (!routineState) return;
  refreshRoutineTaskList();
  if (!routineState) {
    $("#routineBackdrop").hidden = true;
    if (allPrimaryModalsClosed()) document.body.style.overflow = "";
    return;
  }
  if (routineState) {
    routineState.seconds = routineSecondsForTask(routineState.tasks[routineState.index]);
    persistRoutineState();
    renderRoutineTimer();
  }
}

function routineSecondsForTask(task) {
  return Math.max(60, (task?.duration || 5) * 60);
}

function clearRoutineTimerOnly() {
  if (routineState?.timer) clearInterval(routineState.timer);
}

function clearRoutineSession() {
  clearRoutineTimerOnly();
  routineState = null;
  state.activeRoutine = null;
  saveState();
}

function persistRoutineState() {
  if (!routineState) return;
  state.activeRoutine = {
    key: routineState.key,
    taskIds: routineState.tasks.map(task => task.id),
    index: routineState.index,
    seconds: routineState.seconds,
    running: routineState.running,
    startedAt: routineState.startedAt,
    completed: routineState.completed,
    skipped: routineState.skipped,
    autoNext: $("#routineAutoNext")?.checked ?? routineState.autoNext ?? true,
    lastTick: Date.now()
  };
  saveState();
}

function startRoutineTimer() {
  if (!routineState || routineState.running || !routineState.tasks.length) return;
  routineState.running = true;
  routineState.autoNext = $("#routineAutoNext")?.checked ?? routineState.autoNext ?? true;
  routineState.timer = setInterval(() => {
    routineState.seconds -= 1;
    if (routineState.seconds <= 0) completeRoutineStep();
    renderRoutineTimer();
  }, 1000);
  persistRoutineState();
  renderRoutineTimer();
}

function pauseRoutineTimer() {
  if (!routineState) return;
  routineState.running = false;
  clearInterval(routineState.timer);
  routineState.timer = null;
  persistRoutineState();
  renderRoutineTimer();
}

function completeRoutineStep() {
  const task = routineState.tasks[routineState.index];
  if (task) {
    toggleComplete(task.id, true);
    routineState.completed += 1;
  }
  moveRoutine(1);
}

function skipRoutineStep() {
  if (!routineState) return;
  routineState.skipped += 1;
  moveRoutine(1);
  renderRoutineTimer();
}

function moveRoutine(amount) {
  if (!routineState) return;
  routineState.index += amount;
  if (routineState.index >= routineState.tasks.length) {
    finishRoutineSession();
    return;
  }
  routineState.seconds = routineSecondsForTask(routineState.tasks[routineState.index]);
  if (!$("#routineAutoNext").checked) {
    pauseRoutineTimer();
  } else {
    persistRoutineState();
  }
  renderRoutineTimer();
}

function extendRoutineStep() {
  if (!routineState) return;
  routineState.seconds += 300;
  persistRoutineState();
  renderRoutineTimer();
}

function finishRoutineSession() {
  if (!routineState) return;
  clearInterval(routineState.timer);
  state.routineSessions.unshift({
    date: new Date().toISOString(),
    key: routineState.key,
    completed: routineState.completed,
    skipped: routineState.skipped,
    planned: routineState.tasks.length,
    minutes: Math.round((Date.now() - routineState.startedAt) / 60000)
  });
  state.activeRoutine = null;
  clearRoutineSession();
  $("#routineBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
  renderAll();
  toast("Guided routine saved");
}

function renderRoutineTimer() {
  if (!routineState) return;
  const task = routineState.tasks[routineState.index];
  $("#routineAutoNext").checked = routineState.autoNext !== false;
  $("#routineStepLabel").textContent = task ? `${routineState.index + 1} of ${routineState.tasks.length}: ${task.name}` : "No open tasks";
  $("#routineClock").textContent = formatClock(routineState.seconds);
  $("#routineMinimum").textContent = task ? `Minimum version: ${task.minimum || "Do the smallest honest step."}` : "Everything scheduled is already complete.";
  $("#routinePause").textContent = routineState.running ? "Pause" : "Paused";
  $("#routineList").innerHTML = routineState.tasks.map((item, index) => `<div class="${index === routineState.index ? "active" : ""}"><strong>${escapeHtml(item.name)}</strong><span>${item.duration || 10}m - ${escapeHtml(item.minimum || "minimum not set")}</span></div>`).join("");
}

function renderRoutineLauncher() {
  const button = $("#startRoutineButton");
  if (!button) return;
  const activeSnapshot = routineState || state.activeRoutine;
  const hasActiveRoutine = activeSnapshot?.key === dateKey() && (activeSnapshot.taskIds?.length || activeSnapshot.tasks?.length);
  button.textContent = hasActiveRoutine ? "Resume guided routine" : "Start guided routine";
}

function openFocusModal() {
  focusState = { seconds: Number($("#focusMinutes").value || 25) * 60, timer: null, running: false, startedAt: Date.now() };
  resetFocusClock();
  $("#focusBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeFocusModal() {
  if (focusState?.timer) clearInterval(focusState.timer);
  focusState = null;
  $("#focusBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function resetFocusClock() {
  const mins = Number($("#focusMinutes").value || 25);
  if (!focusState || !focusState.running) {
    if (focusState) focusState.seconds = mins * 60;
    $("#focusClock").textContent = formatClock(mins * 60);
  }
}

function startFocusTimer() {
  if (!focusState) focusState = { seconds: Number($("#focusMinutes").value || 25) * 60, timer: null, running: false, startedAt: Date.now() };
  if (focusState.running) return;
  focusState.running = true;
  $("#focusStatus").textContent = "Running";
  focusState.timer = setInterval(() => {
    focusState.seconds = Math.max(0, focusState.seconds - 1);
    $("#focusClock").textContent = formatClock(focusState.seconds);
    if (focusState.seconds === 0) pauseFocusTimer();
  }, 1000);
}

function pauseFocusTimer() {
  if (!focusState) return;
  focusState.running = false;
  clearInterval(focusState.timer);
  focusState.timer = null;
  $("#focusStatus").textContent = "Paused";
}

function extendFocusTimer() {
  if (!focusState) focusState = { seconds: Number($("#focusMinutes").value || 25) * 60, timer: null, running: false, startedAt: Date.now() };
  focusState.seconds += 300;
  $("#focusClock").textContent = formatClock(focusState.seconds);
}

function finishFocusSession() {
  if (!focusState) return;
  const planned = Number($("#focusMinutes").value || 25);
  const elapsed = Math.max(1, Math.round((Date.now() - focusState.startedAt) / 60000));
  state.focusSessions.unshift({
    date: new Date().toISOString(),
    key: dateKey(),
    name: $("#focusName").value.trim() || "Focus session",
    note: $("#focusNote").value.trim(),
    planned,
    elapsed
  });
  saveState();
  closeFocusModal();
  renderAll();
  toast("Focus session saved");
}

function openStackModal() {
  populateLinkSelects();
  $("#stackBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeStackModal() {
  $("#stackBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function saveStack(event) {
  event.preventDefault();
  const base = $("#stackBase").value;
  const next = $("#stackNext").value;
  if (!base || !next || base === next) {
    toast("Choose two different tasks for the stack");
    return;
  }
  const task = state.tasks.find(item => item.id === next);
  if (task) task.stackAfter = base;
  saveState();
  closeStackModal();
  renderAll();
  toast("Habit stack saved");
}

function openHistoryModal(id) {
  const task = state.tasks.find(item => item.id === id);
  $("#historyTitle").textContent = task?.name || "Recent proof";
  const rows = historyForTask(id, 30);
  $("#historyList").innerHTML = rows.length ? rows.map(row => `<div><strong>${formatDate(row.key)}</strong><span>${row.status}</span></div>`).join("") : `<div class="empty-state"><strong>No history yet</strong>Complete the task or count a minimum version to create proof.</div>`;
  $("#historyBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeHistoryModal() {
  $("#historyBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function applyTemplate(id) {
  const template = TEMPLATE_LIBRARY.find(item => item.id === id);
  if (!template) return;
  const existingNames = new Set(state.tasks.map(task => task.name.toLowerCase()));
  const additions = template.tasks
    .filter(([, name]) => !existingNames.has(name.toLowerCase()))
    .map(([suffix, name, domainId, schedule, time, minimum, period, days, tags]) => normalizeTask({
      id: makeId(`${id}-${suffix}`),
      name,
      domain: domainId,
      schedule,
      time,
      minimum,
      period,
      days,
      tags,
      note: minimum,
      duration: 15,
      createdAt: Date.now()
    }));
  state.tasks.unshift(...additions);
  saveState();
  renderAll();
  toast(additions.length ? `${template.name} installed` : `${template.name} already exists`);
}

function saveReview(event) {
  event.preventDefault();
  const analytics = buildAnalytics(7);
  const review = {
    date: new Date().toISOString(),
    easy: $("#reviewEasy").value,
    friction: $("#reviewFriction").value,
    smaller: $("#reviewSmaller").value,
    suggestions: weeklySuggestions(analytics)
  };
  state.reviews.unshift(review);
  saveState();
  renderReviewStats();
  toast("Weekly review saved with next-week suggestions");
}

function restoreReview() {
  const latest = state.reviews[0];
  if (!latest) return;
  $("#reviewEasy").value = latest.easy || "";
  $("#reviewFriction").value = latest.friction || "";
  $("#reviewSmaller").value = latest.smaller || "";
}

function exportJson() {
  backupAllData();
}

function backupAllData() {
  const backup = {
    app: "Orbit",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    data: state
  };
  downloadBlob(`orbit-full-backup-${todayKey()}.json`, JSON.stringify(backup, null, 2), "application/json");
  toast("Full Orbit backup downloaded");
}

function exportCsv() {
  const rows = [["type", "date", "name", "domain", "schedule", "status", "tags", "linked_goal"]];
  state.tasks.forEach(task => rows.push(["task", "", task.name, domain(task.domain).name, scheduleLabel(task), task.archived ? "archived" : "active", task.tags.join("|"), goalName(task.goalId)]));
  Object.entries(state.completions).forEach(([key, day]) => Object.entries(day).forEach(([id, done]) => {
    if (done) rows.push(["completion", key, taskName(id), domain(taskById(id)?.domain).name, "", "full", "", goalName(taskById(id)?.goalId)]);
  }));
  Object.entries(state.microWins).forEach(([key, day]) => Object.entries(day).forEach(([id, done]) => {
    if (done) rows.push(["micro-win", key, taskName(id), domain(taskById(id)?.domain).name, "", "minimum", "", goalName(taskById(id)?.goalId)]);
  }));
  Object.entries(state.friction).forEach(([key, day]) => Object.entries(day).forEach(([id, record]) => {
    const item = FRICTIONS.find(friction => friction.id === id);
    rows.push(["friction", key, item?.name || id, "", "", normalizeFrictionRecord(record).status, "", ""]);
  }));
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  downloadBlob(`orbit-export-${todayKey()}.csv`, csv, "text/csv");
  toast("CSV export downloaded");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = migrateState(JSON.parse(reader.result));
      state = imported;
      saveState();
      applyPreferences();
      renderAll();
      toast("Orbit data imported");
    } catch {
      toast("Import failed. Please choose a valid Orbit JSON export.");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function openLoginModal() {
  $("#loginName").value = state.account?.name || state.preferences.name || "";
  $("#loginEmail").value = state.account?.email || "";
  $("#loginPin").value = "";
  $("#logoutButton").hidden = !state.account?.loggedIn;
  $("#loginBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#loginName").focus(), 50);
}

function closeLoginModal() {
  $("#loginBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function saveLogin(event) {
  event.preventDefault();
  const name = $("#loginName").value.trim();
  const email = $("#loginEmail").value.trim().toLowerCase();
  state.account = {
    name,
    email,
    hasPin: Boolean($("#loginPin").value.trim()),
    loggedIn: true,
    lastLogin: new Date().toISOString()
  };
  state.preferences.name = name;
  saveState();
  applyPreferences();
  syncAccountUi();
  closeLoginModal();
  toast("Logged in locally on this device");
}

function logout() {
  if (!state.account) return;
  state.account.loggedIn = false;
  saveState();
  syncAccountUi();
  closeLoginModal();
  toast("Logged out locally");
}

function syncAccountUi() {
  const account = state.account;
  $("#loginButton").textContent = account?.loggedIn ? "Account" : "Login";
  const profileSmall = $("#profileButton small");
  if (profileSmall) profileSmall.textContent = account?.loggedIn ? account.email : "Local-first explorer";
}

function openReminderModal() {
  populateReminderTaskSelect();
  renderNotificationStatus();
  renderReminderList();
  $("#reminderBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  if (!$("#reminderTime").value) $("#reminderTime").value = "06:00";
  setTimeout(() => $("#reminderName").focus(), 50);
}

function closeReminderModal() {
  $("#reminderBackdrop").hidden = true;
  if (allPrimaryModalsClosed()) document.body.style.overflow = "";
}

function populateReminderTaskSelect() {
  $("#reminderTask").innerHTML = `<option value="">No linked task</option>${activeTasks().map(task => `<option value="${task.id}">${escapeHtml(task.name)}</option>`).join("")}`;
}

function renderNotificationStatus() {
  const support = "Notification" in window;
  const permission = support ? Notification.permission : "unsupported";
  state.notificationPermission = permission;
  const secureNote = window.isSecureContext ? "This browser context can request notifications." : "Your browser may block notifications from local files; localhost usually works better.";
  $("#notificationStatus").innerHTML = `
    <strong>${support ? `Permission: ${permission}` : "Notifications unsupported"}</strong>
    <span>${secureNote} Reminders work while Orbit is open in the browser.</span>
  `;
  $("#enableNotifications").disabled = !support || permission === "granted";
  $("#enableNotifications").textContent = permission === "granted" ? "Notifications enabled" : "Enable browser notifications";
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    toast("This browser does not support notifications");
    renderNotificationStatus();
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    state.notificationPermission = permission;
    saveState();
    renderNotificationStatus();
    if (permission === "granted") {
      showBrowserNotification("Orbit reminders enabled", "When Orbit is open, reminders can now appear here.");
    } else {
      toast("Notifications were not enabled");
    }
  } catch {
    toast("Notification permission could not be requested here");
    renderNotificationStatus();
  }
}

function saveReminder(event) {
  event.preventDefault();
  const reminder = normalizeReminder({
    id: makeId("reminder"),
    name: $("#reminderName").value.trim(),
    time: $("#reminderTime").value,
    message: $("#reminderMessage").value.trim() || "Start tiny. One honest proof is enough.",
    repeat: $("#reminderRepeat").value,
    taskId: $("#reminderTask").value,
    active: true,
    createdAt: Date.now()
  });
  state.reminders.unshift(reminder);
  saveState();
  $("#reminderForm").reset();
  $("#reminderTime").value = reminder.time;
  renderReminderList();
  toast("Reminder saved");
}

function renderReminderList() {
  if (!$("#reminderList")) return;
  $("#reminderList").innerHTML = state.reminders.length ? state.reminders.map(reminder => `
    <div class="reminder-item ${reminder.active ? "" : "paused"}">
      <div><strong>${escapeHtml(reminder.name)}</strong><span>${escapeHtml(reminder.time)} - ${repeatLabel(reminder.repeat)}${reminder.taskId ? ` - ${escapeHtml(taskName(reminder.taskId))}` : ""}</span><small>${escapeHtml(reminder.message)}</small></div>
      <div>
        <button data-toggle-reminder="${reminder.id}">${reminder.active ? "Pause" : "Resume"}</button>
        <button data-delete-reminder="${reminder.id}">Delete</button>
      </div>
    </div>
  `).join("") : `<div class="empty-state"><strong>No reminders yet</strong>Add one time-based prompt. It will fire while Orbit is open.</div>`;
  $$("[data-toggle-reminder]").forEach(button => button.addEventListener("click", () => toggleReminder(button.dataset.toggleReminder)));
  $$("[data-delete-reminder]").forEach(button => button.addEventListener("click", () => deleteReminder(button.dataset.deleteReminder)));
}

function toggleReminder(id) {
  const reminder = state.reminders.find(item => item.id === id);
  if (!reminder) return;
  reminder.active = !reminder.active;
  saveState();
  renderReminderList();
}

function deleteReminder(id) {
  state.reminders = state.reminders.filter(item => item.id !== id);
  saveState();
  renderReminderList();
  toast("Reminder deleted");
}

function startReminderEngine() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(checkReminders, REMINDER_CHECK_INTERVAL_MS);
  checkReminders();
}

function checkReminders() {
  if (!state.reminders?.length) return;
  const now = new Date();
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const key = todayKey();
  state.reminders.forEach(reminder => {
    if (!reminder.active || reminder.time !== currentTime || reminder.lastFired === `${key}-${currentTime}` || !reminderRepeatsToday(reminder, now)) return;
    reminder.lastFired = `${key}-${currentTime}`;
    const task = reminder.taskId ? taskById(reminder.taskId) : null;
    const title = task ? `Orbit: ${task.name}` : `Orbit: ${reminder.name}`;
    showBrowserNotification(title, reminder.message);
  });
  saveState();
}

function showBrowserNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: "orbit-reminder" });
      return;
    } catch {
      // Fall back to an in-app toast when the browser blocks local notifications.
    }
  }
  toast(`${title} - ${body}`);
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildAnalytics(days) {
  const keys = rangeKeys(days);
  const totals = {
    scheduled: 0,
    done: 0,
    micro: 0,
    resisted: 0,
    slips: 0,
    activeDays: 0,
    restarts: 0,
    proofScore: 0,
    focusMinutes: 0,
    focusCount: 0,
    domainsTouched: new Set(),
    domainScores: Object.fromEntries(Object.keys(DOMAINS).map(id => [id, { scheduled: 0, proof: 0, score: 0 }])),
    bars: [],
    lastSeven: [],
    heatmap: []
  };
  const dailyProof = [];

  keys.forEach((key, index) => {
    const tasks = tasksForKey(key);
    const completions = state.completions[key] || {};
    const micros = state.microWins[key] || {};
    const friction = state.friction[key] || {};
    let dayDone = 0;
    let dayMicro = 0;
    let dayProof = 0;

    tasks.forEach(task => {
      totals.scheduled += 1;
      totals.domainScores[task.domain].scheduled += 1;
      if (completions[task.id]) {
        totals.done += 1;
        dayDone += 1;
        dayProof += 1;
        totals.domainScores[task.domain].proof += 1;
        totals.domainsTouched.add(task.domain);
      } else if (micros[task.id]) {
        totals.micro += 1;
        dayMicro += 1;
        dayProof += 0.5;
        totals.domainScores[task.domain].proof += 0.5;
        totals.domainsTouched.add(task.domain);
      }
    });

    Object.values(friction).map(normalizeFrictionRecord).forEach(record => {
      if (record.status === "resisted") {
        totals.resisted += 1;
        dayProof += 0.5;
      }
      if (record.status === "slipped") totals.slips += 1;
    });

    const focusToday = state.focusSessions.filter(session => session.key === key);
    focusToday.forEach(session => {
      totals.focusMinutes += Number(session.elapsed) || 0;
      totals.focusCount += 1;
      dayProof += 0.5;
    });

    if (dayProof > 0) totals.activeDays += 1;
    if (index > 0 && dailyProof[index - 1]?.proof === 0 && dayProof > 0) totals.restarts += 1;
    dailyProof.push({ key, proof: dayProof, done: dayDone, micro: dayMicro, scheduled: tasks.length });
  });

  totals.proofScore = Math.round(totals.done * 10 + totals.micro * 5 + totals.resisted * 4 + totals.focusMinutes / 5);
  totals.completionRate = percent((totals.done + totals.micro * 0.5) / Math.max(totals.scheduled, 1));
  Object.keys(totals.domainScores).forEach(id => {
    const item = totals.domainScores[id];
    item.score = percent(item.proof / Math.max(item.scheduled, 1));
    item.proof = Math.round(item.proof);
  });
  totals.bars = dailyProof.slice(-7).map(day => Math.max(5, percent(day.proof / Math.max(day.scheduled, 1)) / 4));
  totals.lastSeven = dailyProof.slice(-7).map(day => ({
    key: day.key,
    label: dayNameForKey(day.key).slice(0, 1),
    percent: percent(day.proof / Math.max(day.scheduled, 1))
  }));
  const currentHalf = dailyProof.slice(-Math.ceil(days / 2)).reduce((sum, day) => sum + day.proof, 0);
  const previousHalf = dailyProof.slice(0, Math.floor(days / 2)).reduce((sum, day) => sum + day.proof, 0);
  totals.trendLabel = currentHalf >= previousHalf ? `Up ${Math.round(currentHalf - previousHalf)} proof` : `Down ${Math.round(previousHalf - currentHalf)} proof`;
  totals.heatmap = rangeKeys(84).map(key => {
    const tasks = tasksForKey(key);
    const proof = tasks.reduce((sum, task) => sum + (isDone(task.id, key) ? 1 : isMicro(task.id, key) ? 0.5 : 0), 0) + Object.values(state.friction[key] || {}).filter(record => normalizeFrictionRecord(record).status === "resisted").length * 0.5;
    return { key, proof, level: Math.min(4, Math.floor(proof)) };
  });
  const recoveryValues = Object.values(state.friction).flatMap(day => Object.values(day).map(normalizeFrictionRecord).map(record => record.recoveryMins).filter(Boolean));
  const avgRecovery = recoveryValues.length ? Math.round(recoveryValues.reduce((sum, value) => sum + value, 0) / recoveryValues.length) : 0;
  totals.recoveryLabel = avgRecovery ? `${avgRecovery}m avg` : "No data";
  return totals;
}

function tasksForKey(key) {
  return stackSort(activeTasks().filter(task => taskMatchesDate(task, key)));
}

function activeTasks() {
  return state.tasks.filter(task => !task.archived && !isDomainFrozen(task.domain));
}

function domainTasks(domainId) {
  return state.tasks.filter(task => !task.archived && task.domain === domainId);
}

function frozenDomainIds() {
  state.frozenDomains = normalizeFrozenDomains(state.frozenDomains);
  return state.frozenDomains;
}

function isDomainFrozen(domainId) {
  return frozenDomainIds().includes(domainId);
}

function availableDomainIds() {
  const frozen = new Set(frozenDomainIds());
  return Object.keys(DOMAINS).filter(id => !frozen.has(id));
}

function activeDomainIdsForAnalytics(analytics) {
  const available = new Set(availableDomainIds());
  return [...analytics.domainsTouched].filter(id => available.has(id));
}

function availableDomainScoreEntries(analytics) {
  const available = new Set(availableDomainIds());
  return Object.entries(analytics.domainScores).filter(([id]) => available.has(id));
}

function lowestAvailableDomainEntry(analytics) {
  return availableDomainScoreEntries(analytics).sort((a, b) => a[1].score - b[1].score)[0];
}

function taskMatchesDate(task, key) {
  if (task.archived) return false;
  const date = dateFromKey(key);
  const day = dayNameForKey(key);
  if (task.schedule === "daily") return true;
  if (task.schedule === "weekly") return (task.days || []).includes(day);
  if (task.schedule === "every-x") {
    const start = dateFromKey(taskStartKey(task));
    return Math.max(0, Math.floor((date - start) / 86400000)) % Math.max(1, Number(task.everyDays) || 1) === 0;
  }
  if (task.schedule === "monthly") {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === Math.min(lastDay, Number(task.monthlyDay) || 1);
  }
  if (task.schedule === "seasonal") return task.season === state.currentSeason;
  if (task.schedule === "once") return (task.dueDate || taskStartKey(task)) === key;
  return false;
}

function stackSort(tasks) {
  const sorted = [...tasks].sort((a, b) => periodIndex(a.period) - periodIndex(b.period) || timeRank(a.time) - timeRank(b.time));
  for (let attempts = 0; attempts < sorted.length; attempts += 1) {
    sorted.forEach(task => {
      if (!task.stackAfter) return;
      const currentIndex = sorted.findIndex(item => item.id === task.id);
      const baseIndex = sorted.findIndex(item => item.id === task.stackAfter);
      if (baseIndex >= 0 && currentIndex >= 0 && currentIndex !== baseIndex + 1) {
        const [item] = sorted.splice(currentIndex, 1);
        sorted.splice(sorted.findIndex(candidate => candidate.id === task.stackAfter) + 1, 0, item);
      }
    });
  }
  return sorted;
}

function weeklySuggestions(analytics) {
  const lowest = lowestAvailableDomainEntry(analytics);
  const suggestions = [];
  if (analytics.completionRate < 45) suggestions.push("Reduce tomorrow's load: pick only three non-negotiable anchors and count minimum versions for the rest.");
  if (lowest) suggestions.push(`Give ${DOMAINS[lowest[0]].name} one tiny proof next week so that part of you stays alive.`);
  if (analytics.slips > analytics.resisted) suggestions.push("For your strongest bad-habit trigger, pre-write one replacement action before the urge appears.");
  if (!analytics.focusCount) suggestions.push("Schedule one 25-minute creation or study focus session. Keep it small enough to start.");
  if (analytics.restarts > 0) suggestions.push("Keep the restart rule: after a missed day, do one minimum version before making any judgment.");
  return suggestions.slice(0, 4);
}

function insightStory(analytics) {
  const lowest = lowestAvailableDomainEntry(analytics);
  const domainName = lowest ? DOMAINS[lowest[0]].name : "Creator";
  return `
    <span class="story-number">01</span>
    <p class="overline">PATTERN FOUND</p>
    <h2>${domainName} is asking for a smaller doorway.</h2>
    <p>Your weakest domain does not need a dramatic comeback. It needs one protected minimum version that is easy enough to repeat.</p>
    <button class="dark-button" data-apply-suggestion>Apply tiny doorway</button>
  `;
}

function applyInsightSuggestion() {
  const analytics = buildAnalytics(30);
  const lowest = lowestAvailableDomainEntry(analytics)?.[0] || availableDomainIds()[0] || "creator";
  const task = activeTasks().find(item => item.domain === lowest);
  if (task) {
    task.minimum = task.minimum || "Do this for two honest minutes";
    task.tags = [...new Set([...(task.tags || []), "tiny-doorway"])];
  } else {
    state.tasks.unshift(normalizeTask({
      id: makeId("tiny-doorway"),
      name: `${DOMAINS[lowest].name} tiny doorway`,
      domain: lowest,
      schedule: "daily",
      period: "Evening",
      time: "Flexible",
      duration: 5,
      minimum: "Do two honest minutes",
      tags: "tiny-doorway,kaizen"
    }));
  }
  saveState();
  renderAll();
  toast("Tiny doorway added to the weakest domain");
}

function adjustDayLoad() {
  const key = dateKey();
  const heavy = tasksForKey(key).filter(task => !isDone(task.id, key) && !isMicro(task.id, key)).slice(-4);
  state.microWins[key] = state.microWins[key] || {};
  heavy.forEach(task => { state.microWins[key][task.id] = true; });
  saveState();
  renderAll();
  toast("Load softened: four tasks moved to minimum mode");
}

function changeDay(amount) {
  selectedDateOffset += amount;
  renderAll();
}

function scheduleLabel(task) {
  if (task.schedule === "daily") return "Every day";
  if (task.schedule === "weekly") return (task.days || []).length ? (task.days || []).map(day => day.slice(0, 3)).join(", ") : "Selected days";
  if (task.schedule === "every-x") return `Every ${task.everyDays || 1} days`;
  if (task.schedule === "monthly") return `Monthly on ${task.monthlyDay || 1}`;
  if (task.schedule === "seasonal") return `${task.season || "Seasonal"} season`;
  if (task.schedule === "once") return `One-off ${task.dueDate ? formatDate(task.dueDate) : ""}`;
  return task.schedule || "Flexible";
}

function loadChip(count) {
  const label = count <= 8 ? "Light load" : count <= 15 ? "Balanced load" : "Heavy load";
  return `<span>${label}</span><i></i>`;
}

function signalTitle(analytics, todayRate) {
  if (todayRate >= 70) return "Progress is visible. Keep the finish gentle.";
  if (analytics.slips > analytics.resisted) return "Friction is loud today. Use replacement actions.";
  if (activeDomainIdsForAnalytics(analytics).length < Math.min(4, availableDomainIds().length)) return "Your range is thinning. Touch one quiet domain.";
  return "Your system is ready. Start with the next tiny proof.";
}

function signalCopy(analytics) {
  if (analytics.restarts) return `You made ${analytics.restarts} gentle restart${analytics.restarts === 1 ? "" : "s"} recently. That is the system working.`;
  if (analytics.micro) return `${analytics.micro} minimum wins kept the chain alive. Tiny still counts.`;
  return "Full wins, minimum versions, resisted urges, and focus sessions all become proof here.";
}

function seasonCopy(season) {
  return {
    Foundation: "Protect the basics first.",
    Exam: "Make study obvious and recovery non-negotiable.",
    "Build Sprint": "Ship small artifacts without starving your body.",
    Recovery: "Reduce the load and keep identity alive."
  }[season] || "Protect the next honest step.";
}

function timeGreeting(date) {
  const hour = date.getHours();
  if (hour < 5) return "Quiet night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function repeatLabel(repeat) {
  return {
    daily: "Every day",
    weekdays: "Weekdays",
    weekends: "Weekends"
  }[repeat] || "Every day";
}

function reminderRepeatsToday(reminder, date) {
  const day = date.getDay();
  if (reminder.repeat === "weekdays") return day >= 1 && day <= 5;
  if (reminder.repeat === "weekends") return day === 0 || day === 6;
  return true;
}

function historyForTask(id, days) {
  return rangeKeys(days).reverse().map(key => {
    if (isDone(id, key)) return { key, status: "Full win" };
    if (isMicro(id, key)) return { key, status: "Minimum win" };
    if (taskMatchesDate(taskById(id) || {}, key)) return { key, status: "Scheduled, not logged" };
    return null;
  }).filter(Boolean);
}

function taskProof(id, days) {
  const keys = rangeKeys(days);
  const full = keys.filter(key => isDone(id, key)).length;
  const micro = keys.filter(key => isMicro(id, key)).length;
  return { full, micro, score: full + micro * 0.5 };
}

function goalProofScore(goalId, days) {
  return linkedTasks(goalId).reduce((sum, task) => sum + taskProof(task.id, days).score, 0);
}

function linkedTasks(goalId) {
  return activeTasks().filter(task => task.goalId === goalId);
}

function openSettingsIfMissing() {
  if (!state.preferences.name) openSettings();
}

function activeModalIds() {
  return ["modalBackdrop", "settingsBackdrop", "onboardingBackdrop", "frictionBackdrop", "routineBackdrop", "focusBackdrop", "stackBackdrop", "loginBackdrop", "reminderBackdrop", "historyBackdrop", "proofLinkBackdrop"];
}

function allPrimaryModalsClosed() {
  return activeModalIds().every(id => $(`#${id}`)?.hidden !== false);
}

function cleanTag(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function percent(value) {
  return Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayKey() {
  return formatKey(new Date());
}

function dateKey(offset = selectedDateOffset) {
  return formatKey(dateFromOffset(offset));
}

function dateFromOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}

function formatKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function rangeKeys(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return formatKey(date);
  });
}

function dayNameForKey(key) {
  return JS_DAYS[dateFromKey(key).getDay()];
}

function taskStartKey(task) {
  return task.createdAt ? formatKey(new Date(task.createdAt)) : todayKey();
}

function periodIndex(period) {
  const index = PERIODS.indexOf(period);
  return index === -1 ? 99 : index;
}

function timeRank(time) {
  const match = String(time || "").match(/^(\d{1,2}):?(\d{2})?/);
  if (!match) return 9999;
  return Number(match[1]) * 60 + Number(match[2] || 0);
}

function formatDate(value) {
  if (!value) return "";
  return dateFromKey(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatClock(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
}

function domain(id) {
  return DOMAINS[id] || DOMAINS.steward;
}

function taskById(id) {
  return state.tasks.find(task => task.id === id);
}

function taskName(id) {
  return taskById(id)?.name || "Unknown task";
}

function goalName(id) {
  return state.goals.find(goal => goal.id === id)?.name || "";
}

function isDone(id, key = dateKey()) {
  return Boolean(state.completions[key]?.[id]);
}

function isMicro(id, key = dateKey()) {
  return Boolean(state.microWins[key]?.[id]);
}

function lectureId(key, name) {
  return `lecture-${key}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.innerHTML = `<span>OK</span>${escapeHtml(message)}`;
  $("#toastRegion").appendChild(item);
  setTimeout(() => item.remove(), 3200);
}
