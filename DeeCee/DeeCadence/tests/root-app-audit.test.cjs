const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

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
      addEventListener() {}
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

function testCsvQuotingKeepsCommas() {
  const { debug } = createHarness();

  assert.equal(debug.csvCell('A title, with "quotes"'), '"A title, with ""quotes"""');
}

function testLocalDateFormatterUsesLocalParts() {
  const { debug } = createHarness();

  assert.equal(debug.localDateKey(new Date(2026, 6, 3, 23, 30)), "2026-07-03");
}

testRankGatesStayExact();
testDurationClamp();
testTimestampTimerCompletesElapsedBlock();
testLinkedTaskDeletionIsBlocked();
testCsvQuotingKeepsCommas();
testLocalDateFormatterUsesLocalParts();

console.log("Root app audit tests passed");
