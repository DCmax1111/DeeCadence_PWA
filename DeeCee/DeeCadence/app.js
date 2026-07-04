(function () {
  "use strict";

  var STORAGE_KEY = "deecadence_state_v2";
  var XP_PER_BLOCK = 20;
  var XP_SESSION_BONUS = 10;
  var RECOVERY_SECONDS = 60;
  var MAX_CUSTOM_MINUTES = 240;
  var MIN_CUSTOM_MINUTES = 4;
  var DAY_START_MINUTES = 8 * 60;
  var DAY_END_MINUTES = 20 * 60;

  var LEVEL_ANCHORS = [
    { level: 1, xp: 0, curve: 1.28 },
    { level: 70, xp: 49999, curve: 1.18 },
    { level: 100, xp: 109109, curve: 1.34 },
    { level: 290, xp: 999999, curve: 1.45 }
  ];
  var xpLevelCache = Object.create(null);

  function cumulativeXpForLevel(level) {
    var target = Math.max(1, Math.floor(Number(level) || 1));
    if (xpLevelCache[target] != null) return xpLevelCache[target];
    if (target <= LEVEL_ANCHORS[0].level) return 0;

    for (var i = 1; i < LEVEL_ANCHORS.length; i += 1) {
      var start = LEVEL_ANCHORS[i - 1];
      var end = LEVEL_ANCHORS[i];
      if (target <= end.level) {
        var span = end.level - start.level;
        var ratio = (target - start.level) / span;
        var eased = Math.pow(ratio, end.curve);
        xpLevelCache[target] = Math.round(start.xp + ((end.xp - start.xp) * eased));
        return xpLevelCache[target];
      }
    }

    var postLevels = target - 290;
    xpLevelCache[target] = 999999 + Math.round((9000 * postLevels) + (65 * Math.pow(postLevels, 2)));
    return xpLevelCache[target];
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

  var RANKS = [
    { id: "E", name: "E-Rank", minLevel: 1, minXp: 0, desc: "Learning consistency", color: "var(--rank-E)" },
    { id: "D", name: "D-Rank", minLevel: 5, minXp: cumulativeXpForLevel(5), desc: "Completing blocks reliably", color: "var(--rank-D)" },
    { id: "C", name: "C-Rank", minLevel: 25, minXp: cumulativeXpForLevel(25), desc: "Protecting attention daily", color: "var(--rank-C)" },
    { id: "B", name: "B-Rank", minLevel: 45, minXp: cumulativeXpForLevel(45), desc: "Repeatable deep work", color: "var(--rank-B)" },
    { id: "A", name: "A-Rank", minLevel: 70, minXp: 49999, desc: "Highly consistent", color: "var(--rank-A)" },
    { id: "S", name: "S-Rank", minLevel: 100, minXp: 109109, desc: "Elite attention control", color: "var(--rank-S)" },
    { id: "SS", name: "SS-Rank", minLevel: 150, minXp: cumulativeXpForLevel(150), desc: "Rare, long-term discipline", color: "var(--rank-SS)" },
    { id: "SSS", name: "SSS-Rank", minLevel: 200, minXp: cumulativeXpForLevel(200), desc: "Exceptional sustained mastery", color: "var(--rank-SSS)" },
    { id: "L", name: "L-Rank", minLevel: 290, minXp: 999999, desc: "Legendary transformation", color: "var(--rank-L)" }
  ];

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
  var currentPlanTab = "day";
  var pendingStartTask = null;
  var chosenMinutes = 25;
  var selectedProgressType = "countable";

  var startModal = document.getElementById("startModal");
  var taskModal = document.getElementById("taskModal");
  var revealOverlay = document.getElementById("revealOverlay");

  var state = loadState();

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
      profile: { totalXp: 0, streak: 0, lastActiveDate: null, dailyGoalBlocks: 4 },
      settings: {
        theme: "dark",
        sound: false,
        reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      },
      tasks: [
        normalizeTask({ title: "Reply to warm leads", estMinutes: 25, priority: "high", units: 4, notes: "From the carousel campaign" }),
        normalizeTask({ title: "Draft ceremony program layout", estMinutes: 50, priority: "medium", units: 4 })
      ],
      session: null,
      savedSessions: [],
      history: [],
      dailyBlockLog: {}
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var base = defaultState();
      var loaded = Object.assign({}, base, parsed, {
        profile: Object.assign({}, base.profile, parsed.profile || {}),
        settings: Object.assign({}, base.settings, parsed.settings || {}),
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask) : base.tasks,
        savedSessions: Array.isArray(parsed.savedSessions) ? parsed.savedSessions.map(normalizeSavedSession).filter(Boolean).slice(0, 4) : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        dailyBlockLog: parsed.dailyBlockLog && typeof parsed.dailyBlockLog === "object" ? parsed.dailyBlockLog : {}
      });
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
      status: completed >= total ? "completed" : (source.status === "in_progress" ? "in_progress" : "pending")
    };
  }

  function normalizeSession(session) {
    if (!session || !Array.isArray(session.blocks) || !session.blocks.length) return null;
    var index = Math.max(0, Math.min(3, parseInt(session.blockIndex, 10) || 0));
    var blocks = session.blocks.slice(0, 4).map(function (value) {
      return Math.max(1, parseInt(value, 10) || 1);
    });
    while (blocks.length < 4) blocks.push(blocks[blocks.length - 1] || 1);
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
      blocksCompleted: Math.max(0, Math.min(4, parseInt(session.blocksCompleted, 10) || 0)),
      xpEarned: Math.max(0, parseInt(session.xpEarned, 10) || 0),
      recoveryRemaining: Math.max(0, parseInt(session.recoveryRemaining, 10) || 0),
      recoveryEndsAt: Number.isFinite(Number(session.recoveryEndsAt)) ? Number(session.recoveryEndsAt) : null,
      lastReveal: session.lastReveal || null
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

  function historyEntryToSavedSession(entry) {
    if (!entry || entry.completedAll || !entry.blocksCompleted || entry.blocksCompleted >= (entry.blocksPlanned || 4)) return null;
    var totalMinutes = clampMinutes(entry.totalMinutes, 25);
    return normalizeSavedSession({
      id: entry.id || makeId("saved"),
      totalMinutes: totalMinutes,
      blocks: splitIntoBlocks(totalMinutes),
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

  function splitIntoBlocks(totalMinutes) {
    var totalSeconds = Math.max(1, Math.round(clampMinutes(totalMinutes, 25) * 60));
    var base = Math.floor(totalSeconds / 4);
    var remainder = totalSeconds - (base * 4);
    return [0, 1, 2, 3].map(function (index) {
      return base + (index < remainder ? 1 : 0);
    });
  }

  function beginSession(totalMinutes, linkedTaskId) {
    if (state.session) {
      openStartModal(getTask(linkedTaskId));
      return;
    }
    var minutes = clampMinutes(totalMinutes, 25);
    var blocks = splitIntoBlocks(minutes);
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
      recoveryRemaining: 0,
      recoveryEndsAt: null,
      lastReveal: null
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
    var xpGained = XP_PER_BLOCK + (isFinalBlock ? XP_SESSION_BONUS : 0);
    var linkedTask = session.linkedTaskId ? advanceLinkedTaskProgress(session.linkedTaskId) : null;

    applyDailyStreak();
    logDailyBlock();
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
      isFinalBlock: isFinalBlock
    };

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
      linkedTaskId: session.linkedTaskId,
      linkedTaskTitle: session.linkedTaskId && getTask(session.linkedTaskId) ? getTask(session.linkedTaskId).title : null,
      completedAll: Boolean(completedAll)
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
      savedAt: Date.now(),
      lastReveal: session.lastReveal
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
    state.savedSessions = state.savedSessions.filter(function (item) { return item.id !== sessionId; });
    saveState();
    renderFocus();
    renderToday();
    showToast("Saved session removed.");
  }

  function applyDailyStreak() {
    var today = todayStr();
    if (state.profile.lastActiveDate === today) return;
    var yesterday = addDaysKey(today, -1);
    state.profile.streak = state.profile.lastActiveDate === yesterday ? state.profile.streak + 1 : 1;
    state.profile.lastActiveDate = today;
  }

  function logDailyBlock() {
    var today = todayStr();
    state.dailyBlockLog[today] = (state.dailyBlockLog[today] || 0) + 1;
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

    actions.innerHTML = data.isFinalBlock
      ? '<button class="btn btn-primary btn-block" id="revealFinishBtn">Finish session</button>'
      : '<button class="btn btn-primary btn-block" id="revealContinueBtn">Continue to next block</button><button class="btn btn-ghost btn-block" id="revealStopBtn">Stop and save progress</button>';

    revealOverlay.classList.add("open");
    var finish = document.getElementById("revealFinishBtn");
    var cont = document.getElementById("revealContinueBtn");
    var stop = document.getElementById("revealStopBtn");
    if (finish) finish.onclick = function () { finalizeSession(true); };
    if (cont) cont.onclick = continueSession;
    if (stop) stop.onclick = function () { finalizeSession(false); };
    (finish || cont || stop || revealOverlay).focus();
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

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
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
    document.getElementById("todayPlanList").innerHTML = todays.length ? todays.map(function (item) {
      return '<div class="task-line"><div style="flex:1; min-width:0;">' +
        '<div class="task-title">' + escapeHtml(item.title) + (item.status === "completed" ? " done" : "") + "</div>" +
        '<div class="task-meta">' + (item.time || "Unscheduled") + " - " + item.estMinutes + " min</div>" +
        renderTaskUnitRail(item) + "</div></div>";
    }).join("") : '<div class="empty-state" style="padding:20px 0;">Nothing on the plan yet.</div>';
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

  function renderPlan() {
    var root = document.getElementById("planList");
    var list = state.tasks.filter(function (task) {
      if (currentPlanTab === "day") return task.date === todayStr();
      if (currentPlanTab === "pending") return task.status !== "completed";
      var date = new Date(task.date + "T00:00:00");
      var now = startOfDay(new Date());
      return date >= now && date <= new Date(now.getTime() + (7 * 86400000));
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.time ? timeToMin(a.time) : 9999) - (b.time ? timeToMin(b.time) : 9999);
    });

    if (!list.length) {
      root.innerHTML = '<div class="empty-state"><h3>Nothing here yet</h3><p>Add a task and DeeCadence can place it into your day.</p></div>';
      return;
    }

    root.innerHTML = list.map(function (task) {
      var priClass = task.priority === "high" ? "pri-high" : task.priority === "medium" ? "pri-med" : "pri-low";
      return '<div class="task-card"><div class="task-card-top"><div class="task-card-title">' + escapeHtml(task.title) + (task.status === "completed" ? " done" : "") + '</div><span class="priority-pill ' + priClass + '">' + task.priority + '</span></div><div class="task-card-meta"><span>' + (currentPlanTab === "day" ? "" : task.date + " - ") + (task.time || "Unscheduled") + "</span><span>" + task.estMinutes + " min</span><span>" + task.units.completed + "/" + task.units.total + " units</span></div>" + renderTaskUnitRail(task) + '<div class="task-card-actions">' + (task.status !== "completed" ? '<button class="btn btn-primary" data-focus-task="' + task.id + '">Focus</button>' : "") + '<button class="btn btn-ghost" data-delete-task="' + task.id + '">Delete</button></div></div>';
    }).join("");

    Array.prototype.forEach.call(root.querySelectorAll("[data-focus-task]"), function (button) {
      button.onclick = function () { startScheduledTask(button.getAttribute("data-focus-task")); };
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-delete-task]"), function (button) {
      button.onclick = function () {
        deleteTask(button.getAttribute("data-delete-task"));
      };
    });
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

  function renderProgress() {
    var days = [];
    var blocks7 = 0;
    for (var i = 6; i >= 0; i -= 1) {
      var date = addDaysKey(todayStr(), -i);
      var count = state.dailyBlockLog[date] || 0;
      blocks7 += count;
      days.push({ date: date, count: count });
    }
    document.getElementById("statStreak").textContent = state.profile.streak;
    document.getElementById("statBlocks7").textContent = blocks7;
    var doneTasks = state.tasks.filter(function (task) { return task.status === "completed"; }).length;
    document.getElementById("statCompletion").textContent = state.tasks.length ? Math.round((doneTasks / state.tasks.length) * 100) + "%" : "0%";
    var max = Math.max(state.profile.dailyGoalBlocks, Math.max.apply(null, days.map(function (day) { return day.count; })), 1);
    document.getElementById("progressChart").innerHTML = days.map(function (day) {
      var height = Math.max(3, Math.round((day.count / max) * 100));
      var label = new Date(day.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
      return '<div class="bar-col"><div class="bar" style="height:' + height + '%"></div><div class="bar-day">' + label + "</div></div>";
    }).join("");
    var historyXp = state.history.reduce(function (sum, item) { return sum + (item.xpEarned || 0); }, 0);
    document.getElementById("progressTaskSummary").innerHTML = state.history.length + " sessions logged - " + formatNumber(historyXp) + " XP earned from focus blocks - " + doneTasks + " of " + state.tasks.length + " tasks fully completed.";
  }

  function renderHistory() {
    var root = document.getElementById("historyList");
    if (!state.history.length) {
      root.innerHTML = '<div class="empty-state">No sessions yet. Your first block will show up here.</div>';
      return;
    }
    root.innerHTML = state.history.map(function (item) {
      var date = new Date(item.completedAt || Date.now());
      return '<div class="history-item"><div class="history-icon">' + item.blocksCompleted + "/" + item.blocksPlanned + '</div><div class="history-main"><div class="history-title">' + (item.linkedTaskTitle ? escapeHtml(item.linkedTaskTitle) : "Free focus") + '</div><div class="history-sub">' + date.toLocaleDateString() + " - " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " - " + item.totalMinutes + ' min planned</div></div><div class="history-xp">+' + item.xpEarned + " XP</div></div>";
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
    document.getElementById("dailyGoalSelect").value = String(state.profile.dailyGoalBlocks);
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
  }

  function switchView(name) {
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
  }

  function populateLinkTaskSelect(selectedId) {
    var select = document.getElementById("linkTaskSelect");
    var openTasks = state.tasks.filter(function (task) { return task.status !== "completed"; });
    select.innerHTML = '<option value="">No linked task</option>' + openTasks.map(function (task) {
      return '<option value="' + task.id + '"' + (task.id === selectedId ? " selected" : "") + ">" + escapeHtml(task.title) + "</option>";
    }).join("");
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
    populateLinkTaskSelect(task ? task.id : "");
    document.getElementById("startModalSub").textContent = task ? 'For "' + task.title + '". Choose the full session length.' : "Choose a total length. It will split into four blocks.";
    startModal.classList.add("open");
  }

  function startScheduledTask(taskId) {
    var task = getTask(taskId);
    if (task) openStartModal(task);
  }

  function openTaskModal() {
    selectedProgressType = "countable";
    document.getElementById("taskTitleInput").value = "";
    document.getElementById("taskDateInput").value = todayStr();
    document.getElementById("taskTimeInput").value = "";
    document.getElementById("taskDurationInput").value = "50";
    document.getElementById("taskPriorityInput").value = "medium";
    document.getElementById("taskUnitsInput").value = "4";
    document.getElementById("taskFlexInput").value = "flexible";
    document.getElementById("taskNotesInput").value = "";
    syncProgressTypeButtons();
    taskModal.classList.add("open");
    document.getElementById("taskTitleInput").focus();
  }

  function syncProgressTypeButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-progress-type]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-progress-type") === selectedProgressType);
    });
    var isOngoing = selectedProgressType === "ongoing";
    document.getElementById("taskUnitsFieldWrap").style.display = isOngoing ? "none" : "flex";
    document.getElementById("progressTypeHint").textContent = isOngoing ? "Best when you only need to record focused time." : "Best when a task can be reduced into smaller focus units.";
  }

  function wireEvents() {
    document.getElementById("startNextBlockBtn").onclick = function () {
      if (state.savedSessions.length && !state.session) {
        switchView("focus");
        return;
      }
      openStartModal(nextTask());
    };
    document.getElementById("startModalCancel").onclick = function () { startModal.classList.remove("open"); };
    document.getElementById("startModalConfirm").onclick = function () {
      var selectedTaskId = document.getElementById("linkTaskSelect").value;
      var minutes = document.querySelector('.duration-opt[data-min="custom"]').classList.contains("active")
        ? clampMinutes(document.getElementById("customMinInput").value, 20)
        : chosenMinutes;
      startModal.classList.remove("open");
      beginSession(clampMinutes(minutes, 25), selectedTaskId || null);
    };
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
    document.getElementById("addTaskBtn").onclick = openTaskModal;
    document.getElementById("taskModalCancel").onclick = function () { taskModal.classList.remove("open"); };
    document.getElementById("taskModalConfirm").onclick = function () {
      var title = document.getElementById("taskTitleInput").value.trim();
      if (!title) {
        document.getElementById("taskTitleInput").focus();
        return;
      }
      var task = normalizeTask({
        title: title,
        date: document.getElementById("taskDateInput").value || todayStr(),
        time: document.getElementById("taskTimeInput").value || null,
        flex: document.getElementById("taskFlexInput").value,
        estMinutes: clampMinutes(document.getElementById("taskDurationInput").value, 50),
        priority: document.getElementById("taskPriorityInput").value,
        units: selectedProgressType === "ongoing" ? 4 : document.getElementById("taskUnitsInput").value,
        notes: document.getElementById("taskNotesInput").value
      });
      state.tasks.push(task);
      saveState();
      taskModal.classList.remove("open");
      renderAll();
      showToast("Task added");
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-progress-type]"), function (button) {
      button.onclick = function () {
        selectedProgressType = button.getAttribute("data-progress-type");
        syncProgressTypeButtons();
      };
    });
    [startModal, taskModal].forEach(function (overlay) {
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay) overlay.classList.remove("open");
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
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-choice]"), function (button) {
      button.onclick = function () {
        state.settings.theme = button.getAttribute("data-theme-choice");
        saveState();
        renderSettings();
        applyTheme();
      };
    });
    document.getElementById("themeToggleTop").onclick = function () {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      saveState();
      renderSettings();
      applyTheme();
    };
    document.getElementById("soundSwitch").onclick = function () {
      state.settings.sound = !state.settings.sound;
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
      state.profile.dailyGoalBlocks = parseInt(this.value, 10);
      saveState();
      renderProgress();
    };
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

  window.__DEECADENCE_DEBUG__ = {
    cumulativeXpForLevel: cumulativeXpForLevel,
    xpNeededForLevel: xpNeededForLevel,
    currentLevel: currentLevel,
    currentRank: currentRank,
    ranks: RANKS,
    splitIntoBlocks: splitIntoBlocks,
    clampMinutes: clampMinutes,
    localDateKey: localDateKey,
    beginSession: beginSession,
    continueSavedSession: continueSavedSession,
    finalizeSession: finalizeSession,
    tick: tick,
    deleteTask: deleteTask,
    csvCell: csvCell,
    getState: function () { return state; }
  };

  wireEvents();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("storage", handleStorageChange);
  renderAll();
  switchView("today");
  if (state.session && state.session.status === "running") startTicker();
  document.body.classList.add("booted");
})();
