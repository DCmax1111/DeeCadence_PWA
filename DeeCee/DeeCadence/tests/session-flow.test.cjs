const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");

function createElement(id = "") {
  const children = new Map();
  return {
    id,
    dataset: {},
    style: {},
    hidden: false,
    value: "",
    textContent: "",
    innerHTML: "",
    classList: {
      toggle() {},
      add() {},
      remove() {}
    },
    addEventListener() {},
    setAttribute(name, value) {
      this[name] = String(value);
    },
    removeAttribute(name) {
      delete this[name];
    },
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, createElement(selector));
      return children.get(selector);
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    }
  };
}

function createHarness() {
  const elements = new Map();
  const timers = [];
  const store = new Map();

  const document = {
    body: createElement("body"),
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, createElement(selector));
      return elements.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === "[data-route]") {
        return ["dashboard", "focus", "schedule", "progress", "levels", "history", "settings"].map((route) => ({
          dataset: { route },
          classList: { toggle() {} },
          setAttribute() {},
          removeAttribute() {}
        }));
      }
      return [];
    },
    addEventListener() {}
  };

  const context = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Array,
    Blob: function Blob() {},
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    },
    document,
    localStorage: {
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value))
    },
    window: {
      addEventListener() {},
      matchMedia: () => ({ matches: false }),
      scrollTo() {},
      location: { href: "" }
    },
    setInterval(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearInterval() {}
  };

  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: "src/app.js" });

  return {
    context,
    timers,
    run(code) {
      return vm.runInContext(code, context);
    },
    tick() {
      assert.ok(timers[0], "timer loop should be registered");
      timers[0]();
    }
  };
}

function setSession(harness, overrides = {}) {
  harness.run(`
    state.route = "focus";
    state.totalXp = 1000;
    state.currentSession = {
      id: "test-session",
      task: "Regression sprint",
      totalSeconds: 40,
      blockDurations: [10, 10, 10, 10],
      currentBlockIndex: 0,
      completedBlocks: 0,
      status: "running",
      blockStartedAt: new Date(Date.now() - 11000).toISOString(),
      elapsedCurrentBlockSeconds: 0,
      breakStartedAt: null,
      breakElapsedSeconds: 0,
      totalElapsedSeconds: 0,
      xpEarned: 0,
      rewardUntil: 0,
      lastRewardXp: 0,
      lastRewardBlock: 0,
      startedAt: "2026-07-01T08:00:00.000Z",
      ...${JSON.stringify(overrides)}
    };
  `);
}

function testSessionSplit() {
  const harness = createHarness();
  assert.deepEqual(harness.run("splitIntoBlocks(90 * 60)"), [1350, 1350, 1350, 1350]);
  assert.deepEqual(harness.run("splitIntoBlocks(61)"), [16, 15, 15, 15]);
}

function testNonFinalBlockFlow() {
  const harness = createHarness();
  setSession(harness);

  harness.run("completeCurrentBlock()");
  assert.equal(harness.run("state.currentSession.status"), "reward");
  assert.equal(harness.run("state.currentSession.completedBlocks"), 1);
  assert.equal(harness.run("state.currentSession.xpEarned"), 45);

  harness.run("state.currentSession.rewardUntil = Date.now() - 1");
  harness.tick();
  assert.equal(harness.run("state.currentSession.status"), "break");
  assert.equal(harness.run("state.currentSession.currentBlockIndex"), 1);

  harness.run("state.currentSession.breakStartedAt = new Date(Date.now() - 301000).toISOString()");
  harness.tick();
  assert.equal(harness.run("state.currentSession.status"), "awaiting-next");

  harness.run("continueToNextBlock()");
  assert.equal(harness.run("state.currentSession.status"), "running");
  assert.equal(harness.run("state.currentSession.currentBlockIndex"), 1);
  assert.equal(harness.run("state.currentSession.elapsedCurrentBlockSeconds"), 0);
}

function testFourthBlockEndsSmoothly() {
  const harness = createHarness();
  setSession(harness, {
    currentBlockIndex: 3,
    completedBlocks: 3,
    totalElapsedSeconds: 30,
    xpEarned: 180,
    blockStartedAt: new Date(Date.now() - 11000).toISOString()
  });
  const sessionsBefore = harness.run("state.sessions.length");

  harness.run("completeCurrentBlock()");
  assert.equal(harness.run("state.currentSession.status"), "reward");
  assert.equal(harness.run("state.currentSession.completedBlocks"), 4);
  assert.equal(harness.run("state.currentSession.xpEarned"), 275);

  harness.run("state.currentSession.rewardUntil = Date.now() - 1");
  harness.tick();

  assert.equal(harness.run("state.currentSession"), null);
  assert.equal(harness.run("state.sessions.length"), sessionsBefore + 1);
  assert.equal(harness.run("state.sessions.at(-1).status"), "complete");
  assert.equal(harness.run("state.sessions.at(-1).blocksCompleted"), 4);
  assert.equal(harness.run("state.lastSessionSummary.blocksCompleted"), 4);
  assert.equal(harness.run("state.ui.toast.title"), "Session complete");
}

function testPartialEndFromBreakDoesNotAddBreakTime() {
  const harness = createHarness();
  setSession(harness, {
    currentBlockIndex: 1,
    completedBlocks: 1,
    totalElapsedSeconds: 10,
    xpEarned: 45,
    status: "break",
    blockStartedAt: null,
    breakStartedAt: new Date(Date.now() - 240000).toISOString()
  });

  harness.run("endCurrentSession()");
  assert.equal(harness.run("state.currentSession"), null);
  assert.equal(harness.run("state.sessions.at(-1).status"), "partial");
  assert.equal(harness.run("state.sessions.at(-1).durationMinutes"), 1);
  assert.equal(harness.run("state.sessions.at(-1).blocksCompleted"), 1);
}

function testCustomDurationRequiresInput() {
  const harness = createHarness();
  harness.run(`
    state.ui.startModalOpen = true;
    state.ui.startDraft.selectedDuration = "custom";
    state.ui.startDraft.customMinutes = "";
    beginSessionFromDraft();
  `);

  assert.equal(harness.run("state.currentSession"), null);
  assert.equal(harness.run("state.ui.startModalOpen"), true);
  assert.match(harness.run("state.ui.startError"), /10 to 240/);
}

function testScheduleTaskFlow() {
  const harness = createHarness();
  const before = harness.run("state.scheduleTasks.length");
  harness.run(`
    state.ui.scheduleDraft = {
      title: "Write test plan",
      date: "2026-07-02",
      time: "11:15",
      estimateMinutes: 30,
      priority: "High",
      notes: "Cover mobile schedule flow."
    };
    addScheduleTask();
  `);

  assert.equal(harness.run("state.scheduleTasks.length"), before + 1);
  assert.equal(harness.run("state.scheduleTasks.at(-1).title"), "Write test plan");
  assert.equal(harness.run("state.ui.scheduleDraft.title"), "");

  const taskId = harness.run("state.scheduleTasks.at(-1).id");
  harness.run(`startScheduledTask(${JSON.stringify(taskId)})`);
  assert.equal(harness.run("state.route"), "focus");
  assert.equal(harness.run("state.ui.startModalOpen"), true);
  assert.equal(harness.run("state.ui.startDraft.task"), "Write test plan");
  assert.equal(harness.run("state.ui.startDraft.linkedTaskId"), taskId);
  assert.equal(harness.run("state.ui.startDraft.selectedDuration"), 30);
}

function testScheduledTaskDoesNotReplaceActiveSession() {
  const harness = createHarness();
  setSession(harness);
  const taskId = harness.run("state.scheduleTasks[0].id");
  harness.run(`startScheduledTask(${JSON.stringify(taskId)})`);

  assert.equal(harness.run("state.currentSession.task"), "Regression sprint");
  assert.equal(harness.run("state.ui.startModalOpen"), false);
  assert.equal(harness.run("state.ui.toast.title"), "Session already running");
}

function testSchedulePlannerControls() {
  const harness = createHarness();

  harness.run(`
    setSelectedScheduleDate("2026-07-02");
    setScheduleView("week");
  `);
  assert.equal(harness.run("state.ui.selectedScheduleDate"), "2026-07-02");
  assert.equal(harness.run("state.ui.scheduleDraft.date"), "2026-07-02");
  assert.equal(harness.run("state.ui.scheduleView"), "week");

  harness.run("shiftSelectedScheduleDate(1)");
  assert.equal(harness.run("state.ui.selectedScheduleDate"), "2026-07-03");

  harness.run("setScheduleView('pending')");
  assert.equal(harness.run("pendingScheduleTasks('2026-07-03').every((task) => !task.completed && task.date <= '2026-07-03')"), true);
  assert.equal(harness.run("scheduleWeek('2026-07-03').length"), 7);
}

function testAutoArrangeSchedule() {
  const harness = createHarness();
  harness.run(`
    state.ui.selectedScheduleDate = "2026-07-04";
    state.scheduleTasks = [
      { id: "low", title: "Low task", date: "2026-07-05", time: "16:00", estimateMinutes: 30, priority: "Low", notes: "", completed: false },
      { id: "high", title: "High task", date: "2026-07-05", time: "15:00", estimateMinutes: 45, priority: "High", notes: "", completed: false },
      { id: "done", title: "Done task", date: "2026-07-04", time: "10:00", estimateMinutes: 25, priority: "High", notes: "", completed: true }
    ];
    autoArrangeSchedule();
  `);

  assert.equal(harness.run("state.route"), "schedule");
  assert.equal(harness.run("state.ui.scheduleView"), "day");
  assert.equal(harness.run("state.scheduleTasks.find((task) => task.id === 'high').date"), "2026-07-04");
  assert.equal(harness.run("state.scheduleTasks.find((task) => task.id === 'high').time"), "09:00");
  assert.equal(harness.run("state.scheduleTasks.find((task) => task.id === 'low').time"), "10:00");
  assert.equal(harness.run("state.scheduleTasks.find((task) => task.id === 'done').time"), "10:00");
}

function testRankCurveAndThresholds() {
  const harness = createHarness();

  assert.equal(harness.run("RANK_TIERS.find((rank) => rank.code === 'S').minLevel"), 100);
  assert.equal(harness.run("RANK_TIERS.some((rank) => rank.code === 'SS')"), true);
  assert.equal(harness.run("RANK_TIERS.some((rank) => rank.code === 'SSS')"), true);
  assert.equal(harness.run("RANK_TIERS.some((rank) => rank.code === 'L')"), true);
  assert.equal(harness.run("xpNeededForLevel(10) > xpNeededForLevel(5)"), true);
  assert.equal(harness.run("xpToReachLevel(100) > xpToReachLevel(70)"), true);
}

function testLinkedTaskProgressFromCompletedBlock() {
  const harness = createHarness();
  harness.run(`
    state.totalXp = 1000;
    state.scheduleTasks = [{
      id: "linked",
      title: "Linked task",
      date: "2026-07-04",
      time: "09:00",
      estimateMinutes: 45,
      priority: "High",
      notes: "",
      focusUnitTotal: 4,
      focusUnitsCompleted: 0,
      completed: false
    }];
  `);
  setSession(harness, { linkedTaskId: "linked" });

  harness.run("completeCurrentBlock()");

  assert.equal(harness.run("state.scheduleTasks[0].focusUnitsCompleted"), 1);
  assert.equal(harness.run("state.scheduleTasks[0].completed"), false);
  assert.equal(harness.run("state.ui.toast.message.includes('1/4 task units')"), true);
}

testSessionSplit();
testNonFinalBlockFlow();
testFourthBlockEndsSmoothly();
testPartialEndFromBreakDoesNotAddBreakTime();
testCustomDurationRequiresInput();
testScheduleTaskFlow();
testScheduledTaskDoesNotReplaceActiveSession();
testSchedulePlannerControls();
testAutoArrangeSchedule();
testRankCurveAndThresholds();
testLinkedTaskProgressFromCompletedBlock();

console.log("Session flow regression tests passed");
