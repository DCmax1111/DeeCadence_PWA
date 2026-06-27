const STORAGE_KEY = "orbit-polymath-v2";

const DOMAINS = {
  spirit: { name: "Spirit", color: "#7b8f5d", icon: "✦", description: "Prayer, scripture, reflection and inner alignment." },
  body: { name: "Body", color: "#d48263", icon: "◒", description: "Strength, mobility, recovery and physical care." },
  scholar: { name: "Scholar", color: "#668da1", icon: "⌁", description: "School, reading, research and structured learning." },
  creator: { name: "Creator", color: "#b47c9b", icon: "✎", description: "Writing, drawing, music and things brought into the world." },
  builder: { name: "Builder", color: "#b59152", icon: "◇", description: "Code, products, business systems and useful experiments." },
  steward: { name: "Steward", color: "#4d876b", icon: "◉", description: "Money, home, planning and responsibilities kept in order." },
  connection: { name: "Connection", color: "#a36d56", icon: "∞", description: "Family, church, community and meaningful outreach." }
};

const seedTasks = [
  ["wake", "Wake up by 4 am", "body", "daily", "04:00", "Sit up and put both feet down", "Morning", "Protect the quiet before the world begins."],
  ["morning-prayer", "Morning prayer", "spirit", "daily", "04:05", "One honest minute", "Morning", "Begin from identity, not urgency."],
  ["wash-face", "Wash face & restroom", "body", "daily", "04:15", "Splash water on your face", "Morning", "Remove early friction."],
  ["bible", "Bible reading", "spirit", "daily", "04:25", "Read one verse", "Morning", "A short passage still keeps the thread alive."],
  ["exercise", "Body activation circuit", "body", "daily", "04:40", "One pushup and 20-second plank", "Morning", "Pushups, plank, leg lifts, squats and glute bridges."],
  ["shower", "Shower", "body", "daily", "05:05", "Two-minute rinse", "Morning", "A clean transition into focused work."],
  ["study", "School study", "scholar", "daily", "05:20", "Open notes and solve one question", "Deep work", "Touch the hardest concept before distraction grows."],
  ["family-prayer", "Family prayers", "connection", "daily", "05:50", "Be present for the closing prayer", "Morning", "A fixed communal anchor."],
  ["assignments", "Assignments & note making", "scholar", "daily", "06:10", "Write one paragraph", "Deep work", "Progress can be an outline."],
  ["goals", "Set the day’s goals", "steward", "daily", "06:30", "Choose one must-win", "Morning", "A realistic victory path beats a heroic list."],
  ["reading", "Read", "scholar", "daily", "12:30", "Read two pages", "Deep work", "Keep intellectual range alive."],
  ["finance", "Track finances", "steward", "daily", "18:30", "Log one expense", "Evening", "Clarity compounds."],
  ["language", "Practice Korean", "scholar", "daily", "19:00", "Learn one phrase", "Evening", "One phrase is a legitimate session."],
  ["creation", "Creation hour", "creator", "daily", "20:00", "Create for five minutes", "Evening", "Write, sketch, sing, code or make."],
  ["journal", "Journal & meditate", "spirit", "daily", "21:00", "Write one true sentence", "Evening", "Close open mental loops."],
  ["night-reset", "Night shutdown", "steward", "daily", "21:20", "Wash one dish and stretch", "Evening", "Dishes, stretch, salt rinse and preparation."],
  ["night-prayer", "Night prayer & affirmation", "spirit", "daily", "21:40", "One prayer and one sentence", "Evening", "End with direction rather than drift."],
  ["sleep", "Sleep on time", "body", "daily", "22:00", "Put the phone beyond reach", "Evening", "The 4 am habit begins here."],
  ["business-dms", "Business outreach", "builder", "weekly", "09:00", "Send one useful DM", "Deep work", "Monday, Tuesday and Thursday outreach."],
  ["coding", "Coding practice", "builder", "weekly", "14:00", "Open the project and fix one thing", "Deep work", "Tuesday and Saturday building block."],
  ["drawing", "Drawing practice", "creator", "weekly", "16:00", "Draw one shape", "Deep work", "Tuesday creative range."],
  ["writing", "Writing session", "creator", "weekly", "15:00", "Write fifty words", "Deep work", "Wednesday, Friday and weekend craft."],
  ["laundry", "Laundry", "steward", "weekly", "17:00", "Gather clothes in one place", "Evening", "Tuesday and Thursday reset."],
  ["stroll", "Evening stroll", "body", "weekly", "19:30", "Walk outside for five minutes", "Evening", "A low-pressure transition out of work."],
  ["weekly-review", "Weekly review & next-week plan", "steward", "weekly", "17:30", "Answer one review prompt", "Evening", "Sunday reflection and design."],
  ["church", "Church service", "connection", "weekly", "08:00", "Prepare clothing the night before", "Deep work", "Sunday community and worship."],
  ["pm-tool", "Build project manager tool", "builder", "weekly", "10:00", "Ship one tiny improvement", "Deep work", "Saturday product creation."],
  ["selar-product", "Turn writing into a Selar product", "builder", "weekly", "13:00", "Name one sellable artifact", "Deep work", "Saturday packaging and distribution."]
].map(([id,name,domain,schedule,time,minimum,period,note]) => ({ id,name,domain,schedule,time,minimum,period,note,completed:false,createdAt:Date.now() }));

const seedGoals = [
  { id: "goal-semester", name: "Finish the semester with calm mastery", domain: "scholar", progress: 62, date: "2026-08-14", note: "Learn deeply enough to explain each core course simply." },
  { id: "goal-product", name: "Ship the first polymath product", domain: "builder", progress: 38, date: "2026-07-31", note: "Turn useful writing and systems into a small paid artifact." },
  { id: "goal-korean", name: "Hold a five-minute Korean conversation", domain: "scholar", progress: 24, date: "2026-10-01", note: "Build speaking confidence through tiny daily contact." },
  { id: "goal-body", name: "Build a resilient morning body", domain: "body", progress: 71, date: "2026-09-01", note: "Strength and mobility without punishing volume." }
];

const FRICTIONS = [
  { id: "phone-drift", name: "Phone drift while studying", cue: "Put it out of reach, then restart for 2 minutes." },
  { id: "revenge-scroll", name: "Late-night revenge scrolling", cue: "Charge the phone away from bed and begin one night anchor." },
  { id: "day-lost", name: "The day is already lost thinking", cue: "Do one minimum version before making any judgment." }
];

const lectureTasks = {
  Monday: [["GET 322", "8–10"], ["CPE 322", "10–12"], ["GET 323 Practical", "1–2"], ["GET 323", "2–4"]],
  Tuesday: [["CPE 321", "10–12"], ["GET 321", "1–3"]], Wednesday: [["ENT 321", "1–3"]],
  Thursday: [["GET 324", "10–12"]], Friday: [["GET 322", "8–9"], ["GET 323", "9–10"], ["GET 324 Practical", "10–12"], ["GET 321", "3–5"]], Saturday: [], Sunday: []
};

let state = loadState();
let currentRoute = "today";
let taskFilter = "all";
let selectedDateOffset = 0;
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

init();

function init() {
  applyPreferences();
  populateDomainSelect();
  bindShell();
  renderAll();
  restoreReview();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { tasks: saved?.tasks?.length ? saved.tasks : seedTasks, goals: saved?.goals?.length ? saved.goals : seedGoals, completions: saved?.completions || {}, microWins: saved?.microWins || {}, friction: saved?.friction || {}, reviews: saved?.reviews || [], preferences: { name: "Daniel O.", fontSize: "normal", accent: "green", theme: "system", ...(saved?.preferences || {}) } };
  } catch { return { tasks: seedTasks, goals: seedGoals, completions: {}, microWins: {}, friction: {}, reviews: [], preferences: { name: "Daniel O.", fontSize: "normal", accent: "green", theme: "system" } }; }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char])); }
function dateKey(offset = selectedDateOffset) { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0,10); }
function domain(id) { return DOMAINS[id] || DOMAINS.steward; }
function isDone(id) { return Boolean(state.completions[dateKey()]?.[id]); }
function dayName(offset = selectedDateOffset) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString("en-NG", { weekday: "long" }); }

function bindShell() {
  $$("[data-route]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.route)));
  $$("[data-route-jump]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.routeJump)));
  $$("[data-add-task]").forEach(button => button.addEventListener("click", () => openEntityModal("task")));
  $$("[data-add-goal]").forEach(button => button.addEventListener("click", () => openEntityModal("goal")));
  $("#quickAddButton").addEventListener("click", () => openEntityModal("task"));
  $("#mobileMenu").addEventListener("click", openSidebar);
  $("#sidebarClose").addEventListener("click", closeSidebar);
  $("#sidebarScrim").addEventListener("click", closeSidebar);
  $("#profileButton").addEventListener("click", openSettings);
  $("#settingsClose").addEventListener("click", closeSettings);
  $("#settingsBackdrop").addEventListener("click", event => { if (event.target.id === "settingsBackdrop") closeSettings(); });
  $("#settingsForm").addEventListener("submit", event => { event.preventDefault(); closeSettings(); toast("Profile preferences saved"); });
  $("#displayName").addEventListener("input", event => updatePreference("name", event.target.value));
  $("#fontSizeOptions").addEventListener("click", event => { const button = event.target.closest("[data-font-size]"); if (button) updatePreference("fontSize", button.dataset.fontSize); });
  $("#accentOptions").addEventListener("click", event => { const button = event.target.closest("[data-accent]"); if (button) updatePreference("accent", button.dataset.accent); });
  $("#themeOptions").addEventListener("click", event => { const button = event.target.closest("[data-theme-choice]"); if (button) updatePreference("theme", button.dataset.themeChoice); });
  $("#themeToggle").addEventListener("click", toggleTheme);
  systemTheme.addEventListener("change", () => { if (state.preferences.theme === "system") applyPreferences(); });
  $("#modalClose").addEventListener("click", closeModal); $("#modalCancel").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", event => { if (event.target.id === "modalBackdrop") closeModal(); });
  $("#entityForm").addEventListener("submit", saveEntity);
  $("#previousDay").addEventListener("click", () => changeDay(-1)); $("#nextDay").addEventListener("click", () => changeDay(1));
  $("#todayPicker").addEventListener("click", () => { selectedDateOffset = 0; renderAll(); });
  $("#adjustLoad").addEventListener("click", adjustDayLoad);
  $("[data-scroll='dayPlan']").addEventListener("click", () => $("#dayPlan").scrollIntoView({ behavior: "smooth" }));
  $("#taskSearch").addEventListener("input", renderTaskLibrary);
  $("#globalSearch").addEventListener("input", event => { if (event.target.value.trim()) { navigate("tasks"); $("#taskSearch").value = event.target.value; renderTaskLibrary(); } });
  $("#taskFilters").addEventListener("click", event => { const button = event.target.closest("[data-filter]"); if (!button) return; taskFilter = button.dataset.filter; $$("button", $("#taskFilters")).forEach(item => item.classList.toggle("active", item === button)); renderTaskLibrary(); });
  $("#saveReview").addEventListener("click", saveReview);
  $("#applyInsight").addEventListener("click", () => { ["night-reset","night-prayer","sleep"].forEach(id => { const task = state.tasks.find(item => item.id === id); if (task) task.note = "Protected night anchor — prioritize this week."; }); saveState(); toast("Night anchors protected for this week"); });
  document.addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#globalSearch").focus(); } if (event.key === "Escape") { closeModal(); closeSettings(); closeSidebar(); } });
}

function openSidebar() { $("#sidebar").classList.add("open"); document.body.classList.add("drawer-open"); }
function closeSidebar() { $("#sidebar").classList.remove("open"); document.body.classList.remove("drawer-open"); }

function navigate(route) {
  currentRoute = route;
  $$(".view").forEach(view => view.classList.toggle("active", view.dataset.view === route));
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.route === route));
  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderAll();
}

function renderAll() {
  renderDate(); renderMetrics(); renderTodayTasks(); renderDomains(); renderGoalSpotlight(); renderFriction(); renderTaskLibrary(); renderGoals(); renderInsights(); renderDomainBoard(); renderReviewStats();
  $("#taskNavCount").textContent = state.tasks.length;
}

function applyPreferences() {
  const prefs = state.preferences;
  const resolvedTheme = prefs.theme === "system" ? (systemTheme.matches ? "dark" : "light") : prefs.theme;
  document.documentElement.dataset.accent = prefs.accent;
  document.documentElement.dataset.fontSize = prefs.fontSize;
  document.documentElement.dataset.theme = resolvedTheme;
  $("#themeToggle").textContent = resolvedTheme === "dark" ? "☾" : "☼";
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
  $$('[data-font-size]').forEach(button => button.classList.toggle("active", button.dataset.fontSize === state.preferences.fontSize));
  $$('[data-accent]').forEach(button => button.classList.toggle("active", button.dataset.accent === state.preferences.accent));
  $$('[data-theme-choice]').forEach(button => button.classList.toggle("active", button.dataset.themeChoice === state.preferences.theme));
}

function updatePreference(key, value) {
  state.preferences[key] = value;
  saveState(); applyPreferences();
}

function toggleTheme() {
  const activeTheme = document.documentElement.dataset.theme;
  updatePreference("theme", activeTheme === "dark" ? "light" : "dark");
  toast(`${activeTheme === "dark" ? "Light" : "Dark"} theme enabled`);
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
  if ($("#modalBackdrop").hidden) document.body.style.overflow = "";
}

function renderDate() {
  const date = new Date(); date.setDate(date.getDate() + selectedDateOffset);
  $("#todayDate").textContent = date.toLocaleDateString("en-NG", { weekday:"long", day:"numeric", month:"long" }).toUpperCase();
  $("#todayPicker").innerHTML = `${selectedDateOffset === 0 ? "Today" : date.toLocaleDateString("en-NG",{month:"short",day:"numeric"})} <span>⌄</span>`;
}

function tasksForToday() {
  const name = dayName();
  return state.tasks.filter(task => task.schedule === "daily" || task.schedule === "once" || (task.schedule === "weekly" && weeklyTaskFits(task, name))).slice(0, 18);
}

function weeklyTaskFits(task, day) {
  const map = { "business-dms":["Monday","Tuesday","Thursday"], coding:["Tuesday","Saturday"], drawing:["Tuesday"], writing:["Wednesday","Friday","Saturday","Sunday"], laundry:["Tuesday","Thursday"], stroll:["Monday","Tuesday","Thursday","Friday","Saturday","Sunday"], "weekly-review":["Sunday"], church:["Sunday"], "pm-tool":["Saturday"], "selar-product":["Saturday"] };
  return (map[task.id] || ["Saturday"]).includes(day);
}

function renderMetrics() {
  const tasks = tasksForToday(); const done = tasks.filter(task => isDone(task.id)).length; const micro = Object.keys(state.microWins[dateKey()] || {}).length; const percent = Math.round((done / Math.max(tasks.length,1))*100);
  const metrics = [
    ["Today’s progress", `${percent}%`, `${done} of ${tasks.length} anchors`, [7,12,9,17,21,16,24]],
    ["Momentum", String(done * 8 + micro * 3), micro ? `${micro} minimum win${micro > 1 ? "s" : ""}` : "Ready to begin", [8,13,11,15,18,22,20]],
    ["Recovery speed", "8.4h", "2 gentle restarts", [20,16,17,12,14,9,8]],
    ["Breadth this week", "5 / 7", "Healthy range", [5,10,15,12,18,17,23]]
  ];
  $("#metricGrid").innerHTML = metrics.map(([label,value,note,bars]) => `<article class="metric-card"><small>${label}</small><strong>${value}</strong><p>${note}</p><span class="metric-spark">${bars.map(height => `<i style="height:${height}px"></i>`).join("")}</span></article>`).join("");
}

function renderTodayTasks() {
  const tasks = tasksForToday(); const groups = ["Morning","Deep work","Evening"];
  $("#todayTaskGroups").innerHTML = groups.map(group => {
    const items = tasks.filter(task => task.period === group);
    if (!items.length) return "";
    return `<div class="task-group"><div class="task-group-label">${group}</div>${items.map(todayTaskTemplate).join("")}</div>`;
  }).join("") + lectureBlock();
  bindTaskActions($("#todayTaskGroups"));
  const done = tasks.filter(task => isDone(task.id)).length;
  $("#planProgress").style.width = `${Math.round(done / Math.max(tasks.length,1) * 100)}%`;
}

function todayTaskTemplate(task) {
  const d = domain(task.domain); const micro = Boolean(state.microWins[dateKey()]?.[task.id]);
  return `<article class="today-task ${isDone(task.id) ? "done" : ""}" data-task-row="${task.id}">
    <button class="task-check" data-complete="${task.id}" aria-label="Mark ${escapeHtml(task.name)} complete">✓</button>
    <div><span class="task-name">${escapeHtml(task.name)}</span><span class="task-detail"><i class="domain-dot" style="--domain-color:${d.color}"></i>${d.name}${micro ? " · minimum win counted" : task.minimum ? ` · <button class="micro-button" data-micro="${task.id}">Do minimum</button>` : ""}</span></div>
    <div class="task-menu"><span class="task-time">${escapeHtml(task.time || "Flexible")}</span><button data-menu="${task.id}" aria-label="Task actions">•••</button></div>
  </article>`;
}

function lectureBlock() {
  const lectures = lectureTasks[dayName()] || [];
  if (!lectures.length) return "";
  return `<div class="task-group"><div class="task-group-label">Flexible lectures · may not hold</div>${lectures.map(([name,time],index) => { const id=`lecture-${dayName()}-${index}`; return todayTaskTemplate({ id, name, time, domain:"scholar", minimum:"Confirm whether it holds" }); }).join("")}</div>`;
}

function bindTaskActions(root) {
  $$('[data-complete]', root).forEach(button => button.addEventListener("click", () => toggleComplete(button.dataset.complete)));
  $$('[data-micro]', root).forEach(button => button.addEventListener("click", () => countMicro(button.dataset.micro)));
  $$('[data-menu]', root).forEach(button => button.addEventListener("click", event => openTaskMenu(event, button.dataset.menu)));
}

function toggleComplete(id) {
  state.completions[dateKey()] = state.completions[dateKey()] || {};
  state.completions[dateKey()][id] = !state.completions[dateKey()][id]; saveState(); renderAll();
  toast(state.completions[dateKey()][id] ? "Win counted. Keep the rhythm gentle." : "Task reopened");
}

function countMicro(id) {
  state.microWins[dateKey()] = state.microWins[dateKey()] || {};
  state.microWins[dateKey()][id] = true; saveState(); renderAll(); toast("Minimum version counted — continuity protected");
}

function openTaskMenu(event, id) {
  event.stopPropagation(); $$(".task-popover").forEach(item => item.remove());
  const owner = event.currentTarget.closest(".task-menu") || event.currentTarget.closest(".goal-menu");
  const popover = document.createElement("div"); popover.className = "task-popover";
  popover.innerHTML = `<button data-edit-action>Edit</button><button class="danger" data-delete-action>Delete</button>`; owner.appendChild(popover);
  $("[data-edit-action]", popover).addEventListener("click", () => openEntityModal("task", id));
  $("[data-delete-action]", popover).addEventListener("click", () => deleteTask(id));
  setTimeout(() => document.addEventListener("click", () => popover.remove(), { once:true }), 0);
}

function deleteTask(id) { const task = state.tasks.find(item => item.id === id); state.tasks = state.tasks.filter(item => item.id !== id); saveState(); renderAll(); toast(`Deleted “${task?.name || "task"}”`); }

function renderDomains() {
  const values = { spirit:82, body:74, scholar:91, creator:38, builder:61, steward:68, connection:54 };
  $("#domainList").innerHTML = Object.entries(DOMAINS).slice(0,5).map(([id,item]) => `<div class="domain-row" style="--domain-color:${item.color}"><span class="domain-symbol">${item.icon}</span><div><strong>${item.name}</strong><div class="domain-meter"><span style="width:${values[id]}%"></span></div></div><small>${values[id]}%</small></div>`).join("");
}

function renderGoalSpotlight() {
  const goal = [...state.goals].sort((a,b) => b.progress-a.progress)[0];
  $("#goalSpotlight").innerHTML = goal ? `<p class="overline">GOAL IN ORBIT</p><h3>${escapeHtml(goal.name)}</h3><p>${escapeHtml(goal.note)}</p><div class="goal-progress-head"><span>Current progress</span><strong>${goal.progress}%</strong></div><div class="goal-progress"><span style="width:${goal.progress}%"></span></div>` : `<p class="overline">GOAL IN ORBIT</p><h3>No active goal yet</h3><button class="card-link" data-add-goal>Start one <span>→</span></button>`;
  const add = $("[data-add-goal]", $("#goalSpotlight")); if (add) add.addEventListener("click", () => openEntityModal("goal"));
}

function renderFriction() {
  const current = state.friction[dateKey()] || {};
  $("#frictionLog").innerHTML = FRICTIONS.map(item => `<div class="friction-item"><div><strong>${item.name}</strong><small>${item.cue}</small></div><div class="friction-actions"><button class="${current[item.id] === "resisted" ? "active" : ""}" data-friction="${item.id}" data-friction-status="resisted">Resisted</button><button class="${current[item.id] === "slipped" ? "active" : ""}" data-friction="${item.id}" data-friction-status="slipped">Slipped</button></div></div>`).join("");
  $$('[data-friction]').forEach(button => button.addEventListener("click", () => {
    state.friction[dateKey()] = state.friction[dateKey()] || {};
    state.friction[dateKey()][button.dataset.friction] = button.dataset.frictionStatus;
    saveState(); renderAll();
    toast(button.dataset.frictionStatus === "resisted" ? "Resistance counted as real progress" : "Slip logged. Your next tiny return matters now.");
  }));
}

function renderTaskLibrary() {
  const root = $("#taskLibraryList"); if (!root) return;
  const query = $("#taskSearch")?.value.trim().toLowerCase() || "";
  const tasks = state.tasks.filter(task => (taskFilter === "all" || task.schedule === taskFilter) && (!query || `${task.name} ${domain(task.domain).name}`.toLowerCase().includes(query)));
  root.innerHTML = tasks.length ? tasks.map(task => { const d=domain(task.domain); const completed=isDone(task.id); return `<article class="library-row"><div class="library-task"><button class="task-check" data-complete="${task.id}">✓</button><div><strong>${escapeHtml(task.name)}</strong><small>${escapeHtml(task.minimum || "No minimum version set")}</small></div></div><span class="domain-chip" style="--domain-color:${d.color}"><i></i>${d.name}</span><span class="schedule-chip">${task.schedule === "daily" ? "Every day" : task.schedule === "weekly" ? "Weekly" : "One-off"}</span><span class="row-progress">${completed ? "Done today" : "Ready"}<span><i style="width:${completed ? 100 : 34}%"></i></span></span><div class="task-menu"><button data-menu="${task.id}">•••</button></div></article>`; }).join("") : `<div class="empty-state"><strong>No tasks found</strong>Try another filter or add a new practice.</div>`;
  bindTaskActions(root);
}

function renderGoals() {
  const avg = Math.round(state.goals.reduce((sum,goal)=>sum+Number(goal.progress),0)/Math.max(state.goals.length,1));
  $("#goalSummary").innerHTML = [["Active goals",state.goals.length],["Average progress",`${avg}%`],["Domains represented",new Set(state.goals.map(goal=>goal.domain)).size]].map(([label,value])=>`<article class="summary-card"><small>${label}</small><strong>${value}</strong></article>`).join("");
  $("#goalGrid").innerHTML = state.goals.length ? state.goals.map(goal => { const d=domain(goal.domain); return `<article class="goal-card" style="--domain-color:${d.color}"><span class="goal-icon">${d.icon}</span><div class="goal-menu"><button class="more-button" data-goal-menu="${goal.id}">•••</button></div><h3>${escapeHtml(goal.name)}</h3><p>${escapeHtml(goal.note)}</p><div class="goal-card-footer"><div class="goal-progress-head"><span>${d.name}</span><strong>${goal.progress}%</strong></div><div class="goal-progress"><span style="width:${goal.progress}%"></span></div><small>${goal.date ? `Target ${formatDate(goal.date)}` : "Open horizon"}</small></div></article>`; }).join("") : `<article class="empty-state card"><strong>Your next horizon starts here</strong>Add a goal and connect it to one tiny recurring action.</article>`;
  $$('[data-goal-menu]').forEach(button => button.addEventListener("click", event => openGoalMenu(event,button.dataset.goalMenu)));
}

function openGoalMenu(event,id) {
  event.stopPropagation(); $$(".task-popover").forEach(item=>item.remove()); const owner=event.currentTarget.closest(".goal-menu"); const pop=document.createElement("div"); pop.className="task-popover"; pop.innerHTML='<button data-edit-action>Edit</button><button class="danger" data-delete-action>Delete</button>'; owner.appendChild(pop);
  $("[data-edit-action]",pop).addEventListener("click",()=>openEntityModal("goal",id)); $("[data-delete-action]",pop).addEventListener("click",()=>{ const goal=state.goals.find(item=>item.id===id); state.goals=state.goals.filter(item=>item.id!==id); saveState(); renderAll(); toast(`Deleted “${goal?.name || "goal"}”`); }); setTimeout(()=>document.addEventListener("click",()=>pop.remove(),{once:true}),0);
}

function renderInsights() {
  const doneToday=tasksForToday().filter(task=>isDone(task.id)).length;
  const resisted = Object.values(state.friction[dateKey()] || {}).filter(value => value === "resisted").length;
  const data=[["Completion rate",`${Math.round(doneToday/Math.max(tasksForToday().length,1)*100)}%`,"Based on today’s adaptive load"],["Return rate","86%","You usually resume within one day"],["Minimum wins",Object.keys(state.microWins[dateKey()]||{}).length,"Tiny versions that prevented a zero"],["Resistance wins",resisted,"Urges noticed without obeying them"]];
  $("#insightMetrics").innerHTML=data.map(([label,value,note])=>`<article class="insight-metric"><small>${label}</small><strong>${value}</strong><p>${note}</p></article>`).join("");
  const bars=[54,71,43,82,64,37,76]; const days=["M","T","W","T","F","S","S"]; $("#weeklyChart").innerHTML=bars.map((value,index)=>`<div class="bar-column"><div class="bar ${index===new Date().getDay()-1?"today":""}" style="--height:${value}%"><em>${value}%</em></div><small>${days[index]}</small></div>`).join("");
  const values={spirit:82,body:74,scholar:91,creator:38,builder:61,steward:68,connection:54}; $("#domainAnalytics").innerHTML=Object.entries(DOMAINS).map(([id,item])=>`<div class="domain-analytic-row" style="--domain-color:${item.color}"><strong>${item.name}</strong><div class="domain-meter"><span style="width:${values[id]}%"></span></div><span>${values[id]}</span></div>`).join("");
  $("#heatmap").innerHTML=Array.from({length:84},(_,i)=>`<i data-level="${[0,1,2,3,2,4,1,3,0,2,4,3][i%12]}"></i>`).join("");
}

function renderDomainBoard() {
  const values={spirit:82,body:74,scholar:91,creator:38,builder:61,steward:68,connection:54};
  $("#domainBoard").innerHTML=Object.entries(DOMAINS).map(([id,item])=>{ const count=state.tasks.filter(task=>task.domain===id).length; return `<article class="domain-board-card" style="--domain-color:${item.color}"><span class="domain-symbol">${item.icon}</span><h3>${item.name}</h3><p>${item.description}</p><div class="domain-meter"><span style="width:${values[id]}%"></span></div><footer><span>${count} practices</span><strong>${values[id]}% alive</strong></footer></article>`; }).join("");
}

function renderReviewStats() { const done=Object.values(state.completions).reduce((sum,day)=>sum+Object.values(day).filter(Boolean).length,0); $("#reviewStats").innerHTML=[[done,"completed actions"],[Object.values(state.microWins).reduce((sum,day)=>sum+Object.keys(day).length,0),"minimum wins"],["5 / 7","domains touched"],["2","gentle restarts"]].map(([value,label])=>`<div class="review-stat"><strong>${value}</strong><small>${label}</small></div>`).join(""); }

function openEntityModal(type,id="") {
  const isTask=type==="task"; const item=isTask ? state.tasks.find(task=>task.id===id) : state.goals.find(goal=>goal.id===id);
  $("#entityType").value=type; $("#entityId").value=id; $("#modalEyebrow").textContent=id?"EDIT DETAILS":isTask?"NEW PRACTICE":"NEW HORIZON"; $("#modalTitle").textContent=`${id?"Edit":"Add"} ${type}`; $("#saveEntity").textContent=`Save ${type}`;
  $("#taskFields").hidden=!isTask; $("#goalFields").hidden=isTask; $("#minimumField").hidden=!isTask;
  $("#entityName").value=item?.name||""; $("#entityDomain").value=item?.domain||"scholar"; $("#entitySchedule").value=item?.schedule||"daily"; $("#entityMinimum").value=item?.minimum||""; $("#entityNote").value=item?.note||""; $("#goalDate").value=item?.date||""; $("#goalProgress").value=item?.progress||0;
  $("#modalBackdrop").hidden=false; document.body.style.overflow="hidden"; setTimeout(()=>$("#entityName").focus(),50);
}

function closeModal() { $("#modalBackdrop").hidden=true; document.body.style.overflow=""; }

function saveEntity(event) {
  event.preventDefault(); const type=$("#entityType").value; const id=$("#entityId").value; const common={ name:$("#entityName").value.trim(), domain:$("#entityDomain").value, note:$("#entityNote").value.trim() };
  if (type==="task") { const existing=state.tasks.find(task=>task.id===id); const item={ id:id||makeId("task"), ...common, schedule:$("#entitySchedule").value, minimum:$("#entityMinimum").value.trim(), time:existing?.time||"Flexible", period:existing?.period||"Deep work", createdAt:existing?.createdAt||Date.now() }; if(existing) Object.assign(existing,item); else state.tasks.unshift(item); }
  else { const existing=state.goals.find(goal=>goal.id===id); const item={ id:id||makeId("goal"), ...common, date:$("#goalDate").value, progress:Math.min(100,Math.max(0,Number($("#goalProgress").value)||0)) }; if(existing) Object.assign(existing,item); else state.goals.unshift(item); }
  saveState(); closeModal(); renderAll(); toast(`${type === "task" ? "Task" : "Goal"} saved to your orbit`);
}

function populateDomainSelect() { $("#entityDomain").innerHTML=Object.entries(DOMAINS).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join(""); }
function changeDay(amount) { selectedDateOffset+=amount; renderAll(); }
function adjustDayLoad() { const heavy=state.tasks.filter(task=>task.schedule==="daily" && !isDone(task.id)).slice(-4); heavy.forEach(task=>{ state.microWins[dateKey()]=state.microWins[dateKey()]||{}; state.microWins[dateKey()][task.id]=true; }); saveState(); renderAll(); toast("Load softened: four tasks moved to minimum mode"); }
function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-NG",{day:"numeric",month:"short",year:"numeric"}); }
function toast(message) { const item=document.createElement("div"); item.className="toast"; item.innerHTML=`<span>✓</span>${escapeHtml(message)}`; $("#toastRegion").appendChild(item); setTimeout(()=>item.remove(),3200); }
function saveReview() { const review={date:new Date().toISOString(),easy:$("#reviewEasy").value,friction:$("#reviewFriction").value,smaller:$("#reviewSmaller").value}; state.reviews.unshift(review); saveState(); toast("Weekly review saved. No verdict, just learning."); }
function restoreReview() { const latest=state.reviews[0]; if(!latest)return; $("#reviewEasy").value=latest.easy||""; $("#reviewFriction").value=latest.friction||""; $("#reviewSmaller").value=latest.smaller||""; }
