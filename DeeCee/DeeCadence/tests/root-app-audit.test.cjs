const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "style.css"), "utf8");

function style() {
  return {
    setProperty(name, value) {
      this[name] = value;
    }
  };
}

function classList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach((item) => values.add(item)),
    remove: (...items) => items.forEach((item) => values.delete(item)),
    contains: (item) => values.has(item),
    toggle(item, force) {
      const next = force === undefined ? !values.has(item) : Boolean(force);
      if (next) values.add(item);
      else values.delete(item);
      return next;
    }
  };
}

function createElement(id = "") {
  return {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    style: style(),
    dataset: {},
    classList: classList(),
    setAttribute(name, value) {
      this[name] = String(value);
    },
    getAttribute(name) {
      return this[name] || "";
    },
    focus() {},
    click() {},
    addEventListener() {},
    scrollIntoView() {},
    getBoundingClientRect() {
      return { top: 100, left: 100, right: 300, bottom: 180, width: 200, height: 80 };
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return createElement("nested");
    }
  };
}

function createHarness() {
  const elements = new Map();
  const store = new Map();
  const timers = [];

  function byId(id) {
    if (!elements.has(id)) elements.set(id, createElement(id));
    return elements.get(id);
  }

  function buttonWith(attribute, value) {
    const button = createElement(`${attribute}-${value}`);
    button.getAttribute = (name) => name === attribute ? value : "";
    return button;
  }

  const durationButtons = ["15", "25", "30", "45", "90", "custom"].map((value) => {
    const button = buttonWith("data-min", value);
    if (value === "25") button.classList.add("active");
    return button;
  });
  const themeButtons = ["dark", "light"].map((value) => buttonWith("data-theme-choice", value));
  const progressButtons = ["countable", "ongoing"].map((value) => buttonWith("data-progress-type", value));
  const startSourceButtons = ["schedule", "input"].map((value) => buttonWith("data-start-source", value));
  const planModeButtons = ["schedule", "tasks"].map((value) => buttonWith("data-plan-mode", value));
  const tabs = ["day", "week", "pending"].map((value) => buttonWith("data-planview", value));
  const nav = ["today", "focus", "plan", "rank", "progress", "history", "settings"].map((value) => buttonWith("data-view", value));

  const document = {
    body: byId("body"),
    documentElement: byId("html"),
    createElement: () => createElement("created"),
    getElementById: byId,
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.duration-opt[data-min="custom"]') {
        return durationButtons.find((button) => button.getAttribute("data-min") === "custom");
      }
      return byId(selector);
    },
    querySelectorAll(selector) {
      if (selector === ".duration-opt") return durationButtons;
      if (selector === "[data-theme-choice]") return themeButtons;
      if (selector === "[data-progress-type]") return progressButtons;
      if (selector === "[data-start-source]") return startSourceButtons;
      if (selector === "[data-plan-mode]") return planModeButtons;
      if (selector === ".tab[data-planview]") return tabs;
      if (selector === ".navbtn, .bottomnav button") return nav;
      if (selector === ".view") return nav.map((button) => byId(`view-${button.getAttribute("data-view")}`));
      return [];
    }
  };

  const context = {
    console,
    document,
    window: {
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      innerWidth: 1200,
      innerHeight: 800
    },
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    },
    setInterval(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearInterval() {},
    setTimeout: () => 1,
    clearTimeout() {},
    requestAnimationFrame: (callback) => callback(),
    confirm: () => false,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL() {}
    },
    Blob: function Blob() {},
    Date,
    Math,
    Number,
    String,
    Array,
    JSON
  };

  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: "app.js" });
  return { context, debug: context.window.__DEECADENCE_DEBUG__, timers };
}

function testRankGatesStayExact() {
  const { debug } = createHarness();
  const rank = (code) => debug.ranks.find((item) => item.id === code);

  assert.equal(rank("A").minXp, 49999);
  assert.equal(rank("S").minXp, 109109);
  assert.equal(rank("L").minXp, 999999);
  assert.equal(debug.currentRank(49999).id, "A");
  assert.equal(debug.currentRank(109109).id, "S");
  assert.equal(debug.currentRank(999999).id, "L");
  assert.equal(debug.currentLevel(109109), 100);
  assert.equal(debug.currentLevel(999999), 290);
}

function testDurationClamp() {
  const { debug } = createHarness();

  assert.equal(debug.clampMinutes(-20, 25), 4);
  assert.equal(debug.clampMinutes(999, 25), 240);
  assert.deepEqual(Array.from(debug.splitIntoBlocks(-20)), [60, 60, 60, 60]);
}

function testTimestampTimerCompletesElapsedBlock() {
  const { debug } = createHarness();

  debug.beginSession(4, null);
  const state = debug.getState();
  state.session.blockEndsAt = Date.now() - 1000;
  debug.tick();

  assert.equal(state.session.status, "recovery");
  assert.equal(state.session.blocksCompleted, 1);
  assert.equal(state.session.blockRemaining, 0);
  assert.ok(state.profile.totalXp > 0);
}

function testLinkedTaskDeletionIsBlocked() {
  const { debug } = createHarness();
  const state = debug.getState();
  const taskId = state.tasks[0].id;

  debug.beginSession(25, taskId);
  debug.deleteTask(taskId);

  assert.ok(state.tasks.some((task) => task.id === taskId));
  assert.equal(state.session.linkedTaskId, taskId);
}

function testIncompleteSessionCanBeSavedAndContinued() {
  const { debug } = createHarness();
  const state = debug.getState();

  debug.beginSession(4, null);
  state.session.blockEndsAt = Date.now() - 1000;
  debug.tick();
  debug.finalizeSession(false);

  assert.equal(state.session, null);
  assert.equal(state.savedSessions.length, 1);
  assert.equal(state.savedSessions[0].blocksCompleted, 1);

  debug.continueSavedSession(state.savedSessions[0].id);

  assert.equal(state.savedSessions.length, 0);
  assert.ok(state.session);
  assert.equal(state.session.status, "running");
  assert.equal(state.session.blockIndex, 1);
}

function testPartialSavedSessionKeepsRemainingTime() {
  const { debug } = createHarness();
  const state = debug.getState();

  debug.beginSession(4, null);
  state.session.blockRemaining = 41;
  state.session.blockEndsAt = Date.now() + 41000;
  debug.finalizeSession(false);

  assert.equal(state.session, null);
  assert.equal(state.savedSessions.length, 1);
  assert.equal(state.savedSessions[0].blockIndex, 0);
  assert.equal(state.savedSessions[0].blockRemaining, 41);

  debug.continueSavedSession(state.savedSessions[0].id);

  assert.ok(state.session);
  assert.equal(state.session.blockIndex, 0);
  assert.ok(state.session.blockRemaining <= 41);
}

function testInputTaskSessionUpdatesHistoryWithTitle() {
  const { debug } = createHarness();
  const state = debug.getState();

  const task = debug.createInputFocusTask("  Draft   launch notes  ", 25);
  debug.beginSession(4, task.id);
  state.session.blockEndsAt = Date.now() - 1000;
  debug.tick();
  debug.finalizeSession(true);

  assert.equal(task.title, "Draft launch notes");
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].linkedTaskId, task.id);
  assert.equal(state.history[0].linkedTaskTitle, "Draft launch notes");
}

function testSavedLinkedTaskDeletionIsBlocked() {
  const { context, debug } = createHarness();
  const state = debug.getState();
  context.confirm = () => true;

  const task = debug.createInputFocusTask("Read design notes", 25);
  debug.beginSession(4, task.id);
  state.session.blockEndsAt = Date.now() - 1000;
  debug.tick();
  debug.finalizeSession(false);
  debug.deleteTask(task.id);

  assert.ok(state.tasks.some((item) => item.id === task.id));
  assert.equal(state.savedSessions.length, 1);
  assert.equal(state.savedSessions[0].linkedTaskId, task.id);
}

function testCsvQuotingKeepsCommas() {
  const { debug } = createHarness();

  assert.equal(debug.csvCell('A title, with "quotes"'), '"A title, with ""quotes"""');
}

function testLocalDateFormatterUsesLocalParts() {
  const { debug } = createHarness();

  assert.equal(debug.localDateKey(new Date(2026, 6, 3, 23, 30)), "2026-07-03");
}

function blockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styleSource.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `${selector} block should exist`);
  return match[1];
}

function testUserFacingHtmlIsAsciiSafe() {
  assert.equal(/[^\x00-\x7F]/.test(indexSource), false);
}

function testStartModalHasScheduleAndInputChoices() {
  assert.match(indexSource, /data-start-source="schedule"/);
  assert.match(indexSource, /data-start-source="input"/);
  assert.match(indexSource, /id="inputTaskTitle"/);
  assert.match(indexSource, /id="scheduleTaskField"/);
}

function testPlanHasScheduleAndTaskModes() {
  assert.match(indexSource, /data-plan-mode="schedule"/);
  assert.match(indexSource, /data-plan-mode="tasks"/);
  assert.match(appSource, /function layoutScheduleBlocks/);
  assert.match(styleSource, /\.schedule-now-line/);
  assert.doesNotMatch(styleSource, /\.schedule-now-line::before/);
  assert.match(indexSource, /data-view="settings"/);
}

function testGuidedTourCanRunAndComplete() {
  const { debug } = createHarness();
  const state = debug.getState();

  assert.match(indexSource, /id="tourOverlay"/);
  assert.match(indexSource, /id="replayTourBtn"/);
  assert.match(indexSource, /data-tour="today-rank"/);
  assert.match(styleSource, /\.tour-highlight/);

  debug.startTour(true);
  assert.equal(debug.getTourState().active, true);
  assert.equal(debug.getTourState().index, 0);

  debug.endTour(true);
  assert.equal(debug.getTourState().active, false);
  assert.equal(state.settings.tutorialComplete, true);
}

function testTaskModalCanUseDesktopWidth() {
  const taskModal = blockFor("#taskModal .modal");
  const taskForm = blockFor("#taskModal .form-grid");

  assert.match(taskModal, /760px/);
  assert.match(taskModal, /overflow-x:\s*hidden/);
  assert.match(taskForm, /minmax\(0, 1fr\) minmax\(0, 1fr\)/);
}

function testOverlappingScheduleBlocksGetColumns() {
  const { debug } = createHarness();
  const layout = debug.layoutScheduleBlocks([
    { id: "a", title: "A", time: "14:30", estMinutes: 50, priority: "medium", status: "pending", units: { completed: 0, total: 1 } },
    { id: "b", title: "B", time: "14:40", estMinutes: 50, priority: "medium", status: "pending", units: { completed: 0, total: 1 } },
    { id: "c", title: "C", time: "16:00", estMinutes: 30, priority: "low", status: "pending", units: { completed: 0, total: 1 } }
  ]);

  assert.equal(layout[0].columnCount, 2);
  assert.equal(layout[1].columnCount, 2);
  assert.notEqual(layout[0].column, layout[1].column);
  assert.equal(layout[2].columnCount, 1);

  const oneMinuteOverlap = debug.layoutScheduleBlocks([
    { id: "x", title: "X", time: "14:30", estMinutes: 20, priority: "medium", status: "pending", units: { completed: 0, total: 1 } },
    { id: "y", title: "Y", time: "14:49", estMinutes: 20, priority: "medium", status: "pending", units: { completed: 0, total: 1 } }
  ]);
  assert.equal(oneMinuteOverlap[0].columnCount, 2);
  assert.equal(oneMinuteOverlap[1].columnCount, 2);
}

function testPastTimedTasksAreFlagged() {
  const { debug } = createHarness();
  const missed = debug.taskTimingState({ date: "2000-01-01", time: "09:00", estMinutes: 30, status: "pending" });
  const done = debug.taskTimingState({ date: "2000-01-01", time: "09:00", estMinutes: 30, status: "completed" });

  assert.equal(missed.id, "missed");
  assert.equal(done, null);
}

function testManualDoneGivesSmallXpWithoutBlockCredit() {
  const { debug } = createHarness();
  const state = debug.getState();
  const task = debug.createInputFocusTask("Already completed errand", 25);
  const beforeXp = state.profile.totalXp;
  const today = debug.localDateKey(new Date());

  debug.markTaskDoneOutsideTimer(task.id);

  assert.equal(task.status, "completed");
  assert.equal(task.units.completed, task.units.total);
  assert.equal(task.manualDoneXpAwarded, true);
  assert.equal(state.profile.totalXp - beforeXp, 5);
  assert.equal(state.dailyBlockLog[today] || 0, 0);
  assert.equal(state.history[0].manualDone, true);
  assert.equal(state.history[0].blocksCompleted, 0);
  assert.equal(state.history[0].blocksPlanned, 0);

  debug.markTaskDoneOutsideTimer(task.id);
  assert.equal(state.profile.totalXp - beforeXp, 5);
}

function testRankOrbGeometryKeepsRingsCentered() {
  const orbWrap = blockFor(".orb-wrap");
  const progressRing = blockFor(".orb-wrap > svg:not(.orb-energy-ring)");
  const energyRing = blockFor(".orb-energy-ring");

  assert.match(orbWrap, /position:\s*relative/);
  assert.match(progressRing, /position:\s*absolute/);
  assert.match(progressRing, /inset:\s*14px/);
  assert.match(progressRing, /width:\s*calc\(100% - 28px\)/);
  assert.match(energyRing, /position:\s*absolute !important/);
  assert.match(energyRing, /inset:\s*-14px !important/);
  assert.match(energyRing, /width:\s*calc\(100% \+ 28px\) !important/);
  assert.match(energyRing, /transform:\s*none !important/);
  assert.match(energyRing, /animation:\s*none !important/);
  assert.match(styleSource, /\.orb-energy-ring circle\s*\{[\s\S]*animation:\s*orbDashOrbit 9s linear infinite/);
}

function testThemeAndMotionContractsStayWired() {
  assert.match(styleSource, /\[data-theme="light"\]/);
  assert.match(styleSource, /\[data-reduced-motion="true"\] \*/);
  assert.match(appSource, /data-reduced-motion/);
}

testRankGatesStayExact();
testDurationClamp();
testTimestampTimerCompletesElapsedBlock();
testLinkedTaskDeletionIsBlocked();
testIncompleteSessionCanBeSavedAndContinued();
testPartialSavedSessionKeepsRemainingTime();
testInputTaskSessionUpdatesHistoryWithTitle();
testSavedLinkedTaskDeletionIsBlocked();
testCsvQuotingKeepsCommas();
testLocalDateFormatterUsesLocalParts();
testUserFacingHtmlIsAsciiSafe();
testStartModalHasScheduleAndInputChoices();
testPlanHasScheduleAndTaskModes();
testGuidedTourCanRunAndComplete();
testTaskModalCanUseDesktopWidth();
testOverlappingScheduleBlocksGetColumns();
testPastTimedTasksAreFlagged();
testManualDoneGivesSmallXpWithoutBlockCredit();
testRankOrbGeometryKeepsRingsCentered();
testThemeAndMotionContractsStayWired();

console.log("Root app audit tests passed");
