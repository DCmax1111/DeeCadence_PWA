(function () {
  "use strict";

  var APP_VERSION = "3.2.current";
  var STORAGE_KEY = "deecadence_state_v2";
  var FEEDBACK_ENDPOINT = (document.querySelector('meta[name="deecadence-feedback-endpoint"]') || {}).content || "";
  var FEEDBACK_EMAIL = (document.querySelector('meta[name="deecadence-feedback-email"]') || {}).content || "";
  var SUPABASE_URL = (document.querySelector('meta[name="deecadence-supabase-url"]') || {}).content || "";
  var SUPABASE_ANON_KEY = (document.querySelector('meta[name="deecadence-supabase-anon-key"]') || {}).content || "";
  var FEEDBACK_TABLE = (document.querySelector('meta[name="deecadence-feedback-table"]') || {}).content || "feedbacks";
  var REFERENCE_BENCHMARK = { score: 70, label: "Provisional reference average", version: "launch-2026" };
  var XP_PER_FOCUS_MINUTE = 1;
  var XP_MANUAL_DONE_RATE = 0.25;
  var XP_SESSION_BONUS_RATE = 0.1;
  var XP_PAUSE_FREE_LIMIT = 5;
  var XP_PAUSE_PENALTY = 1;
  var RECOVERY_SECONDS = 60;
  var MAX_CUSTOM_MINUTES = 240;
  var MIN_CUSTOM_MINUTES = 4;
  var SCHEDULE_START_MINUTES = 0;
  var SCHEDULE_END_MINUTES = 24 * 60;
  var DAY_START_MINUTES = 8 * 60;
  var DAY_END_MINUTES = 20 * 60;
  var SOUND_FILES = {
    blockComplete: "assets/sounds/block-complete.wav",
    sessionComplete: "assets/sounds/session-complete.wav"
  };

  var RANKS = [
    { id: "E", name: "E-Rank", minLevel: 1, minXp: 0, desc: "Learning consistency", color: "var(--rank-E)" },
    { id: "D", name: "D-Rank", minLevel: 5, minXp: 1736, desc: "Control is forming", color: "var(--rank-D)" },
    { id: "C", name: "C-Rank", minLevel: 25, minXp: 14380, desc: "Reliable under pressure", color: "var(--rank-C)" },
    { id: "B", name: "B-Rank", minLevel: 45, minXp: 29403, desc: "Deep work is repeatable", color: "var(--rank-B)" },
    { id: "A", name: "A-Rank", minLevel: 70, minXp: 49999, desc: "High consistency", color: "var(--rank-A)" },
    { id: "S", name: "S-Rank", minLevel: 100, minXp: 109109, desc: "Elite attention control", color: "var(--rank-S)" },
    { id: "SS", name: "SS-Rank", minLevel: 200, minXp: 237678, desc: "Rare long-term discipline", color: "var(--rank-SS)" },
    { id: "SSS", name: "SSS-Rank", minLevel: 300, minXp: 460371, desc: "Exceptional cadence", color: "var(--rank-SSS)" },
    { id: "L", name: "L-Rank", minLevel: 500, minXp: 999999, desc: "Legendary attention span", color: "var(--rank-L)" }
  ];
  var L_LEVEL_BASE_XP = 5000;
  var L_LEVEL_GROWTH_XP = 50;
  var xpLevelCache = Object.create(null);

  function cumulativeXpForLevel(level) {
    var target = Math.max(1, Math.floor(Number(level) || 1));
    if (xpLevelCache[target] != null) return xpLevelCache[target];
    var last = RANKS[RANKS.length - 1];
    if (target >= last.minLevel) {
      var extra = target - last.minLevel;
      xpLevelCache[target] = last.minXp + Math.round((extra * L_LEVEL_BASE_XP) + (extra * (extra - 1) * L_LEVEL_GROWTH_XP / 2));
      return xpLevelCache[target];
    }

    for (var i = 0; i < RANKS.length - 1; i += 1) {
      var start = RANKS[i];
      var end = RANKS[i + 1];
      if (target < end.minLevel) {
        var xpSpan = end.minXp - start.minXp;
        var levelSpan = end.minLevel - start.minLevel;
        xpLevelCache[target] = start.minXp + Math.ceil((target - start.minLevel) * xpSpan / levelSpan);
        return xpLevelCache[target];
      }
    }

    return last.minXp;
  }

  function xpNeededForLevel(level) {
    var safe = Math.max(1, Math.floor(Number(level) || 1));
    return Math.max(1, cumulativeXpForLevel(safe + 1) - cumulativeXpForLevel(safe));
  }

  function currentLevel(totalXp) {
    var xp = Math.max(0, Math.floor(Number(totalXp) || 0));
    var low = 1;
    var high = 2;
    while (cumulativeXpForLevel(high) <= xp && high < 10000) high *= 2;
    while (low < high) {
      var mid = Math.floor((low + high + 1) / 2);
      if (cumulativeXpForLevel(mid) <= xp) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  function currentRank(totalXp) {
    var xp = Math.max(0, Math.floor(Number(totalXp) || 0));
    var rank = RANKS[0];
    for (var i = 0; i < RANKS.length; i += 1) {
      if (xp >= RANKS[i].minXp) rank = RANKS[i];
    }
    return rank;
  }

  function nextRank(totalXp) {
    var xp = Math.max(0, Math.floor(Number(totalXp) || 0));
    for (var i = 0; i < RANKS.length; i += 1) {
      if (xp < RANKS[i].minXp) return RANKS[i];
    }
    return null;
  }

  function levelProgress(totalXp) {
    var xp = Math.max(0, Math.floor(Number(totalXp) || 0));
    var level = currentLevel(xp);
    var floor = cumulativeXpForLevel(level);
    var ceiling = cumulativeXpForLevel(level + 1);
    return Math.max(0, Math.min(1, (xp - floor) / Math.max(1, ceiling - floor)));
  }

  function xpToNextLevel(totalXp) {
    var xp = Math.max(0, Math.floor(Number(totalXp) || 0));
    return Math.max(0, cumulativeXpForLevel(currentLevel(xp) + 1) - xp);
  }

  function detectLevelUp(prevXp, newXp) {
    return currentLevel(newXp) > currentLevel(prevXp);
  }

  function detectRankUp(prevXp, newXp) {
    var before = currentRank(prevXp);
    var after = currentRank(newXp);
    return before.id !== after.id ? after : null;
  }

  var idCounter = 1;
  var timerHandle = null;
  var activeView = "today";
  var currentPlanTab = "day";
  var currentPlanMode = "schedule";
  var pendingStartTask = null;
  var editingTaskId = null;
  var activeDetailTaskId = null;
  var tourActive = false;
  var tourIndex = 0;
  var tourPreviousView = "today";
  var chosenMinutes = 25;
  var chosenBlockCount = 4;
  var selectedProgressType = "countable";
  var selectedProgressDate = "";
  var startTaskSource = "schedule";
  var feedbackType = "Idea";
  var attentionRuntime = null;
  var attentionTimer = null;
  var audioCache = {};

  var startModal = document.getElementById("startModal");
  var taskModal = document.getElementById("taskModal");
  var taskDetailModal = document.getElementById("taskDetailModal");
  var feedbackModal = document.getElementById("feedbackModal");
  var attentionTestModal = document.getElementById("attentionTestModal");
  var welcomeOverlay = document.getElementById("welcomeOverlay");
  var tourOverlay = document.getElementById("tourOverlay");
  var revealOverlay = document.getElementById("revealOverlay");

  var TOUR_STEPS = [
    {
      view: "today",
      target: '[data-tour="today-rank"]',
      coach: "Start here",
      title: "DeeCadence rebuilds attention",
      body: "You plan one task, focus on one block, earn XP from the minutes you actually protect, then continue from where you stopped."
    },
    {
      view: "rank",
      target: '[data-tour="rank-ladder"]',
      coach: "Ranks",
      title: "What the letters mean",
      body: "E, D, C, B, A, S, SS, SSS, and L are attention ranks. E is the starting point. Higher letters need much more total XP, so long focus time matters."
    },
    {
      view: "plan",
      target: '[data-tour="plan-controls"]',
      coach: "Practice 1",
      title: "Pick Schedule or Tasks",
      body: "Schedule shows your day by time. Tasks shows the same work as a checklist so you can edit, mark done, or start focus quickly."
    },
    {
      view: "plan",
      target: '[data-tour="add-task"]',
      coach: "Practice 2",
      title: "Add one task",
      body: "Give the task a title, date, optional time, and estimate. If the time is flexible, Auto-arrange can place it neatly."
    },
    {
      view: "plan",
      target: "#progressTypeSeg",
      setup: "taskModal",
      coach: "Task setup",
      title: "Count pieces or track time",
      body: "Count pieces is for work with clear parts, like 4 pages. Track time only is for ongoing work where finishing minutes matters more than ticking pieces."
    },
    {
      view: "plan",
      target: "#taskFlexInput",
      setup: "taskModal",
      coach: "Timing",
      title: "Fixed or flexible time",
      body: "Fixed means keep this exact time. Flexible means DeeCadence can move it when Auto-arrange builds a clean schedule."
    },
    {
      view: "focus",
      target: '[data-tour="focus-root"]',
      setup: "closeModals",
      coach: "Practice 3",
      title: "Start one block at a time",
      body: "Choose a session length and 1 to 4 blocks based on your plan. The timer only shows the current block so it feels manageable."
    },
    {
      view: "progress",
      target: "#progressChart",
      coach: "Scoring",
      title: "XP follows focused time",
      body: "A finished block earns about 1 XP per focused minute. Completing every selected block adds a small bonus. Marking work done outside the timer earns much less."
    },
    {
      view: "rank",
      target: '[data-tour="rank-console"]',
      coach: "Discipline",
      title: "The climb gets harder",
      body: "Pausing is allowed, but after 5 pauses in one session, DeeCadence starts subtracting small XP. The goal is gentle pressure, not punishment."
    }
  ];

  var state = loadState();

  function getSound(name) {
    if (!SOUND_FILES[name] || typeof Audio === "undefined") return null;
    if (!audioCache[name]) {
      audioCache[name] = new Audio(SOUND_FILES[name]);
      audioCache[name].preload = "auto";
      audioCache[name].volume = name === "sessionComplete" ? 0.56 : 0.42;
    }
    return audioCache[name];
  }

  function primeSounds() {
    Object.keys(SOUND_FILES).forEach(function (name) {
      getSound(name);
    });
  }

  function playSound(name) {
    if (!state.settings.sound) return;
    var sound = getSound(name);
    if (!sound) return;
    try {
      sound.currentTime = 0;
      var attempt = sound.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(function () {});
      }
    } catch (error) {
      // Browser autoplay rules can still block audio after long idle periods.
    }
  }

  function clampMinutes(value, fallback) {
    var parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) parsed = fallback || 25;
    return Math.max(MIN_CUSTOM_MINUTES, Math.min(MAX_CUSTOM_MINUTES, parsed));
  }

  function localDateKey(date) {
    var value = date instanceof Date ? date : new Date(date || Date.now());
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
  }

  function todayStr() {
    return localDateKey(new Date());
  }

  function focusXpForSeconds(seconds) {
    return Math.max(1, Math.round((Math.max(1, Number(seconds) || 1) / 60) * XP_PER_FOCUS_MINUTE));
  }

  function sessionCompletionBonus(totalMinutes) {
    return Math.max(1, Math.round(clampMinutes(totalMinutes, 25) * XP_SESSION_BONUS_RATE));
  }

  function manualDoneXp(task) {
    var minutes = task && task.estMinutes ? task.estMinutes : 20;
    return Math.max(1, Math.round(focusXpForSeconds(minutes * 60) * XP_MANUAL_DONE_RATE));
  }

  function applyXpPenalty(amount) {
    var penalty = Math.max(0, Math.round(Number(amount) || 0));
    if (!penalty) return 0;
    var applied = Math.min(state.profile.totalXp, penalty);
    state.profile.totalXp -= applied;
    return applied;
  }

  function addDaysKey(dateKey, delta) {
    var base = parseDateKey(dateKey);
    base.setDate(base.getDate() + delta);
    return localDateKey(base);
  }

  function parseDateKey(dateKey) {
    var parts = String(dateKey || todayStr()).split("-").map(function (part) { return parseInt(part, 10); });
    return new Date(parts[0] || new Date().getFullYear(), (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0, 0);
  }

  function makeId(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + (idCounter++);
  }

  function defaultState() {
    return {
      appVersion: APP_VERSION,
      profile: { totalXp: 0, streak: 0, lastActiveDate: null, dailyGoalBlocks: 4, dailyGoalMinutes: 60 },
      settings: {
        theme: "dark",
        sound: true,
        soundPreferenceTouched: false,
        welcomeComplete: false,
        tutorialComplete: false,
        reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      },
      tasks: [
        normalizeTask({ title: "Reply to warm leads", estMinutes: 25, priority: "high", units: 4, notes: "From the carousel campaign" }),
        normalizeTask({ title: "Draft ceremony program layout", estMinutes: 50, priority: "medium", units: 4 })
      ],
      session: null,
      savedSessions: [],
      history: [],
      dailyBlockLog: {},
      dailyFocusMinutes: {},
      attentionTests: [],
      baselineScore: null,
      baselineTestId: "",
      baselineCompletedAt: "",
      feedbackOutbox: [],
      dismissedContextTips: {}
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var base = defaultState();
      var loaded = Object.assign({}, base, parsed, {
        appVersion: APP_VERSION,
        profile: Object.assign({}, base.profile, parsed.profile || {}),
        settings: Object.assign({}, base.settings, parsed.settings || {}),
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask) : base.tasks,
        savedSessions: Array.isArray(parsed.savedSessions) ? parsed.savedSessions.map(normalizeSavedSession).filter(Boolean).slice(0, 4) : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        dailyBlockLog: parsed.dailyBlockLog && typeof parsed.dailyBlockLog === "object" ? parsed.dailyBlockLog : {},
        dailyFocusMinutes: parsed.dailyFocusMinutes && typeof parsed.dailyFocusMinutes === "object" ? parsed.dailyFocusMinutes : {},
        attentionTests: Array.isArray(parsed.attentionTests) ? parsed.attentionTests.map(normalizeAttentionTest).filter(Boolean).slice(-60) : [],
        baselineScore: Number.isFinite(Number(parsed.baselineScore)) ? Math.max(0, Math.min(100, Math.round(Number(parsed.baselineScore)))) : null,
        baselineTestId: String(parsed.baselineTestId || ""),
        baselineCompletedAt: String(parsed.baselineCompletedAt || ""),
        feedbackOutbox: Array.isArray(parsed.feedbackOutbox) ? parsed.feedbackOutbox.slice(-50) : [],
        dismissedContextTips: parsed.dismissedContextTips && typeof parsed.dismissedContextTips === "object" ? parsed.dismissedContextTips : {}
      });
      if (loaded.baselineScore === null && loaded.attentionTests.length) {
        loaded.baselineScore = loaded.attentionTests[0].score;
        loaded.baselineTestId = loaded.attentionTests[0].id;
        loaded.baselineCompletedAt = loaded.attentionTests[0].takenAt;
      }
      if (!loaded.profile.dailyGoalMinutes) loaded.profile.dailyGoalMinutes = loaded.profile.dailyGoalBlocks ? loaded.profile.dailyGoalBlocks * 15 : 60;
      if (!Object.prototype.hasOwnProperty.call(parsed.settings || {}, "soundPreferenceTouched")) loaded.settings.sound = true;
      loaded.session = normalizeSession(parsed.session);
      var migratedSavedSessions = loaded.history
        .map(historyEntryToSavedSession)
        .filter(Boolean)
        .filter(function (saved) {
          return !loaded.savedSessions.some(function (existing) { return existing.id === saved.id; });
        });
      loaded.savedSessions = loaded.savedSessions.concat(migratedSavedSessions).slice(0, 4);
      return loaded;
    } catch (error) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Local-only build: keep running even when storage is unavailable.
    }
  }

  function normalizeTask(input) {
    var source = input || {};
    var existingUnits = source.units && typeof source.units === "object" ? source.units : {};
    var total = Math.max(1, Math.min(12, parseInt(existingUnits.total || source.units || 4, 10) || 4));
    var completed = Math.max(0, Math.min(total, parseInt(existingUnits.completed || source.completedUnits || 0, 10) || 0));
    return {
      id: source.id || makeId("task"),
      title: String(source.title || "Untitled task").trim() || "Untitled task",
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(source.date || "")) ? source.date : todayStr(),
      time: /^\d{2}:\d{2}$/.test(String(source.time || "")) ? source.time : null,
      flex: source.flex === "fixed" ? "fixed" : "flexible",
      estMinutes: clampMinutes(source.estMinutes, 25),
      priority: ["high", "medium", "low"].indexOf(source.priority) > -1 ? source.priority : "medium",
      notes: String(source.notes || ""),
      units: { total: total, completed: completed },
      manualDoneXpAwarded: Boolean(source.manualDoneXpAwarded),
      status: completed >= total ? "completed" : (source.status === "in_progress" ? "in_progress" : "pending")
    };
  }

  function normalizeSession(session) {
    if (!session || !Array.isArray(session.blocks) || !session.blocks.length) return null;
    var blocks = session.blocks.slice(0, 4).map(function (value) {
      return Math.max(1, parseInt(value, 10) || 1);
    });
    var index = Math.max(0, Math.min(blocks.length - 1, parseInt(session.blockIndex, 10) || 0));
    return {
      id: session.id || makeId("sess"),
      totalMinutes: clampMinutes(session.totalMinutes, 25),
      blocks: blocks,
      blockIndex: index,
      blockRemaining: Math.max(0, parseInt(session.blockRemaining, 10) || blocks[index]),
      blockEndsAt: Number.isFinite(Number(session.blockEndsAt)) ? Number(session.blockEndsAt) : null,
      status: ["running", "paused", "recovery"].indexOf(session.status) > -1 ? session.status : "paused",
      linkedTaskId: session.linkedTaskId || null,
      startedAt: session.startedAt || Date.now(),
      blocksCompleted: Math.max(0, Math.min(blocks.length, parseInt(session.blocksCompleted, 10) || 0)),
      xpEarned: Math.max(0, parseInt(session.xpEarned, 10) || 0),
      pauseCount: Math.max(0, parseInt(session.pauseCount, 10) || 0),
      penaltyXp: Math.max(0, parseInt(session.penaltyXp, 10) || 0),
      recoveryRemaining: Math.max(0, parseInt(session.recoveryRemaining, 10) || 0),
      recoveryEndsAt: Number.isFinite(Number(session.recoveryEndsAt)) ? Number(session.recoveryEndsAt) : null,
      lastReveal: session.lastReveal || null,
      blockFeedback: Array.isArray(session.blockFeedback) ? session.blockFeedback.slice(0, 4) : []
    };
  }

  function normalizeSavedSession(session) {
    var normalized = normalizeSession(session);
    if (!normalized || normalized.blocksCompleted >= normalized.blocks.length) return null;
    normalized.status = "saved";
    normalized.blockEndsAt = null;
    normalized.recoveryEndsAt = null;
    normalized.recoveryRemaining = 0;
    var savedIndex = Math.max(normalized.blockIndex, normalized.blocksCompleted);
    savedIndex = Math.max(0, Math.min(normalized.blocks.length - 1, savedIndex));
    var canKeepRemaining = savedIndex === normalized.blockIndex && normalized.blockRemaining > 0;
    normalized.blockIndex = savedIndex;
    normalized.blockRemaining = canKeepRemaining
      ? Math.max(1, Math.min(normalized.blocks[savedIndex], normalized.blockRemaining))
      : normalized.blocks[savedIndex];
    normalized.savedAt = Number.isFinite(Number(session.savedAt)) ? Number(session.savedAt) : Date.now();
    return normalized;
  }

  function normalizeAttentionTest(test) {
    if (!test || !Number.isFinite(Number(test.score))) return null;
    return {
      id: test.id || makeId("test"),
      takenAt: test.takenAt || new Date().toISOString(),
      score: Math.max(0, Math.min(100, Math.round(Number(test.score)))),
      accuracy: Math.max(0, Math.min(100, Math.round(Number(test.accuracy) || 0))),
      averageReaction: test.averageReaction == null ? null : Math.max(0, Math.round(Number(test.averageReaction) || 0)),
      misses: Math.max(0, Math.round(Number(test.misses) || 0)),
      falseTaps: Math.max(0, Math.round(Number(test.falseTaps) || 0)),
      benchmarkScore: Math.max(0, Math.min(100, Math.round(Number(test.benchmarkScore) || REFERENCE_BENCHMARK.score))),
      benchmarkVersion: String(test.benchmarkVersion || REFERENCE_BENCHMARK.version)
    };
  }

  function historyEntryToSavedSession(entry) {
    if (!entry || entry.completedAll || !entry.blocksCompleted || entry.blocksCompleted >= (entry.blocksPlanned || 4)) return null;
    var totalMinutes = clampMinutes(entry.totalMinutes, 25);
    return normalizeSavedSession({
      id: entry.id || makeId("saved"),
      totalMinutes: totalMinutes,
      blocks: splitIntoBlocks(totalMinutes, entry.blocksPlanned || 4),
      blockIndex: entry.blocksCompleted,
      linkedTaskId: entry.linkedTaskId || null,
      startedAt: entry.completedAt || Date.now(),
      blocksCompleted: entry.blocksCompleted,
      xpEarned: entry.xpEarned || 0,
      savedAt: entry.completedAt || Date.now()
    });
  }

  function getTask(id) {
    return state.tasks.find(function (task) { return task.id === id; }) || null;
  }

  function priorityWeight(priority) {
    return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
  }

  function timeToMin(value) {
    var parts = String(value || "00:00").split(":");
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }

  function minToTime(value) {
    var min = Math.max(0, Math.min((23 * 60) + 59, Math.round(value)));
    var h = Math.floor(min / 60);
    var m = min % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function nextTask() {
    var today = todayStr();
    var tasks = state.tasks.filter(function (task) {
      return task.date === today && task.status !== "completed";
    });
    tasks.sort(function (a, b) {
      var at = a.time ? timeToMin(a.time) : 9999;
      var bt = b.time ? timeToMin(b.time) : 9999;
      if (at !== bt) return at - bt;
      return priorityWeight(a.priority) - priorityWeight(b.priority);
    });
    return tasks[0] || null;
  }

  function autoArrangeSchedule() {
    var cursor = DAY_START_MINUTES;
    var gap = 15;
    var today = todayStr();
    var todaysTasks = state.tasks.filter(function (task) {
      return task.date === today && task.status !== "completed";
    });
    var fixed = todaysTasks.filter(function (task) { return task.flex === "fixed" && task.time; });
    var flexible = todaysTasks.filter(function (task) { return !(task.flex === "fixed" && task.time); });
    var placed = fixed.map(function (task) {
      var start = timeToMin(task.time);
      return { task: task, start: start, end: start + task.estMinutes };
    });

    fixed.sort(function (a, b) { return timeToMin(a.time) - timeToMin(b.time); });
    flexible.sort(function (a, b) {
      var priorityDelta = priorityWeight(a.priority) - priorityWeight(b.priority);
      return priorityDelta || a.estMinutes - b.estMinutes;
    });

    flexible.forEach(function (task) {
      var moved = true;
      while (moved) {
        moved = false;
        for (var i = 0; i < placed.length; i += 1) {
          if (cursor < placed[i].end && cursor + task.estMinutes > placed[i].start) {
            cursor = placed[i].end + gap;
            moved = true;
          }
        }
      }
      var duration = Math.min(task.estMinutes, DAY_END_MINUTES - DAY_START_MINUTES);
      if (cursor + duration > DAY_END_MINUTES) cursor = Math.max(DAY_START_MINUTES, DAY_END_MINUTES - duration);
      task.date = today;
      task.time = minToTime(cursor);
      placed.push({ task: task, start: cursor, end: cursor + duration });
      cursor = Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES, cursor + duration + gap));
    });

    saveState();
    return placed.sort(function (a, b) { return a.start - b.start; }).map(function (item) { return item.task; });
  }

  function clampBlockCount(value, fallback) {
    var parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) parsed = fallback || 4;
    return Math.max(1, Math.min(4, parsed));
  }

  function splitIntoBlocks(totalMinutes, blockCount) {
    var totalSeconds = Math.max(1, Math.round(clampMinutes(totalMinutes, 25) * 60));
    var count = clampBlockCount(blockCount, 4);
    var base = Math.floor(totalSeconds / count);
    var remainder = totalSeconds - (base * count);
    return Array.from({ length: count }).map(function (_, index) {
      return base + (index < remainder ? 1 : 0);
    });
  }

  function beginSession(totalMinutes, linkedTaskId, blockCount) {
    if (state.session) {
      openStartModal(getTask(linkedTaskId));
      return;
    }
    var minutes = clampMinutes(totalMinutes, 25);
    var blocks = splitIntoBlocks(minutes, blockCount);
    state.session = {
      id: makeId("sess"),
      totalMinutes: minutes,
      blocks: blocks,
      blockIndex: 0,
      blockRemaining: blocks[0],
      blockEndsAt: Date.now() + (blocks[0] * 1000),
      status: "running",
      linkedTaskId: linkedTaskId || null,
      startedAt: Date.now(),
      blocksCompleted: 0,
      xpEarned: 0,
      pauseCount: 0,
      penaltyXp: 0,
      recoveryRemaining: 0,
      recoveryEndsAt: null,
      lastReveal: null,
      blockFeedback: []
    };
    if (linkedTaskId && getTask(linkedTaskId)) getTask(linkedTaskId).status = "in_progress";
    saveState();
    startTicker();
    switchView("focus");
    renderAll();
  }

  function startTicker() {
    stopTicker();
    timerHandle = setInterval(tick, 1000);
  }

  function stopTicker() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  function tick() {
    var session = state.session;
    if (!session) {
      stopTicker();
      return;
    }
    if (syncSessionClock()) return;
    renderFocus(true);
    renderSessionIndicators();
    saveState();
  }

  function secondsUntil(epochMs) {
    return Math.max(0, Math.ceil((Number(epochMs || 0) - Date.now()) / 1000));
  }

  function syncSessionClock() {
    var session = state.session;
    if (!session) return false;
    if (session.status === "running") {
      if (!session.blockEndsAt) session.blockEndsAt = Date.now() + (Math.max(1, session.blockRemaining) * 1000);
      session.blockRemaining = secondsUntil(session.blockEndsAt);
      if (session.blockRemaining <= 0) {
        completeCurrentBlock();
        return true;
      }
    } else if (session.status === "recovery") {
      if (!session.recoveryEndsAt) session.recoveryEndsAt = Date.now() + (Math.max(0, session.recoveryRemaining) * 1000);
      session.recoveryRemaining = secondsUntil(session.recoveryEndsAt);
    }
    return false;
  }

  function pauseSession() {
    if (!state.session || state.session.status !== "running") return;
    state.session.blockRemaining = state.session.blockEndsAt ? secondsUntil(state.session.blockEndsAt) : state.session.blockRemaining;
    state.session.blockEndsAt = null;
    state.session.status = "paused";
    state.session.pauseCount = (state.session.pauseCount || 0) + 1;
    if (state.session.pauseCount > XP_PAUSE_FREE_LIMIT) {
      var penalty = applyXpPenalty(XP_PAUSE_PENALTY);
      state.session.penaltyXp = (state.session.penaltyXp || 0) + penalty;
      showToast(penalty ? "Pause limit passed. -" + penalty + " XP" : "Pause limit passed.");
    }
    stopTicker();
    saveState();
    renderFocus();
  }

  function resumeSession() {
    if (!state.session || state.session.status !== "paused") return;
    state.session.blockRemaining = Math.max(1, state.session.blockRemaining);
    state.session.blockEndsAt = Date.now() + (state.session.blockRemaining * 1000);
    state.session.status = "running";
    saveState();
    startTicker();
    renderFocus();
  }

  function advanceLinkedTaskProgress(taskId) {
    var task = getTask(taskId);
    if (!task) return null;
    task.units.completed = Math.min(task.units.total, task.units.completed + 1);
    task.status = task.units.completed >= task.units.total ? "completed" : "in_progress";
    return task;
  }

  function deleteTask(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    if (state.session && state.session.linkedTaskId === taskId) {
      showToast("This task is attached to the current block.");
      switchView("focus");
      return;
    }
    if (state.savedSessions.some(function (session) { return session.linkedTaskId === taskId; })) {
      showToast("Continue or remove the saved focus session first.");
      switchView("focus");
      return;
    }
    if (!confirm('Delete "' + task.title + '" from your plan?')) return;
    state.tasks = state.tasks.filter(function (item) { return item.id !== taskId; });
    saveState();
    renderPlan();
    renderToday();
    showToast("Task deleted");
  }

  function completeCurrentBlock() {
    var session = state.session;
    if (!session) return;
    var prevXp = state.profile.totalXp;
    var isFinalBlock = session.blockIndex >= session.blocks.length - 1;
    var blockSeconds = session.blocks[session.blockIndex] || 60;
    var xpGained = focusXpForSeconds(blockSeconds) + (isFinalBlock ? sessionCompletionBonus(session.totalMinutes) : 0);
    var linkedTask = session.linkedTaskId ? advanceLinkedTaskProgress(session.linkedTaskId) : null;

    applyDailyStreak();
    logDailyFocus(blockSeconds);
    state.profile.totalXp += xpGained;
    session.blocksCompleted += 1;
    session.xpEarned += xpGained;
    session.blockRemaining = 0;
    session.blockEndsAt = null;
    session.status = "recovery";
    session.recoveryRemaining = RECOVERY_SECONDS;
    session.recoveryEndsAt = Date.now() + (RECOVERY_SECONDS * 1000);
    session.lastReveal = {
      xpGained: xpGained,
      prevXp: prevXp,
      newXp: state.profile.totalXp,
      leveledUp: detectLevelUp(prevXp, state.profile.totalXp),
      rankedUpId: (detectRankUp(prevXp, state.profile.totalXp) || {}).id || "",
      linkedTaskId: linkedTask ? linkedTask.id : "",
      isFinalBlock: isFinalBlock,
      focusedMinutes: Math.round(blockSeconds / 60),
      penaltyXp: session.penaltyXp || 0
    };

    playSound(isFinalBlock ? "sessionComplete" : "blockComplete");
    showXpFloat(xpGained);
    saveState();
    renderAll();
    showSystemReveal(session.lastReveal);
  }

  function continueSession() {
    var session = state.session;
    if (!session) return;
    if (session.blockIndex >= session.blocks.length - 1) {
      finalizeSession(true);
      return;
    }
    session.blockIndex += 1;
    session.blockRemaining = session.blocks[session.blockIndex];
    session.blockEndsAt = Date.now() + (session.blockRemaining * 1000);
    session.status = "running";
    session.recoveryRemaining = 0;
    session.recoveryEndsAt = null;
    closeReveal();
    saveState();
    startTicker();
    renderAll();
    switchView("focus");
  }

  function finalizeSession(completedAll) {
    var session = state.session;
    if (!session) return;
    stopTicker();
    var currentDuration = session.blocks[session.blockIndex] || 0;
    var hasPartialProgress = session.blockRemaining < currentDuration;
    if (!completedAll && session.blocksCompleted < session.blocks.length && (session.blocksCompleted > 0 || hasPartialProgress)) {
      saveIncompleteSession(session);
      state.session = null;
      closeReveal();
      saveState();
      renderAll();
      switchView("focus");
      showToast("Saved. Continue it from Focus.");
      return;
    }
    if (!completedAll && !session.blocksCompleted && !hasPartialProgress) {
      state.session = null;
      closeReveal();
      saveState();
      renderAll();
      switchView("focus");
      showToast("Session cleared.");
      return;
    }
    state.history.unshift({
      id: session.id,
      date: todayStr(),
      completedAt: Date.now(),
      totalMinutes: session.totalMinutes,
      blocksCompleted: session.blocksCompleted,
      blocksPlanned: session.blocks.length,
      xpEarned: session.xpEarned,
      penaltyXp: session.penaltyXp || 0,
      pauseCount: session.pauseCount || 0,
      linkedTaskId: session.linkedTaskId,
      linkedTaskTitle: session.linkedTaskId && getTask(session.linkedTaskId) ? getTask(session.linkedTaskId).title : null,
      completedAll: Boolean(completedAll),
      blockFeedback: session.blockFeedback || []
    });
    state.session = null;
    closeReveal();
    saveState();
    renderAll();
    switchView("today");
    showToast(completedAll ? "Session complete. Progress saved." : "Progress saved.");
  }

  function saveIncompleteSession(session) {
    var saved = normalizeSavedSession({
      id: session.id,
      totalMinutes: session.totalMinutes,
      blocks: session.blocks,
      blockIndex: session.blockIndex,
      blockRemaining: session.blockRemaining,
      status: "saved",
      linkedTaskId: session.linkedTaskId,
      startedAt: session.startedAt,
      blocksCompleted: session.blocksCompleted,
      xpEarned: session.xpEarned,
      pauseCount: session.pauseCount || 0,
      penaltyXp: session.penaltyXp || 0,
      savedAt: Date.now(),
      lastReveal: session.lastReveal,
      blockFeedback: session.blockFeedback || []
    });
    if (!saved) return;
    state.savedSessions = [saved]
      .concat(state.savedSessions.filter(function (item) { return item.id !== saved.id; }))
      .slice(0, 4);
  }

  function continueSavedSession(sessionId) {
    if (state.session) {
      switchView("focus");
      showToast("Finish the current block first.");
      return;
    }
    var saved = state.savedSessions.find(function (item) { return item.id === sessionId; });
    if (!saved) return;
    var resumeIndex = Math.max(0, Math.min(saved.blocks.length - 1, saved.blockIndex));
    var resumeRemaining = Math.max(1, Math.min(saved.blocks[resumeIndex], saved.blockRemaining || saved.blocks[resumeIndex]));
    state.savedSessions = state.savedSessions.filter(function (item) { return item.id !== sessionId; });
    state.session = normalizeSession(Object.assign({}, saved, {
      status: "running",
      blockIndex: resumeIndex,
      blockRemaining: resumeRemaining,
      blockEndsAt: Date.now() + (resumeRemaining * 1000),
      recoveryEndsAt: null,
      recoveryRemaining: 0
    }));
    saveState();
    startTicker();
    renderAll();
    switchView("focus");
    showToast("Session continued.");
  }

  function discardSavedSession(sessionId) {
    var saved = state.savedSessions.find(function (item) { return item.id === sessionId; });
    if (!saved) return;
    if (!confirm("Remove this saved focus session?")) return;
    var penalty = saved.blocksCompleted < saved.blocks.length ? applyXpPenalty(Math.min(10, Math.max(1, Math.round(saved.totalMinutes * 0.02)))) : 0;
    state.savedSessions = state.savedSessions.filter(function (item) { return item.id !== sessionId; });
    saveState();
    renderFocus();
    renderToday();
    showToast(penalty ? "Saved session removed. -" + penalty + " XP" : "Saved session removed.");
  }

  function applyDailyStreak() {
    var today = todayStr();
    if (state.profile.lastActiveDate === today) return;
    var yesterday = addDaysKey(today, -1);
    state.profile.streak = state.profile.lastActiveDate === yesterday ? state.profile.streak + 1 : 1;
    state.profile.lastActiveDate = today;
  }

  function logDailyFocus(blockSeconds) {
    var today = todayStr();
    state.dailyBlockLog[today] = (state.dailyBlockLog[today] || 0) + 1;
    state.dailyFocusMinutes[today] = (state.dailyFocusMinutes[today] || 0) + Math.max(1, Math.round((Number(blockSeconds) || 0) / 60));
  }

  function showSystemReveal(data) {
    if (!data || !revealOverlay) return;
    var rankUp = data.rankedUpId ? RANKS.find(function (rank) { return rank.id === data.rankedUpId; }) : null;
    var level = currentLevel(data.newXp);
    var rank = currentRank(data.newXp);
    var progress = levelProgress(data.newXp);
    var circumference = 2 * Math.PI * 52;
    var linkedTask = data.linkedTaskId ? getTask(data.linkedTaskId) : null;
    var ring = document.getElementById("revealRingFill");
    var flags = document.getElementById("revealFlags");
    var actions = document.getElementById("revealActions");

    document.getElementById("revealLevel").textContent = "Lv " + level;
    document.getElementById("revealRankName").textContent = rank.name;
    document.getElementById("revealRankName").style.color = rank.color;
    document.getElementById("revealXpGained").textContent = "+" + data.xpGained + " XP";
    document.getElementById("revealRemaining").textContent = formatNumber(xpToNextLevel(data.newXp)) + " XP to next level";
    if (ring) {
      ring.style.stroke = rank.color;
      ring.setAttribute("stroke-dasharray", String(circumference));
      ring.setAttribute("stroke-dashoffset", String(circumference));
      requestAnimationFrame(function () {
        ring.setAttribute("stroke-dashoffset", String(circumference * (1 - progress)));
      });
    }
    flags.innerHTML = "";
    if (rankUp) flags.innerHTML = '<div class="reveal-flag">Rank up - ' + escapeHtml(rankUp.name) + "</div>";
    else if (data.leveledUp) flags.innerHTML = '<div class="reveal-flag">Level up</div>';

    document.getElementById("revealTaskLine").innerHTML = linkedTask
      ? "<b>" + escapeHtml(linkedTask.title) + "</b> - " + linkedTask.units.completed + " of " + linkedTask.units.total + " units complete"
      : "Free focus block logged";

    var feedbackPanel = document.getElementById("blockFeedbackPanel");
    if (feedbackPanel) feedbackPanel.style.display = data.isManualDone ? "none" : "";
    resetBlockFeedbackControls(data);

    actions.innerHTML = data.isManualDone
      ? '<button class="btn btn-primary btn-block" id="revealCloseBtn">Close</button>'
      : data.isFinalBlock
        ? '<button class="btn btn-primary btn-block" id="revealFinishBtn">Finish session</button>'
        : '<button class="btn btn-primary btn-block" id="revealContinueBtn">Continue to next block</button><button class="btn btn-ghost btn-block" id="revealStopBtn">Stop and save progress</button>';

    revealOverlay.classList.add("open");
    var finish = document.getElementById("revealFinishBtn");
    var cont = document.getElementById("revealContinueBtn");
    var stop = document.getElementById("revealStopBtn");
    var close = document.getElementById("revealCloseBtn");
    Array.prototype.forEach.call(document.querySelectorAll("[data-block-feeling]"), function (button) {
      button.onclick = function () {
        Array.prototype.forEach.call(document.querySelectorAll("[data-block-feeling]"), function (item) { item.classList.remove("active"); });
        button.classList.add("active");
      };
    });
    if (finish) finish.onclick = function () {
      captureBlockFeedback();
      finalizeSession(true);
    };
    if (cont) cont.onclick = function () {
      captureBlockFeedback();
      continueSession();
    };
    if (stop) stop.onclick = function () {
      captureBlockFeedback();
      finalizeSession(false);
    };
    if (close) close.onclick = function () {
      revealOverlay.classList.remove("open");
    };
    (finish || cont || stop || close || revealOverlay).focus();
  }

  function resetBlockFeedbackControls(data) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-block-feeling]"), function (button) {
      button.classList.remove("active");
    });
    var note = document.getElementById("blockFeedbackNote");
    if (note) note.value = "";
    if (!state.session || !Array.isArray(state.session.blockFeedback)) return;
    var existing = state.session.blockFeedback.find(function (entry) {
      return entry && entry.blockIndex === state.session.blockIndex;
    });
    if (!existing) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-block-feeling]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-block-feeling") === existing.feeling);
    });
    if (note) note.value = existing.note || "";
  }

  function captureBlockFeedback() {
    var session = state.session;
    if (!session || session.status !== "recovery") return;
    var activeFeeling = document.querySelector("[data-block-feeling].active");
    var noteInput = document.getElementById("blockFeedbackNote");
    var feeling = activeFeeling ? activeFeeling.getAttribute("data-block-feeling") : "";
    var note = String((noteInput || {}).value || "").trim().replace(/\s+/g, " ");
    if (!feeling && !note) return;
    var entry = {
      blockIndex: session.blockIndex,
      blockNumber: session.blockIndex + 1,
      feeling: feeling,
      note: note,
      createdAt: Date.now()
    };
    session.blockFeedback = (session.blockFeedback || []).filter(function (item) {
      return item && item.blockIndex !== session.blockIndex;
    });
    session.blockFeedback.push(entry);
    if (session.lastReveal) session.lastReveal.feedback = entry;
    saveState();
  }

  function closeReveal() {
    if (revealOverlay) revealOverlay.classList.remove("open");
  }

  function fmtClock(totalSeconds) {
    var seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    var minutes = Math.floor(seconds / 60);
    var remainder = seconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatMinutesCompact(minutes) {
    var safe = Math.max(0, Math.round(Number(minutes) || 0));
    if (safe < 60) return safe + "m";
    var hours = Math.floor(safe / 60);
    var remainder = safe % 60;
    return hours + "h" + (remainder ? " " + remainder + "m" : "");
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = String(value == null ? "" : value);
    return div.innerHTML;
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }

  function showXpFloat(amount) {
    var xp = Math.round(Number(amount) || 0);
    if (!xp || !document.body || typeof document.body.appendChild !== "function") return;
    var bubble = document.createElement("div");
    bubble.className = "xp-float";
    bubble.textContent = (xp > 0 ? "+" : "") + xp + " XP";
    document.body.appendChild(bubble);
    setTimeout(function () {
      bubble.classList.add("rise");
    }, 20);
    setTimeout(function () {
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
    }, 1800);
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function exportBackup() {
    downloadJson("deecadence-backup-" + todayStr() + ".json", {
      product: "DeeCadence",
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      state: state
    });
    showToast("Backup exported");
  }

  function importBackup(event) {
    var file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file || typeof FileReader === "undefined") return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || "{}"));
        var incoming = parsed.state || parsed;
        if (!incoming || !Array.isArray(incoming.tasks) || !incoming.profile) throw new Error("Invalid backup");
        localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
        state = loadState();
        saveState();
        renderAll();
        switchView("today");
        showToast("Backup imported");
      } catch (error) {
        showToast("That backup file could not be read");
      } finally {
        if (event && event.target) event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function feedbackDeliveryMode() {
    if (FEEDBACK_ENDPOINT.trim()) return "endpoint";
    if (SUPABASE_URL.trim() && SUPABASE_ANON_KEY.trim()) return "supabase";
    if (FEEDBACK_EMAIL.trim()) return "email";
    return "outbox";
  }

  function updateFeedbackDeliveryCopy() {
    var mode = feedbackDeliveryMode();
    var pending = state.feedbackOutbox.length;
    var status = document.getElementById("feedbackDeliveryStatus");
    var note = document.getElementById("feedbackDeliveryNote");
    if (status) {
      status.textContent = mode === "endpoint"
        ? "Connected to the developer receiver" + (pending ? " - " + pending + " queued" : "") + "."
        : mode === "supabase"
          ? "Connected to Supabase feedback table" + (pending ? " - " + pending + " queued" : "") + "."
        : mode === "email"
          ? "Uses your email app to address the developer."
          : "Receiver not configured yet" + (pending ? " - " + pending + " saved locally" : "") + ".";
    }
    if (note) {
      note.textContent = mode === "endpoint"
        ? "This report will be sent to the configured DeeCadence developer receiver."
        : mode === "supabase"
          ? "This report will be saved to the configured Supabase table. Email delivery should be handled by an Edge Function or database trigger."
        : mode === "email"
          ? "Submitting opens a pre-addressed email draft. You remain in control of sending it."
          : "No receiver is configured yet. Submitting safely stores this report on this device.";
    }
  }

  function updateFeedbackBadge() {
    var badge = document.getElementById("feedbackQueueBadge");
    if (!badge) return;
    var count = state.feedbackOutbox.length;
    badge.hidden = count === 0;
    badge.textContent = String(Math.min(99, count));
  }

  function openFeedback() {
    feedbackType = "Idea";
    var message = document.getElementById("feedbackMessageInput");
    var email = document.getElementById("feedbackEmailInput");
    if (message) message.value = "";
    if (email) email.value = "";
    var count = document.getElementById("feedbackCharCount");
    if (count) count.textContent = "0";
    Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-type]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-feedback-type") === feedbackType);
    });
    updateFeedbackDeliveryCopy();
    feedbackModal.classList.add("open");
    setTimeout(function () { if (message) message.focus(); }, 80);
  }

  function closeFeedback() {
    if (feedbackModal) feedbackModal.classList.remove("open");
  }

  function anonymousFeedbackContext() {
    var minutesByDate = focusMinutesByDate();
    var focus7 = 0;
    for (var i = 0; i < 7; i += 1) focus7 += minutesByDate[addDaysKey(todayStr(), -i)] || 0;
    return {
      appVersion: APP_VERSION,
      view: activeView,
      viewport: window.innerWidth + "x" + window.innerHeight,
      platform: navigator.platform || "unknown",
      online: navigator.onLine,
      theme: state.settings.theme,
      reducedMotion: state.settings.reducedMotion,
      sessionCount: state.history.length,
      taskCount: state.tasks.length,
      totalXp: state.profile.totalXp,
      focusMinutes7: focus7,
      attentionTests: state.attentionTests.length
    };
  }

  function submitFeedback() {
    var message = document.getElementById("feedbackMessageInput").value.trim();
    if (message.length < 8) {
      showToast("Add a little more detail");
      return;
    }
    var payload = {
      id: makeId("feedback"),
      type: feedbackType,
      message: message,
      replyEmail: document.getElementById("feedbackEmailInput").value.trim().slice(0, 120),
      sentAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      context: document.getElementById("feedbackContextInput").checked ? anonymousFeedbackContext() : null
    };
    var button = document.getElementById("feedbackSubmitBtn");
    var mode = feedbackDeliveryMode();
    button.disabled = true;
    button.textContent = "Sending...";
    if (mode === "email") {
      var subject = encodeURIComponent("[DeeCadence " + feedbackType + "] Product feedback");
      var body = encodeURIComponent(message + "\n\nReply email: " + (payload.replyEmail || "Not provided") + "\n\nContext:\n" + JSON.stringify(payload.context, null, 2));
      window.location.href = "mailto:" + FEEDBACK_EMAIL + "?subject=" + subject + "&body=" + body;
      closeFeedback();
      showToast("Email draft opened");
      button.disabled = false;
      button.textContent = "Send feedback";
      return;
    }
    if (mode === "endpoint" && typeof fetch === "function") {
      fetch(FEEDBACK_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (response) {
          if (!response.ok) throw new Error("Receiver failed");
          closeFeedback();
          showToast("Feedback delivered");
        })
        .catch(function () {
          state.feedbackOutbox.push(payload);
          state.feedbackOutbox = state.feedbackOutbox.slice(-50);
          saveState();
          closeFeedback();
          showToast("Receiver unavailable. Feedback queued.");
        })
        .finally(function () {
          button.disabled = false;
          button.textContent = "Send feedback";
          updateFeedbackBadge();
          updateFeedbackDeliveryCopy();
        });
      return;
    }
    if (mode === "supabase" && typeof fetch === "function") {
      sendFeedbackToSupabase(payload)
        .then(function () {
          closeFeedback();
          showToast("Feedback saved to Supabase");
        })
        .catch(function () {
          state.feedbackOutbox.push(payload);
          state.feedbackOutbox = state.feedbackOutbox.slice(-50);
          saveState();
          closeFeedback();
          showToast("Supabase unavailable. Feedback queued.");
        })
        .finally(function () {
          button.disabled = false;
          button.textContent = "Send feedback";
          updateFeedbackBadge();
          updateFeedbackDeliveryCopy();
        });
      return;
    }
    state.feedbackOutbox.push(payload);
    state.feedbackOutbox = state.feedbackOutbox.slice(-50);
    saveState();
    closeFeedback();
    showToast("Feedback saved locally");
    button.disabled = false;
    button.textContent = "Send feedback";
    updateFeedbackBadge();
    updateFeedbackDeliveryCopy();
  }

  function retryFeedbackOutbox() {
    if (!navigator.onLine || !state.feedbackOutbox.length || typeof fetch !== "function") return;
    var mode = feedbackDeliveryMode();
    if (mode !== "endpoint" && mode !== "supabase") return;
    var remaining = [];
    Promise.all(state.feedbackOutbox.map(function (payload) {
      var request = mode === "supabase"
        ? sendFeedbackToSupabase(payload)
        : fetch(FEEDBACK_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(function (response) {
          if (!response.ok) throw new Error("Receiver failed");
        });
      return request
        .catch(function () { remaining.push(payload); });
    })).then(function () {
      if (remaining.length !== state.feedbackOutbox.length) {
        state.feedbackOutbox = remaining;
        saveState();
        updateFeedbackBadge();
        updateFeedbackDeliveryCopy();
      }
    });
  }

  function sendFeedbackToSupabase(payload) {
    var base = SUPABASE_URL.trim().replace(/\/+$/, "");
    var table = encodeURIComponent(FEEDBACK_TABLE.trim() || "feedbacks");
    var row = {
      id: payload.id,
      feedback_type: payload.type,
      message: payload.message,
      reply_email: payload.replyEmail || null,
      app_version: payload.appVersion,
      context: payload.context || null,
      recipient_email: FEEDBACK_EMAIL || "dominiquecreations24@gmail.com",
      created_at: payload.sentAt
    };
    return fetch(base + "/rest/v1/" + table, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY.trim(),
        "Authorization": "Bearer " + SUPABASE_ANON_KEY.trim(),
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(row)
    }).then(function (response) {
      if (!response.ok) throw new Error("Supabase insert failed");
    });
  }

  function openAttentionTest() {
    clearTimeout(attentionTimer);
    attentionRuntime = null;
    var body = document.getElementById("attentionTestBody");
    body.innerHTML =
      '<section class="test-guide">' +
        '<div class="attention-kicker">14-second attention baseline</div>' +
        '<h3 id="attentionTestTitle">One rule: respond only to FOCUS.</h3>' +
        '<p>This checks selective attention: noticing one target while ignoring nearby noise. Sit normally, silence notifications, and use this same device for fairer future comparisons.</p>' +
        '<div class="test-rules">' +
          '<div class="test-rule"><b>1</b><div><strong>Keep your eyes on the center.</strong><span>A new word appears about every 0.8 seconds.</span></div></div>' +
          '<div class="test-rule"><b>2</b><div><strong>Tap or press Space only for FOCUS.</strong><span>Ignore SCROLL, REPLY, NEW, WATCH, and every other word.</span></div></div>' +
          '<div class="test-rule"><b>3</b><div><strong>Respond once, then wait.</strong><span>Missed targets and wrong taps reduce the score.</span></div></div>' +
        '</div>' +
        '<div class="test-rule-note">This is a product benchmark, not a diagnosis.</div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" type="button" id="attentionCloseBtn">Not now</button><button class="btn btn-primary" type="button" id="attentionStartBtn">Start after countdown</button></div>' +
      '</section>';
    document.getElementById("attentionCloseBtn").onclick = closeAttentionTest;
    document.getElementById("attentionStartBtn").onclick = beginAttentionTest;
    attentionTestModal.classList.add("open");
  }

  function beginAttentionTest() {
    var sequences = [
      ["SCROLL", "FOCUS", "REPLY", "CHECK", "FOCUS", "SKIP", "NEW", "FOCUS", "WATCH", "REFRESH", "FOCUS", "LIKE", "PAUSE", "FOCUS", "SWITCH", "NEXT", "FOCUS", "DONE"],
      ["WATCH", "NEXT", "FOCUS", "NEW", "REPLY", "FOCUS", "SCROLL", "LIKE", "FOCUS", "CHECK", "SKIP", "PAUSE", "FOCUS", "REFRESH", "FOCUS", "SWITCH", "DONE", "FOCUS"]
    ];
    attentionRuntime = {
      sequence: sequences[state.attentionTests.length % sequences.length],
      index: -1,
      hits: 0,
      misses: 0,
      falseTaps: 0,
      reactions: [],
      shownAt: 0,
      hitCurrent: false,
      running: true
    };
    document.getElementById("attentionTestBody").innerHTML =
      '<section class="test-live">' +
        '<div class="test-live-head"><span>Selective attention</span><span data-test-count>Preparing...</span></div>' +
        '<div class="test-live-progress"><i data-test-progress></i></div>' +
        '<button class="test-signal" type="button" id="attentionSignalBtn" aria-label="Tap only when the word Focus appears">3</button>' +
        '<p class="test-live-note">Press Space or tap the word only when it says FOCUS.</p>' +
      '</section>';
    document.getElementById("attentionSignalBtn").onclick = registerAttentionTap;
    var countdown = 3;
    var runCountdown = function () {
      if (!attentionRuntime || !attentionRuntime.running) return;
      var signal = document.getElementById("attentionSignalBtn");
      signal.textContent = String(countdown);
      countdown -= 1;
      if (countdown < 0) showNextAttentionSignal();
      else attentionTimer = setTimeout(runCountdown, 500);
    };
    runCountdown();
  }

  function showNextAttentionSignal() {
    var runtime = attentionRuntime;
    if (!runtime || !runtime.running) return;
    if (runtime.index >= 0 && runtime.sequence[runtime.index] === "FOCUS" && !runtime.hitCurrent) runtime.misses += 1;
    runtime.index += 1;
    if (runtime.index >= runtime.sequence.length) {
      finishAttentionTest();
      return;
    }
    var word = runtime.sequence[runtime.index];
    runtime.hitCurrent = false;
    runtime.shownAt = performance.now();
    var signal = document.getElementById("attentionSignalBtn");
    signal.textContent = word;
    signal.classList.toggle("is-target", word === "FOCUS");
    var count = document.querySelector("[data-test-count]");
    var progress = document.querySelector("[data-test-progress]");
    if (count) count.textContent = (runtime.index + 1) + " / " + runtime.sequence.length;
    if (progress) progress.style.width = ((runtime.index + 1) / runtime.sequence.length * 100) + "%";
    attentionTimer = setTimeout(showNextAttentionSignal, 780);
  }

  function registerAttentionTap() {
    var runtime = attentionRuntime;
    if (!runtime || !runtime.running || runtime.index < 0) return;
    var word = runtime.sequence[runtime.index];
    var signal = document.getElementById("attentionSignalBtn");
    if (word === "FOCUS" && !runtime.hitCurrent) {
      runtime.hitCurrent = true;
      runtime.hits += 1;
      runtime.reactions.push(Math.round(performance.now() - runtime.shownAt));
      signal.textContent = "CAUGHT";
      signal.classList.remove("is-target");
    } else if (word !== "FOCUS") {
      runtime.falseTaps += 1;
      signal.textContent = "WAIT";
    }
  }

  function finishAttentionTest() {
    var runtime = attentionRuntime;
    if (!runtime) return;
    runtime.running = false;
    var targets = runtime.sequence.filter(function (word) { return word === "FOCUS"; }).length;
    var accuracy = Math.max(0, Math.round(runtime.hits / targets * 100 - runtime.falseTaps * 8));
    var averageReaction = runtime.reactions.length ? Math.round(runtime.reactions.reduce(function (sum, value) { return sum + value; }, 0) / runtime.reactions.length) : null;
    var reactionScore = averageReaction ? Math.max(0, Math.min(100, Math.round(120 - averageReaction / 8))) : 0;
    var score = Math.max(0, Math.min(100, Math.round(accuracy * 0.78 + reactionScore * 0.22)));
    var result = normalizeAttentionTest({
      id: makeId("test"),
      takenAt: new Date().toISOString(),
      score: score,
      accuracy: accuracy,
      averageReaction: averageReaction,
      misses: runtime.misses,
      falseTaps: runtime.falseTaps,
      benchmarkScore: REFERENCE_BENCHMARK.score,
      benchmarkVersion: REFERENCE_BENCHMARK.version
    });
    state.attentionTests.push(result);
    state.attentionTests = state.attentionTests.slice(-60);
    if (state.baselineScore === null || !state.baselineTestId) {
      state.baselineScore = result.score;
      state.baselineTestId = result.id;
      state.baselineCompletedAt = result.takenAt;
    }
    saveState();
    var previous = state.attentionTests[state.attentionTests.length - 2] || null;
    var change = previous ? result.score - previous.score : null;
    var referenceDelta = result.score - REFERENCE_BENCHMARK.score;
    var referenceCopy = Math.abs(referenceDelta) <= 5 ? "within the reference band" : referenceDelta > 0 ? referenceDelta + " points above the reference" : Math.abs(referenceDelta) + " points below the reference";
    document.getElementById("attentionTestBody").innerHTML =
      '<section class="test-result">' +
        '<div class="attention-kicker">' + (previous ? "New check saved" : "Starting baseline saved") + '</div>' +
        '<h3 id="attentionTestTitle">' + result.score + '<span class="score-denominator">/100</span></h3>' +
        '<p>' + (previous ? "That is " + (change >= 0 ? "+" : "") + change + " compared with your previous check." : "This is your personal starting point. You landed " + referenceCopy + ".") + ' Treat the pattern across several checks as useful, not one isolated score.</p>' +
        '<div class="benchmark-comparison">' +
          '<div class="benchmark-comparison-head"><span>Your score <strong>' + result.score + '</strong></span><span>' + REFERENCE_BENCHMARK.label + ' <strong>' + REFERENCE_BENCHMARK.score + '</strong></span></div>' +
          '<div class="benchmark-track"><i></i><b style="left:' + REFERENCE_BENCHMARK.score + '%"></b><em style="left:' + result.score + '%"></em></div>' +
        '</div>' +
        '<div class="test-result-grid">' +
          '<div><span>Accuracy</span><strong>' + accuracy + '%</strong></div>' +
          '<div><span>Reaction</span><strong>' + (averageReaction ? averageReaction + "ms" : "-") + '</strong></div>' +
          '<div><span>Misses</span><strong>' + runtime.misses + '</strong></div>' +
          '<div><span>Early taps</span><strong>' + runtime.falseTaps + '</strong></div>' +
        '</div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" type="button" id="attentionAgainBtn">Try again</button><button class="btn btn-primary" type="button" id="attentionDoneBtn">Return to progress</button></div>' +
      '</section>';
    document.getElementById("attentionAgainBtn").onclick = openAttentionTest;
    document.getElementById("attentionDoneBtn").onclick = closeAttentionTest;
    renderProgress();
  }

  function closeAttentionTest() {
    if (attentionRuntime && attentionRuntime.running && !confirm("Stop this attention check? The unfinished result will not be saved.")) return;
    clearTimeout(attentionTimer);
    attentionRuntime = null;
    if (attentionTestModal) attentionTestModal.classList.remove("open");
  }

  function renderTaskUnitRail(task) {
    var dots = "";
    for (var i = 0; i < task.units.total; i += 1) {
      dots += '<span class="unit-dot' + (i < task.units.completed ? " filled" : "") + '"></span>';
    }
    return '<div class="unit-rail" aria-label="' + task.units.completed + " of " + task.units.total + ' focus units complete">' + dots + "</div>";
  }

  function renderRankConsole(prefix) {
    var xp = state.profile.totalXp;
    var level = currentLevel(xp);
    var rank = currentRank(xp);
    var next = nextRank(xp);
    var progress = levelProgress(xp);
    var circumference = 2 * Math.PI * 42;
    document.documentElement.style.setProperty("--rank-glow-color", rank.color);

    var letter = document.getElementById(prefix === "today" ? "todayRankLetter" : "rankPageLetter");
    var fill = document.getElementById(prefix === "today" ? "todayOrbFill" : "rankOrbFill");
    if (letter) {
      letter.textContent = rank.id;
      letter.style.color = rank.color;
    }
    if (fill) {
      fill.style.stroke = rank.color;
      fill.setAttribute("stroke-dasharray", String(circumference));
      fill.setAttribute("stroke-dashoffset", String(circumference * (1 - progress)));
    }

    if (prefix === "today") {
      document.getElementById("todayRankLabel").textContent = rank.name + " - " + rank.desc;
      document.getElementById("todayLevel").textContent = "Level " + level;
      document.getElementById("todayXpFill").style.width = Math.round(progress * 100) + "%";
      document.getElementById("todayXpCaption").textContent = formatNumber(xpToNextLevel(xp)) + " XP to next level" + (next ? " - " + formatNumber(next.minXp - xp) + " XP to " + next.id : "");
    } else {
      document.getElementById("rankPageLabel").textContent = rank.name + " - " + rank.desc;
      document.getElementById("rankPageLevel").textContent = "Level " + level;
      document.getElementById("rankPageTotalXp").textContent = formatNumber(xp) + " total XP";
    }
  }

  function renderToday() {
    renderRankConsole("today");
    var task = nextTask();
    var wrap = document.getElementById("todayNextTaskWrap");
    var button = document.getElementById("startNextBlockBtn");
    if (state.savedSessions.length && !state.session) {
      var saved = state.savedSessions[0];
      var savedTask = saved.linkedTaskId ? getTask(saved.linkedTaskId) : null;
      wrap.innerHTML = '<div class="task-line"><div style="flex:1; min-width:0;">' +
        '<div class="task-title">Continue saved focus</div>' +
        '<div class="task-meta">' + (savedTask ? escapeHtml(savedTask.title) : "Free focus") + " - Block " + (saved.blocksCompleted + 1) + " of " + saved.blocks.length + " waiting</div>" +
        renderSessionBlockRail(saved) + "</div></div>";
      button.textContent = "Continue from Focus";
    } else if (task) {
      wrap.innerHTML = '<div class="task-line"><div style="flex:1; min-width:0;">' +
        '<div class="task-title">' + escapeHtml(task.title) + "</div>" +
        '<div class="task-meta">' + (task.time || "Unscheduled") + " - " + task.estMinutes + " min - " + task.priority + " priority</div>" +
        renderTaskUnitRail(task) + "</div></div>";
      button.textContent = "Start next block";
    } else {
      wrap.innerHTML = '<div style="font-size:13.5px; color:var(--text-dim);">No tasks queued for today. Add one from Plan, or start a free focus block.</div>';
      button.textContent = "Start free focus block";
    }

    var todays = state.tasks.filter(function (item) { return item.date === todayStr(); }).sort(function (a, b) {
      return (a.time ? timeToMin(a.time) : 9999) - (b.time ? timeToMin(b.time) : 9999);
    });
    document.getElementById("todayPlanList").innerHTML = renderTodayPlanGroups(todays);
  }

  function renderTodayPlanGroups(tasks) {
    if (!tasks.length) return '<div class="empty-state" style="padding:20px 0;">Nothing on the plan yet.</div>';
    var pending = tasks.filter(function (item) { return item.status !== "completed"; });
    var done = tasks.filter(function (item) { return item.status === "completed"; });
    return renderTodayPlanGroup("Ready to focus", pending, true) + renderTodayPlanGroup("Done", done, false);
  }

  function renderTodayPlanGroup(label, tasks, open) {
    return '<details class="today-plan-group" ' + (open ? "open" : "") + '><summary><span>' + label + '</span><small>' + tasks.length + '</small></summary><div class="today-plan-items">' + (tasks.length ? tasks.map(renderTodayPlanTask).join("") : '<div class="today-plan-empty">No tasks here.</div>') + '</div></details>';
  }

  function renderTodayPlanTask(item) {
    return '<div class="task-line ' + (taskTimingState(item) ? "has-time-alert" : "") + '"><div style="flex:1; min-width:0;">' +
      '<div class="task-title">' + escapeHtml(item.title) + (item.status === "completed" ? " done" : "") + "</div>" +
      '<div class="task-meta">' + (item.time || "Unscheduled") + " - " + item.estMinutes + " min " + renderTimingBadge(item) + "</div>" +
      renderTaskUnitRail(item) + "</div></div>";
  }

  function renderFocus() {
    var root = document.getElementById("focusRoot");
    var session = state.session;
    if (!session) {
      var savedHtml = renderSavedSessions();
      root.innerHTML = savedHtml || '<div class="card empty-focus"><div style="font-size:15px; color:var(--text); font-weight:600; margin-bottom:6px;">No block running</div><div style="margin-bottom:18px;">Start one from Today or Plan.</div><button class="btn btn-primary" id="focusStartFromEmpty">Start a focus block</button></div>';
      var startEmpty = document.getElementById("focusStartFromEmpty");
      if (startEmpty) startEmpty.onclick = function () { openStartModal(nextTask()); };
      Array.prototype.forEach.call(root.querySelectorAll("[data-continue-saved-session]"), function (button) {
        button.onclick = function () { continueSavedSession(button.getAttribute("data-continue-saved-session")); };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-discard-saved-session]"), function (button) {
        button.onclick = function () { discardSavedSession(button.getAttribute("data-discard-saved-session")); };
      });
      renderSessionIndicators();
      return;
    }

    var linkedTask = session.linkedTaskId ? getTask(session.linkedTaskId) : null;
    var blockTotal = session.blocks[session.blockIndex] || 1;
    var progress = Math.max(0, Math.min(1, (blockTotal - session.blockRemaining) / blockTotal));
    var circumference = 2 * Math.PI * 118;
    var pips = session.blocks.map(function (_, index) {
      var cls = index < session.blockIndex ? "done" : (index === session.blockIndex ? "current" : "");
      return '<div class="block-pip ' + cls + '"></div>';
    }).join("");
    var statusLabel = session.status === "running" ? "Block " + (session.blockIndex + 1) + " of " + session.blocks.length : session.status === "paused" ? "Paused" : "Recovery";
    var html = '<div class="card focus-stage"><div class="block-indicator">' + pips + "</div>";

    if (session.status === "recovery") {
      html += '<div class="timer-ring-wrap"><svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="118" fill="none" stroke="var(--surface-2)" stroke-width="10"/><circle cx="130" cy="130" r="118" fill="none" stroke="var(--success)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="0"/></svg><div class="timer-center"><div class="timer-digits mono">Saved</div><div class="timer-caption">Block ' + (session.blockIndex + 1) + " complete</div></div></div>";
      html += '<div class="focus-linked">' + (linkedTask ? "Progress saved on <b>" + escapeHtml(linkedTask.title) + "</b>" : "Free focus block logged") + "</div>";
      html += '<div class="recovery-note">' + fmtClock(session.recoveryRemaining) + " recovery available before the next block</div>";
      html += '<div class="focus-controls"><button class="btn btn-primary" id="reopenReveal">View result</button><button class="btn btn-ghost" id="stopBtn">Stop and save</button></div>';
    } else {
      html += '<div class="timer-ring-wrap"><svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="118" fill="none" stroke="var(--surface-2)" stroke-width="10"/><circle cx="130" cy="130" r="118" fill="none" stroke="var(--cyan)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + (circumference * (1 - progress)) + '"/></svg><div class="timer-center" role="timer" aria-label="' + fmtClock(session.blockRemaining) + ' remaining in current block"><div class="timer-digits mono">' + fmtClock(session.blockRemaining) + '</div><div class="timer-caption">' + statusLabel + "</div></div></div>";
      html += '<div class="focus-linked">' + (linkedTask ? "Linked to <b>" + escapeHtml(linkedTask.title) + "</b>" : "Free focus block") + "</div>";
      if (session.status === "paused") {
        html += '<div class="paused-session-card"><strong>Most recently paused block</strong><span>Block ' + (session.blockIndex + 1) + " is waiting with " + fmtClock(session.blockRemaining) + " left.</span></div>";
      }
      html += '<div class="focus-controls">' + (session.status === "running" ? '<button class="btn btn-secondary" id="pauseBtn">Pause</button>' : '<button class="btn btn-primary" id="resumeBtn">Continue paused block</button>') + '<button class="btn btn-danger" id="stopBtn">Stop and save</button></div>';
    }
    root.innerHTML = html + "</div>";

    var pause = document.getElementById("pauseBtn");
    var resume = document.getElementById("resumeBtn");
    var stop = document.getElementById("stopBtn");
    var reopen = document.getElementById("reopenReveal");
    if (pause) pause.onclick = pauseSession;
    if (resume) resume.onclick = resumeSession;
    if (stop) stop.onclick = function () { finalizeSession(false); };
    if (reopen) reopen.onclick = function () { showSystemReveal(session.lastReveal); };
    renderSessionIndicators();
  }

  function renderSessionBlockRail(session) {
    var dots = "";
    for (var i = 0; i < session.blocks.length; i += 1) {
      dots += '<span class="unit-dot' + (i < session.blocksCompleted ? " filled" : "") + '"></span>';
    }
    return '<div class="unit-rail" aria-label="' + session.blocksCompleted + " of " + session.blocks.length + ' focus blocks complete">' + dots + "</div>";
  }

  function renderSavedSessions() {
    if (!state.savedSessions.length) return "";
    return '<div class="saved-session-stack">' +
      '<div class="saved-session-heading"><div><span class="eyebrow">Saved focus</span><h3>Continue where you stopped</h3></div><small>Up to 4 incomplete sessions stay here.</small></div>' +
      state.savedSessions.map(function (saved) {
        var linkedTask = saved.linkedTaskId ? getTask(saved.linkedTaskId) : null;
        return '<article class="saved-session-card">' +
          '<div class="saved-session-main">' +
            '<strong>' + (linkedTask ? escapeHtml(linkedTask.title) : "Free focus session") + '</strong>' +
            '<span>Block ' + (saved.blocksCompleted + 1) + " of " + saved.blocks.length + " ready - " + saved.blocksCompleted + " completed - +" + saved.xpEarned + ' XP saved</span>' +
            renderSessionBlockRail(saved) +
          '</div>' +
          '<div class="saved-session-actions">' +
            '<button class="btn btn-primary" data-continue-saved-session="' + saved.id + '">Continue</button>' +
            '<button class="btn btn-ghost" data-discard-saved-session="' + saved.id + '">Remove</button>' +
          '</div>' +
        '</article>';
      }).join("") +
      '<button class="btn btn-secondary btn-block" id="focusStartFromEmpty">Start a new focus block</button>' +
    '</div>';
  }

  function planFilteredTasks() {
    return state.tasks.filter(function (task) {
      if (currentPlanTab === "day") return task.date === todayStr();
      if (currentPlanTab === "pending") return task.status !== "completed";
      var date = new Date(task.date + "T00:00:00");
      var now = startOfDay(new Date());
      return date >= now && date <= new Date(now.getTime() + (7 * 86400000));
    }).sort(sortTasksForPlan);
  }

  function sortTasksForPlan(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.time ? timeToMin(a.time) : 9999) - (b.time ? timeToMin(b.time) : 9999);
  }

  function planPriorityClass(task) {
    return task.priority === "high" ? "pri-high" : task.priority === "medium" ? "pri-med" : "pri-low";
  }

  function taskTimingState(task) {
    if (!task || task.status === "completed" || !task.time) return null;
    var today = todayStr();
    if (task.date < today) return { id: "missed", label: "Missed time" };
    if (task.date > today) return null;
    var now = new Date();
    var nowMin = (now.getHours() * 60) + now.getMinutes();
    var start = timeToMin(task.time);
    var end = start + task.estMinutes;
    if (nowMin > end) return { id: "missed", label: "Missed time" };
    if (nowMin > start) return { id: "time-passed", label: "Time passed" };
    return null;
  }

  function renderTimingBadge(task) {
    var timing = taskTimingState(task);
    return timing ? '<span class="timing-badge ' + timing.id + '">' + timing.label + '</span>' : "";
  }

  function renderTaskCard(task) {
    return '<div class="task-card task-row ' + (taskTimingState(task) ? "has-time-alert" : "") + '">' +
      '<button class="task-check" data-toggle-task="' + task.id + '" aria-label="' + (task.status === "completed" ? "Mark incomplete" : "Mark complete") + '">' + (task.status === "completed" ? "&#10003;" : "") + '</button>' +
      '<button class="task-row-main" data-open-task="' + task.id + '">' +
        '<span class="task-card-title">' + escapeHtml(task.title) + '</span>' +
        '<span class="task-card-meta">' + (currentPlanTab === "day" ? "" : task.date + " - ") + (task.time || "Unscheduled") + " - " + task.estMinutes + " min" + '</span>' +
      '</button>' +
      '<div class="task-card-actions">' +
        '<span class="priority-pill ' + planPriorityClass(task) + '">' + task.priority + '</span>' +
        '<button class="btn btn-ghost" data-edit-task="' + task.id + '">Edit</button>' +
        (task.status !== "completed" ? '<button class="btn btn-primary" data-focus-task="' + task.id + '">Focus</button>' : "") +
        '<button class="btn btn-ghost" data-delete-task="' + task.id + '">Delete</button>' +
      '</div></div>';
  }

  function syncPlanModeButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-plan-mode]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-plan-mode") === currentPlanMode);
    });
  }

  function syncPlanTabButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-planview]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-planview") === currentPlanTab);
    });
  }

  function renderPlan() {
    var root = document.getElementById("planList");
    var planView = document.getElementById("view-plan");
    if (currentPlanMode === "schedule" && currentPlanTab === "pending") currentPlanTab = "day";
    if (planView) planView.setAttribute("data-plan-mode-current", currentPlanMode);
    var list = planFilteredTasks();
    syncPlanModeButtons();
    syncPlanTabButtons();

    if (currentPlanMode === "schedule") renderScheduleView(root, list);
    else renderTaskListView(root, list);

    wirePlanTaskActions(root);
  }

  function renderTaskListView(root, list) {
    if (!list.length) {
      root.innerHTML = '<div class="empty-state"><h3>Nothing here yet</h3><p>Add a task and DeeCadence can place it into your day.</p></div>';
      return;
    }
    root.innerHTML = '<div class="task-list-stack">' + list.map(renderTaskCard).join("") + "</div>";
  }

  function renderScheduleView(root, list) {
    if (currentPlanTab === "week") {
      renderWeekSchedule(root);
      return;
    }
    if (currentPlanTab === "pending") {
      renderPendingSchedule(root, list);
      return;
    }
    renderDaySchedule(root, list);
  }

  function renderDaySchedule(root, list) {
    var timed = list.filter(function (task) { return task.time && task.status !== "completed"; });
    var pxPerMinute = 1.25;
    var timelineHeight = Math.round((SCHEDULE_END_MINUTES - SCHEDULE_START_MINUTES) * pxPerMinute);
    var hours = [];
    for (var min = SCHEDULE_START_MINUTES; min < SCHEDULE_END_MINUTES; min += 60) {
      hours.push('<div class="schedule-hour-row" style="top:' + Math.round((min - SCHEDULE_START_MINUTES) * pxPerMinute) + 'px"><span>' + minToTime(min) + '</span></div>');
    }
    var layout = layoutScheduleBlocks(timed, SCHEDULE_START_MINUTES, SCHEDULE_END_MINUTES);
    var blocks = layout.map(function (item) {
      var top = Math.max(0, Math.round((item.start - SCHEDULE_START_MINUTES) * pxPerMinute));
      var height = Math.max(14, Math.round((item.end - item.start) * pxPerMinute));
      var gap = item.columnCount > 1 ? 2 : 0;
      var width = 100 / item.columnCount;
      var left = width * item.column;
      var style = "top:" + top + "px;height:" + height + "px;left:" + left + "%;right:auto;width:calc(" + width + "% - " + gap + "px)";
      var task = item.task;
      var timing = taskTimingState(task);
      return '<article class="schedule-block ' + planPriorityClass(task) + (timing ? " " + timing.id : "") + (height < 24 ? " compact" : "") + '" style="' + style + '" data-open-task="' + task.id + '" role="button" tabindex="0" aria-label="Open ' + escapeHtml(task.title) + '"><strong>' + escapeHtml(task.title) + '</strong></article>';
    }).join("");

    root.innerHTML = '<section class="schedule-shell schedule-main"><div class="schedule-head"><div><div class="eyebrow">Today schedule</div><h3>' + formatReadableDate(todayStr()) + '</h3></div><span>00:00 - 23:59 - ' + timed.length + " timed block" + (timed.length === 1 ? "" : "s") + '</span></div><div class="schedule-scroll"><div class="schedule-timeline" style="height:' + timelineHeight + 'px"><div class="schedule-hours">' + hours.join("") + '</div><div class="schedule-block-layer">' + renderNowLine(todayStr(), pxPerMinute, SCHEDULE_START_MINUTES, SCHEDULE_END_MINUTES) + (blocks || '<div class="schedule-empty-timeline">No scheduled blocks yet. Add a time or use Auto-arrange.</div>') + '</div></div></div></section>';
  }

  function layoutScheduleBlocks(tasks, startBound, endBound) {
    var startLimit = Number.isFinite(Number(startBound)) ? Number(startBound) : DAY_START_MINUTES;
    var endLimit = Number.isFinite(Number(endBound)) ? Number(endBound) : DAY_END_MINUTES;
    var items = tasks.map(function (task) {
      var rawStart = timeToMin(task.time);
      var rawEnd = rawStart + task.estMinutes;
      return {
        task: task,
        rawEnd: rawEnd,
        start: Math.max(startLimit, rawStart),
        end: Math.min(endLimit, rawEnd),
        column: 0,
        columnCount: 1
      };
    }).filter(function (item) {
      return item.end > startLimit && item.start < endLimit;
    }).sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      return a.end - b.end;
    });

    var groups = [];
    var group = [];
    var groupEnd = -1;
    items.forEach(function (item) {
      if (!group.length || item.start < groupEnd) {
        group.push(item);
        groupEnd = Math.max(groupEnd, item.end);
      } else {
        groups.push(group);
        group = [item];
        groupEnd = item.end;
      }
    });
    if (group.length) groups.push(group);

    groups.forEach(function (itemsInGroup) {
      var columnEnds = [];
      itemsInGroup.forEach(function (item) {
        var column = columnEnds.findIndex(function (end) { return end <= item.start; });
        if (column === -1) column = columnEnds.length;
        item.column = column;
        columnEnds[column] = item.end;
      });
      itemsInGroup.forEach(function (item) {
        item.columnCount = Math.max(1, columnEnds.length);
      });
    });

    return items;
  }

  function renderNowLine(dateKey, pxPerMinute, startBound, endBound) {
    if (dateKey !== todayStr()) return "";
    var startLimit = Number.isFinite(Number(startBound)) ? Number(startBound) : DAY_START_MINUTES;
    var endLimit = Number.isFinite(Number(endBound)) ? Number(endBound) : DAY_END_MINUTES;
    var now = new Date();
    var minutes = (now.getHours() * 60) + now.getMinutes();
    if (minutes < startLimit || minutes > endLimit) return "";
    var top = Math.round((minutes - startLimit) * pxPerMinute);
    return '<div class="schedule-now-line" style="top:' + top + 'px"><span>Now ' + minToTime(minutes) + '</span></div>';
  }

  function renderPendingSchedule(root, list) {
    var unscheduled = list.filter(function (task) { return !task.time; });
    var scheduled = list.filter(function (task) { return task.time; });
    root.innerHTML = '<section class="schedule-shell"><div class="schedule-head"><div><div class="eyebrow">Pending queue</div><h3>Choose what enters the day</h3></div><span>' + list.length + " open task" + (list.length === 1 ? "" : "s") + '</span></div>' + renderScheduleQueue(unscheduled, "Needs a time", "No unscheduled open tasks.") + renderScheduleQueue(scheduled, "Already placed", "No scheduled open tasks.") + '</section>';
  }

  function renderWeekSchedule(root) {
    var start = todayStr();
    var days = [];
    for (var i = 0; i < 7; i += 1) days.push(addDaysKey(start, i));
    root.innerHTML = '<section class="schedule-shell"><div class="schedule-head"><div><div class="eyebrow">Week schedule</div><h3>Next seven days</h3></div><span>Auto-arrange keeps the lane tidy</span></div><div class="schedule-week-grid">' + days.map(function (date) {
      var dayTasks = state.tasks.filter(function (task) { return task.date === date && task.status !== "completed"; }).sort(sortTasksForPlan);
      return '<article class="schedule-day-card"><div class="schedule-day-head"><strong>' + shortDayLabel(date) + '</strong><span>' + dayTasks.length + " task" + (dayTasks.length === 1 ? "" : "s") + '</span></div>' + (dayTasks.length ? dayTasks.map(renderMiniScheduleBlock).join("") : '<p>No blocks</p>') + '</article>';
    }).join("") + '</div></section>';
  }

  function renderMiniScheduleBlock(task) {
    var timing = taskTimingState(task);
    return '<button class="schedule-mini-block ' + planPriorityClass(task) + (timing ? " " + timing.id : "") + '" data-open-task="' + task.id + '"><strong>' + escapeHtml(task.title) + '</strong></button>';
  }

  function renderScheduleQueue(tasks, label, emptyText) {
    return '<div class="schedule-queue"><div class="schedule-queue-title">' + label + '</div>' + (tasks.length ? tasks.map(function (task) {
      return '<article class="schedule-queue-card ' + (taskTimingState(task) ? "has-time-alert" : "") + '"><button class="schedule-queue-main" data-open-task="' + task.id + '"><strong>' + escapeHtml(task.title) + '</strong><span>' + (task.time || "No time set") + " - " + task.estMinutes + " min - " + task.priority + '</span></button><div class="schedule-queue-actions"><button class="btn btn-ghost" data-edit-task="' + task.id + '">Edit</button>' + (task.status !== "completed" ? '<button class="btn btn-primary" data-focus-task="' + task.id + '">Focus</button>' : "") + '<button class="btn btn-ghost" data-delete-task="' + task.id + '">Delete</button></div></article>';
    }).join("") : '<div class="schedule-empty-queue">' + emptyText + '</div>') + '</div>';
  }

  function formatReadableDate(dateKey) {
    return new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  function shortDayLabel(dateKey) {
    return new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function wirePlanTaskActions(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-open-task]"), function (button) {
      button.onclick = function () { openTaskDetail(button.getAttribute("data-open-task")); };
      button.onkeydown = function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openTaskDetail(button.getAttribute("data-open-task"));
        }
      };
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-edit-task]"), function (button) {
      button.onclick = function () { openTaskModal(button.getAttribute("data-edit-task")); };
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-toggle-task]"), function (button) {
      button.onclick = function () { toggleTaskDone(button.getAttribute("data-toggle-task")); };
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-focus-task]"), function (button) {
      button.onclick = function () { startScheduledTask(button.getAttribute("data-focus-task")); };
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-delete-task]"), function (button) {
      button.onclick = function () {
        deleteTask(button.getAttribute("data-delete-task"));
      };
    });
  }

  function toggleTaskDone(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    if (task.status === "completed") {
      task.units.completed = 0;
      task.status = "pending";
      saveState();
      renderAll();
      showToast("Task reopened");
    } else {
      markTaskDoneOutsideTimer(taskId);
    }
  }

  function markTaskDoneOutsideTimer(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    var shouldAward = !task.manualDoneXpAwarded && task.status !== "completed";
    var xpAward = manualDoneXp(task);
    var prevXp = state.profile.totalXp;
    task.units.completed = task.units.total;
    task.status = "completed";
    if (shouldAward) {
      task.manualDoneXpAwarded = true;
      state.profile.totalXp += xpAward;
      state.history.unshift({
        id: makeId("manual"),
        date: todayStr(),
        completedAt: Date.now(),
        linkedTaskId: task.id,
        linkedTaskTitle: task.title,
        blocksCompleted: 0,
        blocksPlanned: 0,
        totalMinutes: task.estMinutes,
        xpEarned: xpAward,
        completedAll: true,
        manualDone: true,
        completionType: "outside_timer"
      });
      showXpFloat(xpAward);
    }
    saveState();
    renderAll();
    if (shouldAward && (detectLevelUp(prevXp, state.profile.totalXp) || detectRankUp(prevXp, state.profile.totalXp))) {
      showSystemReveal({
        xpGained: xpAward,
        prevXp: prevXp,
        newXp: state.profile.totalXp,
        leveledUp: detectLevelUp(prevXp, state.profile.totalXp),
        rankedUpId: (detectRankUp(prevXp, state.profile.totalXp) || {}).id || "",
        linkedTaskId: task.id,
        isFinalBlock: true,
        isManualDone: true,
        focusedMinutes: 0,
        penaltyXp: 0
      });
    }
    showToast(shouldAward ? "Marked done outside timer. +" + xpAward + " XP" : "Task completed");
  }

  function startOfDay(date) {
    var copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function renderRankPage() {
    renderRankConsole("rank");
    var xp = state.profile.totalXp;
    document.getElementById("rankLadder").innerHTML = RANKS.map(function (rank) {
      var status = xp >= rank.minXp ? (currentRank(xp).id === rank.id ? "current" : "reached") : "locked";
      var nextGate = nextRank(rank.minXp);
      var endLabel = nextGate ? formatNumber(nextGate.minXp - 1) + " XP" : "open ended";
      return '<div class="rank-tile ' + status + '" style="--tile-rank-color:' + rank.color + '">' +
        '<div class="letter">' + rank.id + '</div>' +
        '<div class="range">Lv ' + rank.minLevel + '+</div>' +
        '<span class="xp-gate">' + formatNumber(rank.minXp) + " XP</span>" +
        '<small>' + endLabel + '</small>' +
      '</div>';
    }).join("");
  }

  function focusMinutesByDate() {
    var byDate = Object.assign({}, state.dailyFocusMinutes || {});
    state.history.forEach(function (item) {
      if (!item || item.manualDone) return;
      var key = item.date && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date))
        ? item.date
        : localDateKey(new Date(item.completedAt || item.date || Date.now()));
      if (byDate[key]) return;
      var plannedBlocks = Math.max(1, Number(item.blocksPlanned) || 1);
      var completedBlocks = Math.max(0, Number(item.blocksCompleted) || 0);
      byDate[key] = (byDate[key] || 0) + Math.round((Number(item.totalMinutes) || 0) * Math.min(1, completedBlocks / plannedBlocks));
    });
    return byDate;
  }

  function renderAttentionLineChart(days, maxMinutes) {
    if (!days.length) return "";
    var width = 720;
    var height = 260;
    var paddingX = 42;
    var paddingTop = 28;
    var paddingBottom = 46;
    var innerW = width - (paddingX * 2);
    var innerH = height - paddingTop - paddingBottom;
    var selectedDate = selectedProgressDate || (days[days.length - 1] || {}).date;
    var selected = days.find(function (day) { return day.date === selectedDate; }) || days[days.length - 1];
    var selectedFullDate = new Date(selected.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    var points = days.map(function (day, index) {
      var x = paddingX + (days.length === 1 ? 0 : (innerW * index / (days.length - 1)));
      var y = paddingTop + innerH - ((day.minutes / Math.max(1, maxMinutes)) * innerH);
      return { x: x, y: y, day: day };
    });
    var path = points.map(function (point, index) {
      return (index ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1);
    }).join(" ");
    var area = path + " L " + points[points.length - 1].x.toFixed(1) + " " + (height - paddingBottom) + " L " + points[0].x.toFixed(1) + " " + (height - paddingBottom) + " Z";
    var grid = [0, 0.25, 0.5, 0.75, 1].map(function (ratio) {
      var y = paddingTop + innerH - (innerH * ratio);
      return '<line x1="' + paddingX + '" x2="' + (width - paddingX) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"></line>';
    }).join("");
    var labels = points.map(function (point) {
      var label = new Date(point.day.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
      return '<text x="' + point.x.toFixed(1) + '" y="' + (height - 12) + '">' + label + '</text>';
    }).join("");
    var dots = points.map(function (point) {
      return '<circle cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="' + (point.day.date === selectedDate ? "7" : "5") + '" class="' + (point.day.date === selectedDate ? "selected" : "") + '"></circle>';
    }).join("");
    var hitTargets = points.map(function (point) {
      var left = (point.x / width) * 100;
      var top = (point.y / height) * 100;
      var fullDate = new Date(point.day.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      return '<button class="progress-chart-point ' + (point.day.date === selectedDate ? "active" : "") + '" style="left:' + left.toFixed(3) + '%;top:' + top.toFixed(3) + '%" data-progress-day="' + point.day.date + '" aria-pressed="' + (point.day.date === selectedDate ? "true" : "false") + '" aria-label="' + fullDate + ": " + formatMinutesCompact(point.day.minutes) + ' focused"><span>' + formatMinutesCompact(point.day.minutes) + '</span></button>';
    }).join("");
    return '<div class="progress-attention-chart" aria-label="Seven day attention span trend">' +
      '<div class="progress-chart-head"><div><span>Selected day</span><strong>' + escapeHtml(selectedFullDate) + '</strong></div><b>' + formatMinutesCompact(selected.minutes) + ' focused</b></div>' +
      '<div class="progress-graph-stage"><svg viewBox="0 0 ' + width + " " + height + '" preserveAspectRatio="none">' +
        '<g class="progress-line-grid">' + grid + '</g>' +
        '<path class="progress-line-area" d="' + area + '"></path>' +
        '<path class="progress-line-stroke" d="' + path + '"></path>' +
        '<g class="progress-line-dots">' + dots + '</g>' +
        '<g class="progress-line-labels">' + labels + '</g>' +
      '</svg>' + hitTargets + '</div>' +
    '</div>';
  }

  function wireProgressChart(days) {
    var selected = days.find(function (day) { return day.date === selectedProgressDate; }) || days[days.length - 1];
    if (!selected) return;
    selectedProgressDate = selected.date;
    var progressRoot = document.getElementById("view-progress");
    if (!progressRoot) return;
    Array.prototype.forEach.call(progressRoot.querySelectorAll("[data-progress-day]"), function (button) {
      button.onclick = function () {
        selectedProgressDate = button.getAttribute("data-progress-day");
        renderProgress();
      };
    });
  }

  function renderProgress() {
    var days = [];
    var focusMinutes7 = 0;
    var minutesByDate = focusMinutesByDate();
    for (var i = 6; i >= 0; i -= 1) {
      var date = addDaysKey(todayStr(), -i);
      var minutes = minutesByDate[date] || 0;
      focusMinutes7 += minutes;
      days.push({ date: date, minutes: minutes });
    }
    if (!selectedProgressDate || !days.some(function (day) { return day.date === selectedProgressDate; })) {
      selectedProgressDate = (days[days.length - 1] || {}).date || "";
    }
    document.getElementById("statStreak").textContent = state.profile.streak;
    document.getElementById("statFocus7").textContent = formatMinutesCompact(focusMinutes7);
    var doneTasks = state.tasks.filter(function (task) { return task.status === "completed"; }).length;
    document.getElementById("statCompletion").textContent = state.tasks.length ? Math.round((doneTasks / state.tasks.length) * 100) + "%" : "0%";
    var max = Math.max(state.profile.dailyGoalMinutes || 60, Math.max.apply(null, days.map(function (day) { return day.minutes; })), 1);
    document.getElementById("progressChart").innerHTML = renderAttentionLineChart(days, max);
    var historyXp = state.history.reduce(function (sum, item) { return sum + (item.xpEarned || 0); }, 0);
    var latest = state.attentionTests[state.attentionTests.length - 1] || null;
    var baselineDelta = latest && state.baselineScore !== null ? latest.score - state.baselineScore : null;
    var best = state.attentionTests.length ? Math.max.apply(null, state.attentionTests.map(function (test) { return test.score; })) : null;
    document.getElementById("progressTaskSummary").innerHTML =
      '<div class="progress-summary-line">' + state.history.length + " logs saved - " + formatMinutesCompact(focusMinutes7) + " focused this week - " + formatNumber(historyXp) + " XP earned - " + doneTasks + " of " + state.tasks.length + " tasks fully completed.</div>" +
      '<section class="baseline-card">' +
        '<div class="baseline-card-head">' +
          '<div><div class="attention-kicker">Attention baseline</div><h3>' + (latest ? latest.score + '/100 latest score' : 'Measure your starting point') + '</h3>' +
          '<p>A short selective-attention check gives DeeCadence another signal besides XP: whether your focus control is improving over time.</p></div>' +
          '<button class="btn btn-primary" type="button" id="runAttentionTestBtn">' + (latest ? "Run again" : "Start baseline") + '</button>' +
        '</div>' +
        '<div class="baseline-metrics">' +
          '<div><span>Starting score</span><strong>' + (state.baselineScore == null ? "-" : state.baselineScore) + '</strong></div>' +
          '<div><span>Latest score</span><strong>' + (latest ? latest.score : "-") + '</strong></div>' +
          '<div><span>From baseline</span><strong>' + (baselineDelta == null ? "-" : (baselineDelta >= 0 ? "+" : "") + baselineDelta) + '</strong></div>' +
          '<div><span>Reference</span><strong>' + REFERENCE_BENCHMARK.score + '</strong></div>' +
          '<div><span>Personal best</span><strong>' + (best == null ? "-" : best) + '</strong></div>' +
        '</div>' +
        '<p class="benchmark-disclaimer">This is a product benchmark, not a diagnosis. Repeat it under similar conditions to make the trend useful.</p>' +
      '</section>';
    wireProgressChart(days);
    var runBaseline = document.getElementById("runAttentionTestBtn");
    if (runBaseline) runBaseline.onclick = openAttentionTest;
  }

  function renderFeedbackSummary(item) {
    var feedback = Array.isArray(item.blockFeedback) ? item.blockFeedback.filter(Boolean) : [];
    if (!feedback.length) return "";
    var summary = feedback.map(function (entry) {
      var label = entry.feeling || entry.note || "Noted";
      var note = entry.note && entry.note !== entry.feeling ? " - " + entry.note : "";
      return "B" + (entry.blockNumber || (entry.blockIndex + 1)) + ": " + label + note;
    }).join(" | ");
    return '<div class="history-feedback">' + escapeHtml(summary) + "</div>";
  }

  function renderHistory() {
    var root = document.getElementById("historyList");
    if (!state.history.length) {
      root.innerHTML = '<div class="empty-state">No sessions yet. Your first block will show up here.</div>';
      return;
    }
    root.innerHTML = state.history.map(function (item) {
      var date = new Date(item.completedAt || item.date || Date.now());
      var icon = item.manualDone ? "Done" : item.blocksCompleted + "/" + item.blocksPlanned;
      var subtitle = item.manualDone ? "Completed outside timer" : item.totalMinutes + " min planned";
      return '<div class="history-item"><div class="history-icon">' + icon + '</div><div class="history-main"><div class="history-title">' + (item.linkedTaskTitle ? escapeHtml(item.linkedTaskTitle) : "Free focus") + '</div><div class="history-sub">' + date.toLocaleDateString() + " - " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " - " + subtitle + '</div>' + renderFeedbackSummary(item) + '</div><div class="history-xp">+' + item.xpEarned + " XP</div></div>";
    }).join("");
  }

  function renderSettings() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-choice]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-theme-choice") === state.settings.theme);
    });
    document.getElementById("soundSwitch").classList.toggle("on", state.settings.sound);
    document.getElementById("soundSwitch").setAttribute("aria-pressed", String(state.settings.sound));
    document.getElementById("motionSwitch").classList.toggle("on", state.settings.reducedMotion);
    document.getElementById("motionSwitch").setAttribute("aria-pressed", String(state.settings.reducedMotion));
    document.getElementById("dailyGoalSelect").value = String(state.profile.dailyGoalMinutes || 60);
    updateFeedbackDeliveryCopy();
    updateFeedbackBadge();
  }

  var CONTEXT_TIPS = {
    today: {
      eyebrow: "First encounter",
      title: "Today is your command center.",
      body: "Pick the next protected block, see your current rank, and keep the day simple."
    },
    focus: {
      eyebrow: "Block logic",
      title: "One block can be paused without losing progress.",
      body: "Continue saved sessions from here. XP is based on protected minutes, not just opening the timer."
    },
    plan: {
      eyebrow: "Schedule vs tasks",
      title: "Schedule is time. Tasks is control.",
      body: "Use Schedule to see the day. Use Tasks to edit, mark done, or start a focus session quickly."
    },
    rank: {
      eyebrow: "Rank meaning",
      title: "Ranks are long-term attention gates.",
      body: "E starts the climb. A, S, SS, SSS, and L require much larger XP totals, so short scattered focus cannot fake mastery."
    },
    progress: {
      eyebrow: "Attention evidence",
      title: "Progress combines minutes and attention checks.",
      body: "The graph shows protected time. The baseline check gives a second signal: selective attention control."
    },
    settings: {
      eyebrow: "Data safety",
      title: "Export before testing heavily.",
      body: "Backups preserve tasks, history, XP, settings, attention checks, and feedback queue on this device."
    }
  };

  function renderContextTip(viewName) {
    var view = document.getElementById("view-" + viewName);
    var tip = CONTEXT_TIPS[viewName];
    if (!view || !tip) return;
    var existing = view.querySelector(".context-tip");
    if (state.dismissedContextTips && state.dismissedContextTips[viewName]) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (!existing) {
      existing = document.createElement("div");
      existing.className = "context-tip";
      var topbar = view.querySelector(".topbar");
      if (topbar && topbar.parentNode) topbar.parentNode.insertBefore(existing, topbar.nextSibling);
    }
    existing.innerHTML = '<div><div class="attention-kicker">' + escapeHtml(tip.eyebrow) + '</div><strong>' + escapeHtml(tip.title) + '</strong><p>' + escapeHtml(tip.body) + '</p></div><button type="button" class="icon-btn" data-dismiss-context="' + viewName + '" aria-label="Dismiss tip">x</button>';
    var dismiss = existing.querySelector("[data-dismiss-context]");
    if (dismiss) dismiss.onclick = function () {
      state.dismissedContextTips[viewName] = true;
      saveState();
      renderContextTip(viewName);
    };
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.settings.theme);
    document.body.setAttribute("data-theme", state.settings.theme);
    document.documentElement.setAttribute("data-reduced-motion", String(state.settings.reducedMotion));
    document.body.setAttribute("data-reduced-motion", String(state.settings.reducedMotion));
  }

  function renderSessionIndicators() {
    var active = Boolean(state.session || state.savedSessions.length);
    ["navFocusDot", "bottomNavFocusDot"].forEach(function (id) {
      var dot = document.getElementById(id);
      if (dot) dot.style.display = active ? "inline-block" : "none";
    });
  }

  function renderAll() {
    renderToday();
    renderFocus();
    renderPlan();
    renderRankPage();
    renderProgress();
    renderHistory();
    renderSettings();
    applyTheme();
    renderSessionIndicators();
    renderContextTip(activeView);
  }

  function switchView(name) {
    activeView = name;
    Array.prototype.forEach.call(document.querySelectorAll(".view"), function (view) {
      view.classList.toggle("active", view.id === "view-" + name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".navbtn, .bottomnav button"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-view") === name);
    });
    if (name === "today") renderToday();
    if (name === "focus") renderFocus();
    if (name === "plan") renderPlan();
    if (name === "rank") renderRankPage();
    if (name === "progress") renderProgress();
    if (name === "history") renderHistory();
    if (name === "settings") renderSettings();
    renderContextTip(name);
  }

  function openWelcome(force) {
    if (!welcomeOverlay || (!force && state.settings.welcomeComplete)) return false;
    welcomeOverlay.classList.add("open");
    welcomeOverlay.setAttribute("aria-hidden", "false");
    var first = document.getElementById("welcomeCritical1");
    if (first) first.focus();
    return true;
  }

  function closeWelcome(markComplete) {
    if (!welcomeOverlay) return;
    welcomeOverlay.classList.remove("open");
    welcomeOverlay.setAttribute("aria-hidden", "true");
    if (markComplete) {
      state.settings.welcomeComplete = true;
      saveState();
    }
  }

  function welcomeInputValue(id) {
    return String((document.getElementById(id) || {}).value || "").trim().replace(/\s+/g, " ");
  }

  function saveWelcomeSetup() {
    var created = [];
    [
      { id: "welcomeCritical1", priority: "high" },
      { id: "welcomeCritical2", priority: "high" },
      { id: "welcomeCritical3", priority: "high" },
      { id: "welcomeNormal1", priority: "medium" },
      { id: "welcomeNormal2", priority: "medium" },
      { id: "welcomeNormal3", priority: "medium" }
    ].forEach(function (slot) {
      var title = welcomeInputValue(slot.id);
      if (!title) return;
      created.push(normalizeTask({
        title: title,
        date: todayStr(),
        priority: slot.priority,
        estMinutes: slot.priority === "high" ? 45 : 25,
        units: slot.priority === "high" ? 3 : 1,
        flex: "flexible",
        notes: slot.priority === "high" ? "Non-negotiable attention task" : "Normal task from welcome setup"
      }));
    });
    if (!created.length) {
      showToast("Add at least one task, or set up later.");
      return;
    }
    state.tasks = created.concat(state.tasks);
    closeWelcome(true);
    saveState();
    renderAll();
    switchView("plan");
    showToast(created.length + " task" + (created.length === 1 ? "" : "s") + " added. Start with one block.");
    startTour(false);
  }

  function clearTourHighlight() {
    Array.prototype.forEach.call(document.querySelectorAll(".tour-highlight"), function (element) {
      element.classList.remove("tour-highlight");
    });
  }

  function startTour(force) {
    if (!force && state.settings.tutorialComplete) return;
    if (tourActive) return;
    tourPreviousView = activeView || "today";
    tourActive = true;
    tourIndex = 0;
    renderTourStep();
  }

  function endTour(completed) {
    tourActive = false;
    clearTourHighlight();
    tourOverlay.classList.remove("open");
    tourOverlay.setAttribute("aria-hidden", "true");
    if (taskModal.classList.contains("open")) closeTaskModal();
    if (startModal.classList.contains("open")) startModal.classList.remove("open");
    if (taskDetailModal.classList.contains("open")) closeTaskDetail();
    if (completed) {
      state.settings.tutorialComplete = true;
      saveState();
    }
    if (tourPreviousView && activeView !== tourPreviousView) switchView(tourPreviousView);
  }

  function renderTourStep() {
    if (!tourActive) return;
    var step = TOUR_STEPS[tourIndex];
    if (!step) {
      endTour(true);
      return;
    }
    if (activeView !== step.view) switchView(step.view);
    prepareTourStep(step);
    clearTourHighlight();
    tourOverlay.classList.add("open");
    tourOverlay.setAttribute("aria-hidden", "false");
    document.getElementById("tourCount").textContent = "Step " + (tourIndex + 1) + " of " + TOUR_STEPS.length;
    document.getElementById("tourCoachStatus").textContent = step.coach || "Practice run";
    document.getElementById("tourTitle").textContent = step.title;
    document.getElementById("tourBody").textContent = step.body;
    document.getElementById("tourBackBtn").disabled = tourIndex === 0;
    document.getElementById("tourNextBtn").textContent = tourIndex === TOUR_STEPS.length - 1 ? "Finish" : "Next";
    setTimeout(function () {
      positionTourCard(step);
    }, 80);
  }

  function prepareTourStep(step) {
    if (step.setup === "taskModal") {
      if (!taskModal.classList.contains("open")) openTaskModal();
      return;
    }
    if (step.setup === "closeModals" || taskModal.classList.contains("open")) closeTaskModal();
    if (startModal.classList.contains("open")) startModal.classList.remove("open");
    if (taskDetailModal.classList.contains("open")) closeTaskDetail();
  }

  function positionTourCard(step) {
    var target = document.querySelector(step.target);
    var card = document.getElementById("tourCard");
    if (!target || !card) return;
    target.classList.add("tour-highlight");
    target.scrollIntoView({ behavior: state.settings.reducedMotion ? "auto" : "smooth", block: "center", inline: "center" });
    setTimeout(function () {
      var rect = target.getBoundingClientRect();
      var cardRect = card.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      if (vw <= 640) {
        card.style.top = "";
        card.style.left = "";
        return;
      }
      var sideGap = 18;
      var top = Math.max(16, Math.min(rect.top, vh - cardRect.height - 16));
      var left = rect.right + sideGap;
      if (left + cardRect.width > vw - 16 && rect.left - cardRect.width - sideGap > 16) {
        left = rect.left - cardRect.width - sideGap;
      }
      if (left + cardRect.width > vw - 16) {
        left = Math.min(Math.max(16, rect.left), vw - cardRect.width - 16);
        top = rect.bottom + sideGap;
        if (top + cardRect.height > vh - 16) top = rect.top - cardRect.height - sideGap;
      }
      if (top < 16) top = Math.max(16, vh - cardRect.height - 16);
      if (left < 16) left = 16;
      card.style.top = Math.round(top) + "px";
      card.style.left = Math.round(left) + "px";
    }, state.settings.reducedMotion ? 0 : 220);
  }

  function nextTourStep() {
    if (tourIndex >= TOUR_STEPS.length - 1) {
      endTour(true);
      return;
    }
    tourIndex += 1;
    renderTourStep();
  }

  function previousTourStep() {
    if (tourIndex <= 0) return;
    tourIndex -= 1;
    renderTourStep();
  }

  function populateLinkTaskSelect(selectedId) {
    var select = document.getElementById("linkTaskSelect");
    var openTasks = scheduledFocusTasks();
    select.innerHTML = openTasks.length ? openTasks.map(function (task) {
      var meta = (task.time || "Unscheduled") + " - " + task.estMinutes + " min";
      return '<option value="' + task.id + '"' + (task.id === selectedId ? " selected" : "") + ">" + escapeHtml(task.title) + " (" + meta + ")</option>";
    }).join("") : '<option value="">No scheduled tasks yet</option>';
    if (selectedId && !getTask(selectedId)) select.value = "";
  }

  function scheduledFocusTasks() {
    return state.tasks
      .filter(function (task) { return task.status !== "completed"; })
      .sort(function (a, b) {
        var dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
        if (dateCompare) return dateCompare;
        return (a.time ? timeToMin(a.time) : 9999) - (b.time ? timeToMin(b.time) : 9999);
      });
  }

  function syncStartTaskSource(source) {
    startTaskSource = source === "input" ? "input" : "schedule";
    Array.prototype.forEach.call(document.querySelectorAll("[data-start-source]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-start-source") === startTaskSource);
    });
    document.getElementById("scheduleTaskField").style.display = startTaskSource === "schedule" ? "flex" : "none";
    document.getElementById("inputTaskField").style.display = startTaskSource === "input" ? "flex" : "none";
    document.getElementById("startTaskSourceHint").textContent = startTaskSource === "schedule"
      ? "Pick a task already on your schedule."
      : "Name the task you want this focus session to move forward.";
    if (startTaskSource === "input") {
      syncBlockCountButtons(4, "Input sessions can use any block count. Four gives the full focus rhythm.");
      document.getElementById("inputTaskTitle").focus();
    }
  }

  function createInputFocusTask(title, minutes) {
    var cleanTitle = String(title || "").trim().replace(/\s+/g, " ");
    if (!cleanTitle) return null;
    var task = normalizeTask({
      title: cleanTitle,
      date: todayStr(),
      time: null,
      flex: "flexible",
      estMinutes: clampMinutes(minutes, 25),
      priority: "medium",
      units: 4,
      notes: "Created from Focus input"
    });
    state.tasks.push(task);
    return task;
  }

  function resolveStartTaskId(minutes) {
    if (startTaskSource === "input") {
      var input = document.getElementById("inputTaskTitle");
      var task = createInputFocusTask(input.value, minutes);
      if (!task) {
        input.focus();
        showToast("Type the task title first.");
        return null;
      }
      return task.id;
    }
    var selectedTaskId = document.getElementById("linkTaskSelect").value;
    if (!selectedTaskId || !getTask(selectedTaskId)) {
      document.getElementById("linkTaskSelect").focus();
      showToast("Choose a scheduled task, or switch to Input.");
      return null;
    }
    return selectedTaskId;
  }

  function suggestedBlockCount(task) {
    if (task && task.units) {
      return clampBlockCount(Math.max(1, task.units.total - task.units.completed), 4);
    }
    var todaysOpen = state.tasks.filter(function (item) {
      return item.date === todayStr() && item.status !== "completed";
    }).length;
    return clampBlockCount(todaysOpen || 4, 4);
  }

  function syncBlockCountButtons(count, reason) {
    chosenBlockCount = clampBlockCount(count, 4);
    Array.prototype.forEach.call(document.querySelectorAll("[data-block-count]"), function (button) {
      button.classList.toggle("active", parseInt(button.getAttribute("data-block-count"), 10) === chosenBlockCount);
    });
    var hint = document.getElementById("blockCountHint");
    if (hint) {
      hint.textContent = reason || "Pick based on how much of your plan this session should move.";
    }
  }

  function syncDurationButtons(minutes) {
    var matched = false;
    Array.prototype.forEach.call(document.querySelectorAll(".duration-opt"), function (button) {
      var value = button.getAttribute("data-min");
      var isMatch = String(minutes) === value;
      if (isMatch) matched = true;
      button.classList.toggle("active", isMatch);
    });
    if (!matched) {
      document.querySelector('.duration-opt[data-min="custom"]').classList.add("active");
      document.getElementById("customMinWrap").style.display = "flex";
      document.getElementById("customMinInput").value = String(minutes);
    } else {
      document.getElementById("customMinWrap").style.display = "none";
    }
    chosenMinutes = minutes;
  }

  function openStartModal(task) {
    if (state.session) {
      switchView("focus");
      renderFocus();
      if (state.session.status === "paused") showToast("Paused block is waiting. Continue it from Focus.");
      else if (state.session.status === "recovery") showToast("Current block is saved. Continue from the recovery screen.");
      else showToast("A focus block is already running.");
      return;
    }
    pendingStartTask = task || null;
    var minutes = task ? task.estMinutes : chosenMinutes;
    syncDurationButtons(minutes);
    syncBlockCountButtons(suggestedBlockCount(task), task ? "Suggested from this task's remaining pieces. You can change it." : "Suggested from today's open plan. You can change it.");
    populateLinkTaskSelect(task ? task.id : "");
    document.getElementById("inputTaskTitle").value = "";
    syncStartTaskSource(task || scheduledFocusTasks().length ? "schedule" : "input");
    document.getElementById("startModalSub").textContent = task ? 'For "' + task.title + '". Choose length and blocks.' : "Choose length, blocks, then choose from Schedule or type a task title.";
    startModal.classList.add("open");
  }

  function startScheduledTask(taskId) {
    var task = getTask(taskId);
    if (task) openStartModal(task);
  }

  function openTaskModal(taskOrId) {
    var task = typeof taskOrId === "string" ? getTask(taskOrId) : (taskOrId && taskOrId.id ? taskOrId : null);
    editingTaskId = task ? task.id : null;
    selectedProgressType = "countable";
    document.getElementById("taskModalTitle").textContent = task ? "Edit task" : "Add task";
    document.getElementById("taskModalConfirm").textContent = task ? "Save changes" : "Save task";
    document.getElementById("taskTitleInput").value = task ? task.title : "";
    document.getElementById("taskDateInput").value = task ? task.date : todayStr();
    document.getElementById("taskTimeInput").value = task && task.time ? task.time : "";
    document.getElementById("taskDurationInput").value = task ? task.estMinutes : "50";
    document.getElementById("taskPriorityInput").value = task ? task.priority : "medium";
    document.getElementById("taskUnitsInput").value = task ? task.units.total : "4";
    document.getElementById("taskFlexInput").value = task ? task.flex : "flexible";
    document.getElementById("taskNotesInput").value = task ? task.notes : "";
    syncProgressTypeButtons();
    taskModal.classList.add("open");
    document.getElementById("taskTitleInput").focus();
  }

  function closeTaskModal() {
    editingTaskId = null;
    taskModal.classList.remove("open");
  }

  function openTaskDetail(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    activeDetailTaskId = task.id;
    var timing = taskTimingState(task);
    document.getElementById("taskDetailBody").innerHTML =
      '<div class="task-detail-head">' +
        '<div><div class="eyebrow">Task</div><h3 id="taskDetailTitle">' + escapeHtml(task.title) + '</h3></div>' +
        (timing ? '<span class="timing-badge ' + timing.id + '">' + timing.label + '</span>' : "") +
      '</div>' +
      '<div class="task-detail-grid">' +
        '<div><span>Date</span><strong>' + formatReadableDate(task.date) + '</strong></div>' +
        '<div><span>Time</span><strong>' + (task.time || "Unscheduled") + '</strong></div>' +
        '<div><span>Duration</span><strong>' + task.estMinutes + ' min</strong></div>' +
        '<div><span>Progress</span><strong>' + task.units.completed + "/" + task.units.total + ' units</strong></div>' +
      '</div>' +
      '<div class="task-detail-notes"><span>Description</span><p>' + (task.notes ? escapeHtml(task.notes) : "No description yet.") + '</p></div>' +
      renderTaskUnitRail(task);
    document.getElementById("taskDetailDone").style.display = task.status === "completed" ? "none" : "inline-flex";
    document.getElementById("taskDetailFocus").style.display = task.status === "completed" ? "none" : "inline-flex";
    taskDetailModal.classList.add("open");
  }

  function closeTaskDetail() {
    activeDetailTaskId = null;
    taskDetailModal.classList.remove("open");
  }

  function syncProgressTypeButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-progress-type]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-progress-type") === selectedProgressType);
    });
    var isOngoing = selectedProgressType === "ongoing";
    document.getElementById("taskUnitsFieldWrap").style.display = isOngoing ? "none" : "flex";
    document.getElementById("progressTypeHint").textContent = isOngoing
      ? "Use this when the goal is simply to spend focused time on the task."
      : "Use this when the task has clear pieces, like 4 pages or 3 messages.";
  }

  function wireEvents() {
    document.getElementById("welcomeSaveBtn").onclick = saveWelcomeSetup;
    document.getElementById("welcomeSkipBtn").onclick = function () {
      closeWelcome(true);
      startTour(false);
    };
    document.getElementById("startNextBlockBtn").onclick = function () {
      if (state.savedSessions.length && !state.session) {
        switchView("focus");
        return;
      }
      openStartModal(nextTask());
    };
    document.getElementById("startModalCancel").onclick = function () { startModal.classList.remove("open"); };
    document.getElementById("startModalConfirm").onclick = function () {
      var minutes = document.querySelector('.duration-opt[data-min="custom"]').classList.contains("active")
        ? clampMinutes(document.getElementById("customMinInput").value, 20)
        : chosenMinutes;
      var selectedTaskId = resolveStartTaskId(clampMinutes(minutes, 25));
      if (!selectedTaskId) return;
      startModal.classList.remove("open");
      beginSession(clampMinutes(minutes, 25), selectedTaskId, chosenBlockCount);
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-start-source]"), function (button) {
      button.onclick = function () {
        syncStartTaskSource(button.getAttribute("data-start-source"));
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll(".duration-opt"), function (button) {
      button.onclick = function () {
        Array.prototype.forEach.call(document.querySelectorAll(".duration-opt"), function (item) { item.classList.remove("active"); });
        button.classList.add("active");
        var value = button.getAttribute("data-min");
        document.getElementById("customMinWrap").style.display = value === "custom" ? "flex" : "none";
        chosenMinutes = value === "custom" ? clampMinutes(document.getElementById("customMinInput").value, 20) : clampMinutes(value, 25);
      };
    });
    document.getElementById("customMinInput").oninput = function () {
      chosenMinutes = clampMinutes(this.value, 20);
    };
    document.getElementById("linkTaskSelect").onchange = function () {
      var task = getTask(this.value);
      syncBlockCountButtons(suggestedBlockCount(task), task ? "Suggested from this task's remaining pieces. You can change it." : "Pick based on how much of your plan this session should move.");
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-block-count]"), function (button) {
      button.onclick = function () {
        syncBlockCountButtons(button.getAttribute("data-block-count"));
      };
    });
    document.getElementById("addTaskBtn").onclick = function () { openTaskModal(); };
    document.getElementById("taskModalCancel").onclick = function () {
      closeTaskModal();
    };
    document.getElementById("taskModalConfirm").onclick = function () {
      var title = document.getElementById("taskTitleInput").value.trim();
      if (!title) {
        document.getElementById("taskTitleInput").focus();
        return;
      }
      var existingTask = editingTaskId ? getTask(editingTaskId) : null;
      var task = normalizeTask({
        id: existingTask ? existingTask.id : null,
        title: title,
        date: document.getElementById("taskDateInput").value || todayStr(),
        time: document.getElementById("taskTimeInput").value || null,
        flex: document.getElementById("taskFlexInput").value,
        estMinutes: clampMinutes(document.getElementById("taskDurationInput").value, 50),
        priority: document.getElementById("taskPriorityInput").value,
        units: selectedProgressType === "ongoing" ? 4 : document.getElementById("taskUnitsInput").value,
        completedUnits: existingTask ? existingTask.units.completed : 0,
        status: existingTask ? existingTask.status : "pending",
        manualDoneXpAwarded: existingTask ? existingTask.manualDoneXpAwarded : false,
        notes: document.getElementById("taskNotesInput").value
      });
      if (existingTask) {
        var index = state.tasks.findIndex(function (item) { return item.id === existingTask.id; });
        if (index > -1) state.tasks[index] = task;
      } else {
        state.tasks.push(task);
      }
      saveState();
      closeTaskModal();
      renderAll();
      showToast(existingTask ? "Task updated" : "Task added");
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-progress-type]"), function (button) {
      button.onclick = function () {
        selectedProgressType = button.getAttribute("data-progress-type");
        syncProgressTypeButtons();
      };
    });
    document.getElementById("taskDetailClose").onclick = closeTaskDetail;
    document.getElementById("taskDetailDone").onclick = function () {
      var taskId = activeDetailTaskId;
      closeTaskDetail();
      if (taskId) markTaskDoneOutsideTimer(taskId);
    };
    document.getElementById("taskDetailFocus").onclick = function () {
      var taskId = activeDetailTaskId;
      closeTaskDetail();
      if (taskId) startScheduledTask(taskId);
    };
    document.getElementById("taskDetailEdit").onclick = function () {
      var task = activeDetailTaskId ? getTask(activeDetailTaskId) : null;
      closeTaskDetail();
      if (task) openTaskModal(task);
    };
    document.getElementById("taskDetailDelete").onclick = function () {
      var taskId = activeDetailTaskId;
      closeTaskDetail();
      if (taskId) deleteTask(taskId);
    };
    document.getElementById("tourNextBtn").onclick = nextTourStep;
    document.getElementById("tourBackBtn").onclick = previousTourStep;
    document.getElementById("tourSkipBtn").onclick = function () { endTour(true); };
    document.getElementById("replayTourBtn").onclick = function () { startTour(true); };
    [welcomeOverlay, startModal, taskModal, taskDetailModal, feedbackModal, attentionTestModal].forEach(function (overlay) {
      if (!overlay) return;
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay) {
          if (overlay === welcomeOverlay) {
            closeWelcome(true);
            startTour(false);
            return;
          }
          if (overlay === feedbackModal) {
            closeFeedback();
            return;
          }
          if (overlay === attentionTestModal) {
            closeAttentionTest();
            return;
          }
          overlay.classList.remove("open");
          if (overlay === taskModal) closeTaskModal();
          if (overlay === taskDetailModal) activeDetailTaskId = null;
        }
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".navbtn, .bottomnav button"), function (button) {
      button.addEventListener("click", function () { switchView(button.getAttribute("data-view")); });
    });
    document.getElementById("autoArrangeBtnToday").onclick = function () {
      autoArrangeSchedule();
      renderAll();
      showToast("Plan arranged");
    };
    document.getElementById("autoArrangeBtnPlan").onclick = function () {
      autoArrangeSchedule();
      renderAll();
      showToast("Plan arranged");
    };
    Array.prototype.forEach.call(document.querySelectorAll(".tab[data-planview]"), function (tab) {
      tab.onclick = function () {
        Array.prototype.forEach.call(document.querySelectorAll(".tab[data-planview]"), function (item) { item.classList.remove("active"); });
        tab.classList.add("active");
        currentPlanTab = tab.getAttribute("data-planview");
        renderPlan();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-plan-mode]"), function (button) {
      button.onclick = function () {
        currentPlanMode = button.getAttribute("data-plan-mode");
        renderPlan();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-choice]"), function (button) {
      button.onclick = function () {
        state.settings.theme = button.getAttribute("data-theme-choice");
        saveState();
        renderSettings();
        applyTheme();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll(".theme-toggle"), function (button) {
      button.onclick = function () {
        state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
        saveState();
        renderSettings();
        applyTheme();
      };
    });
    document.getElementById("soundSwitch").onclick = function () {
      state.settings.sound = !state.settings.sound;
      state.settings.soundPreferenceTouched = true;
      if (state.settings.sound) {
        primeSounds();
        playSound("blockComplete");
        showToast("Sound on");
      } else {
        showToast("Sound off");
      }
      saveState();
      renderSettings();
    };
    document.getElementById("motionSwitch").onclick = function () {
      state.settings.reducedMotion = !state.settings.reducedMotion;
      saveState();
      renderSettings();
      applyTheme();
    };
    document.getElementById("dailyGoalSelect").onchange = function () {
      state.profile.dailyGoalMinutes = Math.max(15, parseInt(this.value, 10) || 60);
      saveState();
      renderProgress();
    };
    document.getElementById("exportBackupBtn").onclick = exportBackup;
    document.getElementById("importBackupBtn").onclick = function () { document.getElementById("importBackupInput").click(); };
    document.getElementById("importBackupInput").onchange = importBackup;
    document.getElementById("feedbackFab").onclick = openFeedback;
    document.getElementById("openFeedbackSettingsBtn").onclick = openFeedback;
    document.getElementById("feedbackCloseBtn").onclick = closeFeedback;
    document.getElementById("feedbackCancelBtn").onclick = closeFeedback;
    document.getElementById("feedbackSubmitBtn").onclick = submitFeedback;
    document.getElementById("feedbackMessageInput").oninput = function () {
      document.getElementById("feedbackCharCount").textContent = String(this.value.length);
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-type]"), function (button) {
      button.onclick = function () {
        feedbackType = button.getAttribute("data-feedback-type") || "Other";
        Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-type]"), function (item) {
          item.classList.toggle("active", item === button);
        });
      };
    });
    document.getElementById("resetDataBtn").onclick = function () {
      if (confirm("This clears all rank progress, tasks, and history on this device. Continue?")) {
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        saveState();
        renderAll();
        switchView("today");
        showToast("Data reset");
      }
    };
    document.getElementById("exportHistoryBtn").onclick = function () {
      var rows = ["date,linked_task,blocks_completed,blocks_planned,minutes,xp_earned"];
      state.history.forEach(function (item) {
        rows.push([item.date, item.linkedTaskTitle || "Free focus", item.blocksCompleted, item.blocksPlanned, item.totalMinutes, item.xpEarned].map(csvCell).join(","));
      });
      var blob = new Blob([rows.join("\n")], { type: "text/csv" });
      var anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = "deecadence-history.csv";
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    };
  }

  function handleVisibilityChange() {
    if (!state.session) return;
    if (syncSessionClock()) return;
    saveState();
    renderAll();
  }

  function handleStorageChange(event) {
    if (event.key !== STORAGE_KEY || state.session) return;
    state = loadState();
    renderAll();
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      if (feedbackModal && feedbackModal.classList.contains("open")) closeFeedback();
      if (attentionTestModal && attentionTestModal.classList.contains("open")) closeAttentionTest();
    }
    if (event.code === "Space" && attentionRuntime && attentionRuntime.running && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes((document.activeElement || {}).tagName)) {
      event.preventDefault();
      registerAttentionTap();
    }
  }

  window.__DEECADENCE_DEBUG__ = {
    cumulativeXpForLevel: cumulativeXpForLevel,
    xpNeededForLevel: xpNeededForLevel,
    focusXpForSeconds: focusXpForSeconds,
    manualDoneXp: manualDoneXp,
    focusMinutesByDate: focusMinutesByDate,
    currentLevel: currentLevel,
    currentRank: currentRank,
    ranks: RANKS,
    splitIntoBlocks: splitIntoBlocks,
    clampMinutes: clampMinutes,
    clampBlockCount: clampBlockCount,
    localDateKey: localDateKey,
    beginSession: beginSession,
    pauseSession: pauseSession,
    resumeSession: resumeSession,
    continueSavedSession: continueSavedSession,
    finalizeSession: finalizeSession,
    createInputFocusTask: createInputFocusTask,
    scheduledFocusTasks: scheduledFocusTasks,
    tick: tick,
    deleteTask: deleteTask,
    markTaskDoneOutsideTimer: markTaskDoneOutsideTimer,
    csvCell: csvCell,
    taskTimingState: taskTimingState,
    layoutScheduleBlocks: layoutScheduleBlocks,
    renderNowLine: renderNowLine,
    openWelcome: openWelcome,
    closeWelcome: closeWelcome,
    saveWelcomeSetup: saveWelcomeSetup,
    startTour: startTour,
    endTour: endTour,
    getTourState: function () { return { active: tourActive, index: tourIndex }; },
    getState: function () { return state; }
  };

  wireEvents();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("online", retryFeedbackOutbox);
  window.addEventListener("resize", function () {
    if (tourActive) positionTourCard(TOUR_STEPS[tourIndex]);
  });
  renderAll();
  switchView("today");
  if (state.settings.sound) primeSounds();
  setTimeout(function () {
    if (!openWelcome(false)) startTour(false);
  }, 450);
  setInterval(function () {
    if (activeView === "today") renderToday();
    if (activeView === "plan" && currentPlanMode === "schedule" && currentPlanTab === "day") renderPlan();
  }, 60000);
  if (state.session && state.session.status === "running") startTicker();
  document.body.classList.add("booted");
})();
