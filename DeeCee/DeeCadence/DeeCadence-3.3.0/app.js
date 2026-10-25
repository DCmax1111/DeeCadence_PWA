(function () {
  "use strict";

  // The splash is owned by the inline boot gate in index.html: it shows on a
  // first open or after a long gap, and clears itself. app.js must never
  // dismiss it early or the first-run moment is lost.
  function dismissBootLoader() {
    try {
      document.body.classList.add("booted");
      var bootLoader = document.getElementById("bootLoader");
      if (!bootLoader) return;
      bootLoader.style.opacity = "0";
      bootLoader.style.visibility = "hidden";
      setTimeout(function () {
        if (bootLoader.parentNode) bootLoader.parentNode.removeChild(bootLoader);
      }, 400);
    } catch (e) {}
  }

  // Global error handler: never leave the user staring at a stuck splash.
  window.addEventListener("error", dismissBootLoader);

  var APP_VERSION = "3.3.0";
  var STORAGE_KEY = "deecadence_state_v3";
  var EXIT_BACKUP_KEY = STORAGE_KEY + "_exit_backup";
  var STORAGE_QUOTA_WARN_SHOWN_KEY = STORAGE_KEY + "_quota_warn";
  var FEEDBACK_ENDPOINT = (document.querySelector('meta[name="deecadence-feedback-endpoint"]') || {}).content || "";
  var FEEDBACK_EMAIL = (document.querySelector('meta[name="deecadence-feedback-email"]') || {}).content || "";
  var FEEDBACK_WHATSAPP = (document.querySelector('meta[name="deecadence-feedback-whatsapp"]') || {}).content || "";
  var SUPABASE_URL = (document.querySelector('meta[name="deecadence-supabase-url"]') || {}).content || "";
  var SUPABASE_ANON_KEY = (document.querySelector('meta[name="deecadence-supabase-anon-key"]') || {}).content || "";
  var FEEDBACK_TABLE = (document.querySelector('meta[name="deecadence-feedback-table"]') || {}).content || "feedbacks";
  var REFERENCE_BENCHMARK = { score: 70, label: "DeeCadence reference marker", version: "reference-2026" };
  var XP_PER_FOCUS_MINUTE = 1;
  var XP_MANUAL_DONE_RATE = 0.25;
  var XP_SESSION_BONUS_RATE = 0.1;
  var XP_GOAL_REACHED_BONUS = 30;
  var XP_GOAL_SURPASSED_BONUS = 20;
  var GOAL_SURPASS_MULTIPLIER = 1.5;


  var RECOVERY_SECONDS = 60;
  var MAX_CUSTOM_MINUTES = 240;
  var MIN_CUSTOM_MINUTES = 4;
  var SCHEDULE_START_MINUTES = 0;
  var SCHEDULE_END_MINUTES = 24 * 60;
  var DAY_START_MINUTES = 8 * 60;
  var DAY_END_MINUTES = 20 * 60;
  var SOUND_FILES = {
    blockComplete: "sounds/block-complete.wav",
    sessionComplete: "sounds/session-complete.wav",
    brown: "sounds/brown-noise.wav",
    rain: "sounds/rain_and_thunder.mp3",
    classical: "sounds/classical_music.mp3",
    wind: "sounds/wind.wav"
  };
  var AMBIENT_SOUND_LABELS = {
    brown: "Brown noise",
    rain: "Rain & Thunder",
    classical: "Classical",
    wind: "Wind"
  };
  var AMBIENT_SOUND_IDS = ["brown", "rain", "classical", "wind"];

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
  var lastTickSaveAt = 0;
  var activeView = "today";
  var currentPlanTab = "day";
  var currentPlanMode = "schedule";
  var pendingStartTask = null;
  var startDurationLocked = false;
  var editingTaskId = null;
  var activeDetailTaskId = null;
  var onboardingIndex = 0;
  var tourActive = false;
  var tourIndex = 0;
  var tourPreviousView = "today";
  var chosenMinutes = 25;
  var chosenBlockCount = 4;
  var selectedProgressDate = "";
  var progressRangeDays = 7;
  var progressRangeOffset = 0;
  var personalizeDraft = null;
  var currentHistoryFilter = "all";
  var startTaskSource = "schedule";
  var feedbackType = "Idea";
  var feedbackChannel = "whatsapp";
  var attentionRuntime = null;
  var attentionTimer = null;
  var audioCache = {};
  var ambientAudio = null;
  var brownNoiseEnabled = false;
  var ambientSoundId = "brown";
  var ambientMenuOpen = false;
  var ambientPlayStartedAt = 0;
  var ambientPlayedMs = 0;
  var revealShownAt = 0;
  var lastBlockCompletedAt = 0;
  var milestoneQueue = [];
  var milestoneActive = false;
  var backupDirty = false;
  var timePickerState = { hour: 9, minute: 0, period: "AM", stage: "hour" };
  var selectedRepeatDays = [];

  var startModal = document.getElementById("startModal");
  var taskModal = document.getElementById("taskModal");
  var taskDetailModal = document.getElementById("taskDetailModal");
  var feedbackModal = document.getElementById("feedbackModal");
  var personalizeModal = document.getElementById("personalizeModal");
  var accountSetupModal = document.getElementById("accountSetupModal");
  var attentionTestModal = document.getElementById("attentionTestModal");
  var welcomeOverlay = document.getElementById("welcomeOverlay");
  var tourOverlay = document.getElementById("tourOverlay");
  var revealOverlay = document.getElementById("revealOverlay");
  var timePickerOverlay = document.getElementById("timePickerOverlay");

  var ONBOARDING_PURPOSE_COPY = {
    studying: {
      targetLabel: "Subject or course",
      targetPlaceholder: "e.g. Physics, GST311, Bible Study",
      challengeLabel: "Difficult part",
      challengePlaceholder: "e.g. Past questions, calculations, recall",
      goalLabel: "Study goal",
      goalPlaceholder: "e.g. Prepare for Friday test",
      fallbackTask: "Study session"
    },
    work: {
      targetLabel: "Work area",
      targetPlaceholder: "e.g. Reports, client delivery, admin",
      challengeLabel: "Hardest task type",
      challengePlaceholder: "e.g. Writing, follow-ups, deep work",
      goalLabel: "Work goal",
      goalPlaceholder: "e.g. Finish weekly report",
      fallbackTask: "Focused work block"
    },
    business: {
      targetLabel: "Business area",
      targetPlaceholder: "e.g. Sales, fulfillment, content",
      challengeLabel: "Hardest part",
      challengePlaceholder: "e.g. Outreach, delivery, planning",
      goalLabel: "Business goal",
      goalPlaceholder: "e.g. Close two follow-ups",
      fallbackTask: "Business focus block"
    },
    coding: {
      targetLabel: "Project or topic",
      targetPlaceholder: "e.g. DeeCadence, JavaScript, APIs",
      challengeLabel: "Hardest part",
      challengePlaceholder: "e.g. Debugging, architecture, tests",
      goalLabel: "Build goal",
      goalPlaceholder: "e.g. Finish mobile onboarding",
      fallbackTask: "Coding focus block"
    },
    skill: {
      targetLabel: "Skill",
      targetPlaceholder: "e.g. Design, writing, piano",
      challengeLabel: "Practice area",
      challengePlaceholder: "e.g. Fundamentals, drills, revision",
      goalLabel: "Learning goal",
      goalPlaceholder: "e.g. Complete today's practice",
      fallbackTask: "Skill practice"
    },
    discipline: {
      targetLabel: "Routine",
      targetPlaceholder: "e.g. Reading, chores, prayer, fitness",
      challengeLabel: "Hardest part",
      challengePlaceholder: "e.g. Starting, staying off phone, fatigue",
      goalLabel: "Consistency goal",
      goalPlaceholder: "e.g. Show up daily this week",
      fallbackTask: "Consistency block"
    }
  };

  var ONBOARDING_NOTES = [
    "Choose the closest fit. You can change it later.",
    "Only the focus area is required. The other details can wait.",
    "This is a starting suggestion, not a fixed schedule.",
    "Your rank grows with completed focus minutes. Start at a pace that feels manageable."
  ];

  var PERSONAL_PURPOSE_LABELS = {
    studying: "Studying",
    work: "Work",
    business: "Business",
    coding: "Coding",
    skill: "Learning a skill",
    discipline: "Personal discipline"
  };

  var ACCOUNT_FOCUS_IDS = ["studying", "work", "business", "coding", "skill", "discipline"];
  var ACCOUNT_GOAL_MINUTES = [15, 30, 60, 90, 120];

  var PERSONAL_DISTRACTION_LABELS = {
    phone: "Phone & notifications",
    thoughts: "My own thoughts",
    interrupt: "Interruptions",
    fatigue: "Fatigue",
    other: "Other"
  };

  var PERSONAL_LENGTH_LABELS = {
    "5": "5-10 minutes",
    "15": "15-20 minutes",
    "25": "25-30 minutes",
    "45": "45+ minutes"
  };

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
      target: "#taskFlexInput",
      setup: "taskModal",
      coach: "Timing",
      title: "Fixed or flexible time",
      body: "Fixed keeps the exact time you choose. Flexible places the task into the next available part of your day automatically."
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

  function currentAmbientSound() {
    return AMBIENT_SOUND_IDS.indexOf(ambientSoundId) > -1 ? ambientSoundId : "brown";
  }

  function ambientIsPlaying() {
    return Boolean(ambientAudio && !ambientAudio.paused);
  }

  function bindAmbientTracking(audio) {
    if (!audio || audio.__deeAmbientTracking) return;
    audio.__deeAmbientTracking = true;
    audio.addEventListener("play", function () {
      if (!ambientPlayStartedAt) ambientPlayStartedAt = Date.now();
    });
    audio.addEventListener("pause", function () {
      if (!ambientPlayStartedAt) return;
      ambientPlayedMs += Math.max(0, Date.now() - ambientPlayStartedAt);
      ambientPlayStartedAt = 0;
    });
  }

  function markAmbientStarted() {
    if (!ambientPlayStartedAt && ambientIsPlaying()) ambientPlayStartedAt = Date.now();
  }

  function ambientPlayedSeconds() {
    var elapsed = ambientPlayedMs;
    if (ambientPlayStartedAt) {
      elapsed += Math.max(0, Date.now() - ambientPlayStartedAt);
    }
    return Math.round(elapsed / 1000);
  }

  function resetAmbientTracking() {
    ambientPlayedMs = 0;
    ambientPlayStartedAt = ambientIsPlaying() ? Date.now() : 0;
  }

  function ambientSoundLabel(id) {
    return AMBIENT_SOUND_LABELS[id] || AMBIENT_SOUND_LABELS.brown;
  }

  function isFocusRunning() {
    return Boolean(state.session && state.session.status === "running");
  }

  function syncAmbientPlayback() {
    if (brownNoiseEnabled && isFocusRunning()) startAmbientSound();
    else stopAmbientSound();
    syncAmbientUI();
  }

  function sessionBlockIndexForLearning() {
    return state.session ? Math.max(0, Number(state.session.blockIndex) || 0) : null;
  }

  function sessionRestartContext() {
    var events = state.learning && Array.isArray(state.learning.events) ? state.learning.events : [];
    for (var i = events.length - 1; i >= 0; i -= 1) {
      var event = events[i];
      if (!event || event.type !== "session_end") continue;
      var data = event.d && typeof event.d === "object" ? event.d : {};
      var gap = Math.max(0, Math.round((Date.now() - (Number(event.t) || Date.now())) / 1000));
      return {
        gapSinceLastSessionSeconds: gap,
        quickRestart: gap <= 120,
        previousSessionAudio: Boolean(data.noiseEnabled || data.noisePlayingAtEnd),
        previousSessionCompletedAll: Boolean(data.completedAll)
      };
    }
    return {
      gapSinceLastSessionSeconds: null,
      quickRestart: false,
      previousSessionAudio: false,
      previousSessionCompletedAll: false
    };
  }

  function startAmbientSound() {
    var id = currentAmbientSound();
    if (ambientAudio && ambientAudio.getAttribute("data-sound") === id && !ambientAudio.paused) return;
    if (!ambientAudio || ambientAudio.getAttribute("data-sound") !== id) {
      if (ambientAudio) {
        ambientAudio.pause();
        ambientAudio.currentTime = 0;
      }
      ambientAudio = getSound(id);
      if (!ambientAudio) return;
      bindAmbientTracking(ambientAudio);
      ambientAudio.loop = true;
      ambientAudio.volume = 0.55;
      ambientAudio.setAttribute("data-sound", id);
    }
    var attempt = ambientAudio.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(markAmbientStarted).catch(function (error) {
        console.warn("Ambient audio did not start:", error && error.name, error && error.message);
        showToast("Ambient sound could not start. Tap the sound button to retry.");
      });
    } else {
      markAmbientStarted();
    }
  }

  function stopAmbientSound() {
    if (ambientPlayStartedAt) {
      ambientPlayedMs += Math.max(0, Date.now() - ambientPlayStartedAt);
      ambientPlayStartedAt = 0;
    }
    if (!ambientAudio) return;
    ambientAudio.pause();
    try { ambientAudio.currentTime = 0; } catch (error) {}
  }

  function setAmbientEnabled(enabled, options) {
    brownNoiseEnabled = Boolean(enabled);
    state.settings.brownNoise = brownNoiseEnabled;
    if (!(options && options.silent)) {
      recordLearningEvent("brown_noise", {
        on: brownNoiseEnabled,
        noiseEnabled: brownNoiseEnabled,
        noisePlaying: ambientIsPlaying(),
        duringSession: isFocusRunning(),
        sound: currentAmbientSound(),
        blockIndex: sessionBlockIndexForLearning(),
        audioPlayedSeconds: ambientPlayedSeconds(),
        change: options && options.change ? options.change : "toggle"
      });
    }
    saveState();
    syncAmbientPlayback();
    if (!(options && (options.quiet || options.silent)) && !(options && options.change)) {
      if (brownNoiseEnabled) {
        showToast(isFocusRunning() ? "Ambient sound on" : "Ambient sound on. It will start with your next focus block.");
      } else {
        showToast("Ambient sound off");
      }
    }
    syncAmbientUI();
  }

  function toggleAmbientSound() {
    setAmbientEnabled(!brownNoiseEnabled);
  }

  function selectAmbientSound(id) {
    if (AMBIENT_SOUND_IDS.indexOf(id) === -1) return;
    var changed = ambientSoundId !== id;
    ambientSoundId = id;
    state.settings.ambientSound = id;
    if (!brownNoiseEnabled) {
      // Choosing a sound is an intent to hear it. The small speaker button
      // stays the explicit on/off switch.
      setAmbientEnabled(true, { change: "source" });
      return;
    }
    if (changed) {
      if (brownNoiseEnabled && isFocusRunning()) {
        stopAmbientSound();
        startAmbientSound();
      }
      recordLearningEvent("brown_noise", {
        on: true,
        noiseEnabled: true,
        noisePlaying: ambientIsPlaying(),
        duringSession: isFocusRunning(),
        sound: id,
        blockIndex: sessionBlockIndexForLearning(),
        audioPlayedSeconds: ambientPlayedSeconds(),
        change: "source"
      });
    }
    saveState();
    syncAmbientUI();
  }

  function setAmbientMenu(open) {
    ambientMenuOpen = Boolean(open);
    syncAmbientUI();
    if (ambientMenuOpen) {
      var first = document.querySelector("#focusNoiseMenu [data-noise-sound]");
      if (first) first.focus();
    }
  }

  function ambientLearning() {
    var noise = learningProfile().brownNoise;
    var on = noise.on;
    var off = noise.off;
    var onNeeded = Math.max(0, 3 - on.sessions);
    var offNeeded = Math.max(0, 3 - off.sessions);
    if (onNeeded || offNeeded) {
      var needs = [];
      if (onNeeded) needs.push(onNeeded + " with it");
      if (offNeeded) needs.push(offNeeded + " without");
      return {
        hasEvidence: false,
        recommended: null,
        text: "still learning when sound helps - needs " + needs.join(" and ") + " to compare"
      };
    }
    var completionDiff = on.completionRate - off.completionRate;
    var pauseDiff = on.pauseRate - off.pauseRate;
    var confident = Math.abs(completionDiff) >= 8 || Math.abs(pauseDiff) >= 0.6;
    if (!confident) {
      return {
        hasEvidence: true,
        recommended: null,
        text: "finish rate is even so far (" + on.completionRate + "% with it vs " + off.completionRate + "% without)"
      };
    }
    var score = completionDiff - (pauseDiff * 8);
    var recommended = score >= 0;
    var evidence = [on.completionRate + "% finished with it vs " + off.completionRate + "% without"];
    if (on.pauseRate !== off.pauseRate) {
      evidence.push(on.pauseRate + " pauses per session vs " + off.pauseRate);
    }
    return {
      hasEvidence: true,
      recommended: recommended,
      text: (recommended ? "sound is helping your focus" : "sound is not helping yet") + " - " + evidence.join(", ")
    };
  }

  function syncAmbientUI() {
    var sw = document.getElementById("brownNoiseSwitch");
    if (sw) {
      sw.classList.toggle("on", brownNoiseEnabled);
      sw.setAttribute("aria-pressed", String(brownNoiseEnabled));
    }
    var current = currentAmbientSound();
    var currentLabel = ambientSoundLabel(current);
    var running = isFocusRunning();
    var playbackLabel = brownNoiseEnabled ? (running ? "playing" : "on - starts with a running block") : "off";
    var chip = document.getElementById("focusNoiseBtn");
    if (chip) {
      chip.classList.toggle("active", brownNoiseEnabled);
      chip.classList.toggle("is-waiting", brownNoiseEnabled && !running);
      chip.setAttribute("aria-expanded", String(ambientMenuOpen));
      chip.setAttribute("aria-label", currentLabel + ". " + (brownNoiseEnabled ? (running ? "Playing. " : "On, waiting for a running focus block. ") : "Off. ") + "Choose ambient sound.");
      var advice = ambientLearning();
      chip.setAttribute("title", currentLabel + " " + playbackLabel + " - " + (advice.text || "") + (advice.recommended === true ? " - consider using it for focus blocks" : ""));
    }
    var label = document.getElementById("focusNoiseLabel");
    if (label) label.textContent = currentLabel;
    var toggle = document.getElementById("focusNoiseToggle");
    if (toggle) {
      toggle.classList.toggle("active", brownNoiseEnabled);
      toggle.classList.toggle("is-waiting", brownNoiseEnabled && !running);
      toggle.setAttribute("data-state", brownNoiseEnabled ? "on" : "off");
      toggle.setAttribute("aria-pressed", String(brownNoiseEnabled));
      toggle.setAttribute("aria-label", brownNoiseEnabled ? "Turn ambient sound off" : "Turn ambient sound on");
      toggle.setAttribute("title", brownNoiseEnabled ? (running ? "Ambient sound playing - turn off" : "Ambient sound on - starts with a running block") : "Turn ambient sound on");
      var stateLabel = document.getElementById("focusNoiseState");
      if (stateLabel) stateLabel.textContent = brownNoiseEnabled ? "On" : "Off";
    }
    Array.prototype.forEach.call(document.querySelectorAll("#focusNoiseMenu [data-noise-sound]"), function (button) {
      var active = button.getAttribute("data-noise-sound") === current;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
    var menu = document.getElementById("focusNoiseMenu");
    if (menu) {
      menu.hidden = !ambientMenuOpen;
      if (ambientMenuOpen && !window.matchMedia("(min-width: 401px)").matches && chip) {
        // On narrow screens the chip sits near the right edge, so anchor the
        // menu to the screen's left edge instead of under the chip.
        var picker = chip.parentNode;
        var pickerRect = picker.getBoundingClientRect();
        var chipRect = chip.getBoundingClientRect();
        menu.style.left = Math.round(10 - pickerRect.left) + "px";
        menu.style.top = Math.round(chipRect.bottom + 8 - pickerRect.top) + "px";
      } else {
        menu.style.left = "";
        menu.style.top = "";
      }
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

  function defaultOnboarding() {
    return {
      purpose: "",
      target: "",
      challenge: "",
      goal: "",
      focusWindow: "not-sure",
      distraction: "",
      focusLength: 0,
      capacityMinutes: 0,
      baseAttentionCapacity: 0,
      firstAction: "",
      completedAt: "",
      refinedAt: ""
    };
  }

  function normalizeOnboarding(input) {
    var source = input && typeof input === "object" ? input : {};
    var allowedPurposes = ["studying", "work", "business", "coding", "skill", "discipline"];
    var allowedWindows = ["morning", "afternoon", "evening", "late-night", "not-sure"];
    var allowedActions = ["task", "schedule", "focus", "today"];
    var allowedDistractions = ["phone", "thoughts", "interrupt", "fatigue", "other"];
    var rawLength = Math.max(0, Math.min(180, parseInt(source.focusLength || source.capacityMinutes, 10) || 0));
    var capacity = Math.max(0, Math.min(180, parseInt(source.capacityMinutes, 10) || rawLength || 0));
    return {
      purpose: allowedPurposes.indexOf(source.purpose) > -1 ? source.purpose : "",
      target: String(source.target || "").trim().slice(0, 80),
      challenge: String(source.challenge || "").trim().slice(0, 80),
      goal: String(source.goal || "").trim().slice(0, 120),
      focusWindow: allowedWindows.indexOf(source.focusWindow) > -1 ? source.focusWindow : "not-sure",
      distraction: allowedDistractions.indexOf(source.distraction) > -1 ? source.distraction : "",
      focusLength: rawLength,
      capacityMinutes: capacity,
      baseAttentionCapacity: Math.max(0, Math.min(100, parseInt(source.baseAttentionCapacity, 10) || 0)),
      firstAction: allowedActions.indexOf(source.firstAction) > -1 ? source.firstAction : "",
      completedAt: String(source.completedAt || ""),
      refinedAt: String(source.refinedAt || "")
    };
  }

  function defaultAccountProfile() {
    return { name: "", focus: "", dailyGoalMinutes: 0, completedAt: "" };
  }

  function normalizeAccountProfile(input) {
    var source = input && typeof input === "object" ? input : {};
    var goal = parseInt(source.dailyGoalMinutes, 10) || 0;
    if (ACCOUNT_GOAL_MINUTES.indexOf(goal) === -1) goal = 0;
    return {
      name: String(source.name || "").trim().slice(0, 60),
      focus: ACCOUNT_FOCUS_IDS.indexOf(source.focus) > -1 ? source.focus : "",
      dailyGoalMinutes: goal,
      completedAt: String(source.completedAt || "")
    };
  }

  function accountProfileName() {
    return state.accountProfile && state.accountProfile.name ? String(state.accountProfile.name).trim() : "";
  }

  function applyAccountProfile(profile) {
    var next = normalizeAccountProfile(profile);
    if (!next.name) return false;
    var goal = next.dailyGoalMinutes || Number(state.profile.dailyGoalMinutes) || 60;
    if (ACCOUNT_GOAL_MINUTES.indexOf(goal) === -1) goal = 60;
    next.dailyGoalMinutes = goal;
    state.accountProfile = next;
    state.profile.dailyGoalMinutes = goal;
    state.profile.dailyGoalBlocks = Math.max(1, Math.round(goal / 15));
    if (!state.onboarding.purpose) state.onboarding.purpose = next.focus;
    saveState();
    renderAll();
    return true;
  }

  function openAccountSetup(detail) {
    if (!accountSetupModal) return;
    if (accountSetupModal.classList.contains("open")) return;
    var current = normalizeAccountProfile(state.accountProfile);
    var nameInput = document.getElementById("accountSetupName");
    var focusSelect = document.getElementById("accountSetupFocus");
    var goalSelect = document.getElementById("accountSetupGoal");
    var emailLabel = document.getElementById("accountSetupEmail");
    var note = document.getElementById("accountSetupNote");
    var focus = current.focus || (ACCOUNT_FOCUS_IDS.indexOf(state.onboarding.purpose) > -1 ? state.onboarding.purpose : "work");
    var goal = current.dailyGoalMinutes || Number(state.profile.dailyGoalMinutes) || 60;
    if (ACCOUNT_GOAL_MINUTES.indexOf(goal) === -1) goal = 60;
    if (nameInput) {
      nameInput.value = current.name || "";
      nameInput.removeAttribute("aria-invalid");
    }
    if (focusSelect) focusSelect.value = focus;
    if (goalSelect) goalSelect.value = String(goal);
    if (emailLabel) emailLabel.textContent = detail && detail.email ? String(detail.email) : "Your DeeCadence account";
    if (note) {
      note.setAttribute("data-status", "info");
      note.textContent = "This profile is saved with your synced progress, so it follows you to your next device. You can change the daily goal later in Settings.";
    }
    accountSetupModal.classList.add("open");
    accountSetupModal.setAttribute("aria-hidden", "false");
    setTimeout(function () { if (nameInput) nameInput.focus(); }, 80);
  }

  function closeAccountSetup() {
    if (!accountSetupModal) return;
    accountSetupModal.classList.remove("open");
    accountSetupModal.setAttribute("aria-hidden", "true");
  }

  function saveAccountSetup(event) {
    if (event) event.preventDefault();
    var nameInput = document.getElementById("accountSetupName");
    var focusSelect = document.getElementById("accountSetupFocus");
    var goalSelect = document.getElementById("accountSetupGoal");
    var note = document.getElementById("accountSetupNote");
    var name = nameInput ? nameInput.value.trim().slice(0, 60) : "";
    if (!name) {
      if (nameInput) {
        nameInput.setAttribute("aria-invalid", "true");
        nameInput.focus();
      }
      if (note) {
        note.setAttribute("data-status", "error");
        note.textContent = "Add the name you want DeeCadence to use.";
      }
      return;
    }
    var focus = focusSelect && ACCOUNT_FOCUS_IDS.indexOf(focusSelect.value) > -1 ? focusSelect.value : "work";
    var goal = parseInt(goalSelect ? goalSelect.value : "", 10) || Number(state.profile.dailyGoalMinutes) || 60;
    if (ACCOUNT_GOAL_MINUTES.indexOf(goal) === -1) goal = 60;
    state.accountProfile = normalizeAccountProfile({
      name: name,
      focus: focus,
      dailyGoalMinutes: goal,
      completedAt: state.accountProfile.completedAt || new Date().toISOString()
    });
    state.profile.dailyGoalMinutes = goal;
    state.profile.dailyGoalBlocks = Math.max(1, Math.round(goal / 15));
    if (!state.onboarding.purpose) state.onboarding.purpose = focus;
    saveState();
    closeAccountSetup();
    renderAll();
    showToast("Account setup saved. Syncing your progress.");
    try {
      window.dispatchEvent(new CustomEvent("deecadence:account-profile-saved", { detail: { profile: state.accountProfile } }));
    } catch (_) {}
  }

  function defaultState() {
    return {
      appVersion: APP_VERSION,
      profile: { totalXp: 0, streak: 0, momentum: 75, lastActiveDate: null, dailyGoalBlocks: 4, dailyGoalMinutes: 60, goalBonus: {} },
      settings: {
        theme: "dark",
        sound: true,
        soundPreferenceTouched: false,
        brownNoise: false,
        ambientSound: "brown",
        chartType: "bars",
        welcomeComplete: false,
        tutorialComplete: false,
        reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      },
      onboarding: defaultOnboarding(),
      accountProfile: defaultAccountProfile(),
      tasks: [],
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
      dismissedContextTips: {},
      // Bumping this revision re-shows the tab notices once after a
      // notification-behaviour change (see loadState).
      contextTipRevision: 2,
      learning: { events: [] }
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          parsed = null;
        }
      }
      if (!parsed) {
        var recoveryRaw = localStorage.getItem(EXIT_BACKUP_KEY);
        var recovery = recoveryRaw ? JSON.parse(recoveryRaw) : null;
        parsed = recovery && recovery.state ? recovery.state : null;
      }
      if (!parsed) return defaultState();
      var base = defaultState();
      var loaded = Object.assign({}, base, parsed, {
        appVersion: APP_VERSION,
        profile: Object.assign({}, base.profile, parsed.profile || {}),
        settings: Object.assign({}, base.settings, parsed.settings || {}),
        onboarding: normalizeOnboarding(parsed.onboarding),
        accountProfile: normalizeAccountProfile(parsed.accountProfile),
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
        dismissedContextTips: parsed.dismissedContextTips && typeof parsed.dismissedContextTips === "object" ? parsed.dismissedContextTips : {},
        learning: parsed.learning && Array.isArray(parsed.learning.events)
          ? {
              events: parsed.learning.events
                .filter(function (ev) { return ev && typeof ev === "object"; })
                .map(function (ev) {
                  if (!ev.id || typeof ev.id !== "string") ev.id = makeId("le");
                  return ev;
                })
                .slice(-500)
            }
          : { events: [] }
      });
      if (parsed.contextTipRevision !== 2) {
        // The old notices faded on a timer. They now wait for a manual
        // dismissal, so show every tab's notice one more time.
        loaded.dismissedContextTips = {};
        loaded.contextTipRevision = 2;
      }
      if (loaded.baselineScore === null && loaded.attentionTests.length) {
        loaded.baselineScore = loaded.attentionTests[0].score;
        loaded.baselineTestId = loaded.attentionTests[0].id;
        loaded.baselineCompletedAt = loaded.attentionTests[0].takenAt;
      }
      if (!loaded.profile.dailyGoalMinutes) loaded.profile.dailyGoalMinutes = loaded.profile.dailyGoalBlocks ? loaded.profile.dailyGoalBlocks * 15 : 60;
      if (!loaded.profile.goalBonus || typeof loaded.profile.goalBonus !== "object") loaded.profile.goalBonus = {};
      if (AMBIENT_SOUND_IDS.indexOf(loaded.settings.ambientSound) === -1) loaded.settings.ambientSound = "brown";
      if (["bars", "line"].indexOf(loaded.settings.chartType) === -1) loaded.settings.chartType = "bars";
      if (!Object.prototype.hasOwnProperty.call(parsed.settings || {}, "soundPreferenceTouched")) loaded.settings.sound = true;
      loaded.session = normalizeSession(parsed.session);
      return loaded;
    } catch (error) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      backupDirty = true;
      if (typeof window.CustomEvent === "function") window.dispatchEvent(new CustomEvent("deecadence:local-save"));
    } catch (error) {
      // Storage quota exceeded or unavailable — notify user once.
      if (!localStorage.getItem(STORAGE_QUOTA_WARN_SHOWN_KEY)) {
        try { localStorage.setItem(STORAGE_QUOTA_WARN_SHOWN_KEY, "1"); } catch (_) {}
        showToast("Storage full — export a backup before adding more data.");
      }
    }
  }

  function flushBeforeUnload() {
    try { saveState(); } catch (_) {}
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
      repeat: ["daily", "weekdays", "weekly", "custom"].indexOf(source.repeat) > -1 ? source.repeat : "none",
      repeatDays: Array.isArray(source.repeatDays) ? source.repeatDays.filter(function (d) { return d >= 0 && d <= 6; }) : [],
      repeatSourceId: String(source.repeatSourceId || ""),
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
      source: String(session.source || "schedule"),
      startedAt: session.startedAt || Date.now(),
      blocksCompleted: Math.max(0, Math.min(blocks.length, parseInt(session.blocksCompleted, 10) || 0)),
      xpEarned: Math.max(0, parseInt(session.xpEarned, 10) || 0),
      pauseCount: Math.max(0, parseInt(session.pauseCount, 10) || 0),
      penaltyXp: Math.max(0, parseInt(session.penaltyXp, 10) || 0),
      quickRestart: Boolean(session.quickRestart),
      previousSessionAudio: Boolean(session.previousSessionAudio),
      previousSessionCompletedAll: Boolean(session.previousSessionCompletedAll),
      gapSinceLastSessionSeconds: Number.isFinite(Number(session.gapSinceLastSessionSeconds)) ? Number(session.gapSinceLastSessionSeconds) : null,
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
    var now = new Date();
    var cursor = Math.max(DAY_START_MINUTES, now.getHours() * 60 + now.getMinutes() + 5);
    cursor = Math.ceil(cursor / 5) * 5;
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

    var arrangedCount = 0;
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
      arrangedCount += 1;
    });

    saveState();
    return placed.sort(function (a, b) { return a.start - b.start; }).map(function (item) { return item.task; });
  }

  function placeFlexibleTask(task) {
    if (!task || task.time || task.flex !== "flexible") return task;
    var date = task.date || todayStr();
    var now = new Date();
    var cursor = date === todayStr()
      ? Math.max(DAY_START_MINUTES, Math.ceil((now.getHours() * 60 + now.getMinutes() + 5) / 5) * 5)
      : DAY_START_MINUTES;
    var duration = Math.min(task.estMinutes, DAY_END_MINUTES - DAY_START_MINUTES);
    var occupied = state.tasks
      .filter(function (item) { return item.id !== task.id && item.date === date && item.status !== "completed" && item.time; })
      .map(function (item) { return { start: timeToMin(item.time), end: timeToMin(item.time) + item.estMinutes }; })
      .sort(function (a, b) { return a.start - b.start; });
    occupied.forEach(function (slot) {
      if (cursor < slot.end && cursor + duration > slot.start) cursor = Math.ceil((slot.end + 5) / 5) * 5;
    });
    if (cursor + duration > DAY_END_MINUTES) cursor = Math.max(DAY_START_MINUTES, DAY_END_MINUTES - duration);
    task.time = minToTime(cursor);
    return task;
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

  function beginSession(totalMinutes, linkedTaskId, blockCount, options) {
    if (state.session) {
      switchView("focus");
      showToast("A focus block is already active.");
      return;
    }
    if (linkedTaskId && state.savedSessions.some(function (saved) { return saved.linkedTaskId === linkedTaskId; })) {
      switchView("focus");
      showToast("Continue this task's saved session first.");
      return;
    }
    var minutes = clampMinutes(totalMinutes, 25);
    var blocks = splitIntoBlocks(minutes, blockCount);
    var linkedTask = linkedTaskId ? getTask(linkedTaskId) : null;
    var restartContext = sessionRestartContext();
    state.session = {
      id: makeId("sess"),
      totalMinutes: minutes,
      blocks: blocks,
      blockIndex: 0,
      blockRemaining: blocks[0],
      blockEndsAt: Date.now() + (blocks[0] * 1000),
      status: "running",
      linkedTaskId: linkedTaskId || null,
      source: String(startTaskSource || "schedule"),
      startedAt: Date.now(),
      blocksCompleted: 0,
      xpEarned: 0,
      pauseCount: 0,
      penaltyXp: 0,
      recoveryRemaining: 0,
      recoveryEndsAt: null,
      quickRestart: restartContext.quickRestart,
      previousSessionAudio: restartContext.previousSessionAudio,
      previousSessionCompletedAll: restartContext.previousSessionCompletedAll,
      gapSinceLastSessionSeconds: restartContext.gapSinceLastSessionSeconds,
      lastReveal: null,
      blockFeedback: []
    };
    if (linkedTask) linkedTask.status = "in_progress";
    revealShownAt = 0;
    lastBlockCompletedAt = 0;
    resetAmbientTracking();
    recordLearningEvent("session_start", {
      startedAt: state.session.startedAt,
      minutes: minutes,
      blocks: blocks.length,
      taskId: linkedTaskId || "",
      taskTitle: linkedTask ? linkedTask.title : "",
      taskTime: linkedTask ? linkedTask.time || "" : "",
      locked: Boolean(options && options.locked),
      noise: Boolean(brownNoiseEnabled),
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlaying: ambientIsPlaying(),
      noiseType: brownNoiseEnabled ? currentAmbientSound() : "",
      audioPlayedSeconds: 0,
      source: state.session.source,
      quickRestart: restartContext.quickRestart,
      previousSessionAudio: restartContext.previousSessionAudio,
      previousSessionCompletedAll: restartContext.previousSessionCompletedAll,
      gapSinceLastSessionSeconds: restartContext.gapSinceLastSessionSeconds
    });
    pendingStartTask = null;
    saveState();
    syncAmbientPlayback();
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
    // Only the countdown text and ring move each second. Rebuilding the whole
    // stage every tick made the Focus view look like it was refreshing.
    renderFocus();
    renderSessionIndicators();
    if (Date.now() - lastTickSaveAt > 5000) {
      lastTickSaveAt = Date.now();
      saveState();
    }
    if (session.status === "recovery" && session.recoveryRemaining <= 0) stopTicker();
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
    recordLearningEvent("session_pause", {
      blockIndex: state.session.blockIndex,
      remainingSeconds: state.session.blockRemaining,
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlaying: ambientIsPlaying(),
      noiseType: brownNoiseEnabled ? currentAmbientSound() : "",
      audioPlayedSeconds: ambientPlayedSeconds()
    });
    stopTicker();
    syncAmbientPlayback();
    saveState();
    renderFocus();
  }

  function resumeSession() {
    if (!state.session || state.session.status !== "paused") return;
    state.session.blockRemaining = Math.max(1, state.session.blockRemaining);
    state.session.blockEndsAt = Date.now() + (state.session.blockRemaining * 1000);
    state.session.status = "running";
    recordLearningEvent("session_resume", {
      blockIndex: state.session.blockIndex,
      remainingSeconds: state.session.blockRemaining,
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlaying: ambientIsPlaying(),
      noiseType: brownNoiseEnabled ? currentAmbientSound() : ""
    });
    syncAmbientPlayback();
    saveState();
    startTicker();
    renderFocus();
  }

  function advanceLinkedTaskProgress(taskId) {
    var task = getTask(taskId);
    if (!task) return null;
    task.units.completed = Math.min(task.units.total, task.units.completed + 1);
    task.status = task.units.completed >= task.units.total ? "completed" : "in_progress";
    if (task.status === "completed") createNextRecurringTask(task);
    return task;
  }

  function createNextRecurringTask(task) {
    if (!task || task.repeat === "none") return null;
    var nextDate;
    if (task.repeat === "custom" && task.repeatDays && task.repeatDays.length) {
      var nextDay = null;
      for (var offset = 1; offset <= 7; offset += 1) {
        var candidate = addDaysKey(task.date, offset);
        var day = parseDateKey(candidate).getDay();
        if (task.repeatDays.indexOf(day) > -1) {
          nextDay = candidate;
          break;
        }
      }
      nextDate = nextDay;
    } else {
      nextDate = task.repeat === "weekly" ? addDaysKey(task.date, 7) : addDaysKey(task.date, 1);
      if (task.repeat === "weekdays") {
        while ([0, 6].indexOf(parseDateKey(nextDate).getDay()) > -1) nextDate = addDaysKey(nextDate, 1);
      }
    }
    if (!nextDate) return null;
    var duplicate = state.tasks.some(function (item) {
      return item.repeatSourceId === task.id && item.date === nextDate;
    });
    if (duplicate) return null;
    var next = normalizeTask({
      title: task.title,
      date: nextDate,
      time: task.time,
      flex: task.flex,
      estMinutes: task.estMinutes,
      priority: task.priority,
      units: task.units.total,
      notes: task.notes,
      repeat: task.repeat,
      repeatDays: task.repeatDays
    });
    next.repeatSourceId = task.id;
    state.tasks.push(next);
    return next;
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
    var noisePlaying = ambientIsPlaying();
    var audioPlayedSeconds = ambientPlayedSeconds();
    var xpGained = focusXpForSeconds(blockSeconds) + (isFinalBlock ? sessionCompletionBonus(session.totalMinutes) : 0);
    var linkedTask = session.linkedTaskId ? advanceLinkedTaskProgress(session.linkedTaskId) : null;

    applyDailyStreak();
    state.profile.momentum = Math.min(100, state.profile.momentum + 5);
    var goalBefore = state.dailyFocusMinutes[todayStr()] || 0;
    logDailyFocus(blockSeconds);
    var goalAfter = state.dailyFocusMinutes[todayStr()] || 0;
    var goalBonus = awardDailyGoalBonus(goalBefore, goalAfter);
    xpGained += goalBonus.xp;
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
      goalBonusXp: goalBonus.xp,
      goalMessages: goalBonus.messages,
      prevXp: prevXp,
      newXp: state.profile.totalXp,
      leveledUp: detectLevelUp(prevXp, state.profile.totalXp),
      rankedUpId: (detectRankUp(prevXp, state.profile.totalXp) || {}).id || "",
      linkedTaskId: linkedTask ? linkedTask.id : "",
      isFinalBlock: isFinalBlock,
      focusedMinutes: Math.round(blockSeconds / 60),
      penaltyXp: session.penaltyXp || 0
    };
    lastBlockCompletedAt = Date.now();
    recordLearningEvent("block_complete", {
      blockIndex: session.blockIndex,
      blocksPlanned: session.blocks.length,
      seconds: blockSeconds,
      finalBlock: isFinalBlock,
      xpGained: xpGained,
      goalBonusXp: goalBonus.xp,
      goalReached: goalBonus.reached,
      goalSurpassed: goalBonus.surpassed,
      taskTitle: linkedTask ? linkedTask.title : "",
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlaying: noisePlaying,
      noiseType: brownNoiseEnabled ? currentAmbientSound() : "",
      audioPlayedSeconds: audioPlayedSeconds
    });

    syncAmbientPlayback();
    playSound(isFinalBlock ? "sessionComplete" : "blockComplete");
    showXpFloat(xpGained);
    saveState();
    renderAll();
    showSystemReveal(session.lastReveal);
    startTicker();
  }

  function continueSession() {
    var session = state.session;
    if (!session) return;
    if (session.blockIndex >= session.blocks.length - 1) {
      finalizeSession(true, null, "final_block_auto");
      return;
    }
    var fromBlockIndex = session.blockIndex;
    var feedbackGiven = (session.blockFeedback || []).some(function (entry) {
      return entry && entry.blockIndex === fromBlockIndex;
    });
    var now = Date.now();
    recordLearningEvent("block_continue", {
      fromBlockIndex: fromBlockIndex,
      toBlockIndex: fromBlockIndex + 1,
      blocksPlanned: session.blocks.length,
      secondsSinceBlockComplete: lastBlockCompletedAt ? Math.max(0, Math.round((now - lastBlockCompletedAt) / 1000)) : 0,
      secondsInReveal: revealShownAt ? Math.max(0, Math.round((now - revealShownAt) / 1000)) : 0,
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlaying: ambientIsPlaying(),
      noiseType: brownNoiseEnabled ? currentAmbientSound() : "",
      taskTitle: session.linkedTaskId && getTask(session.linkedTaskId) ? getTask(session.linkedTaskId).title : "",
      feedbackGiven: feedbackGiven
    });
    session.blockIndex += 1;
    session.blockRemaining = session.blocks[session.blockIndex];
    session.blockEndsAt = Date.now() + (session.blockRemaining * 1000);
    session.status = "running";
    session.recoveryRemaining = 0;
    session.recoveryEndsAt = null;
    closeReveal();
    saveState();
    startTicker();
    syncAmbientPlayback();
    renderAll();
    switchView("focus");
  }

  function recordSessionEnd(session, completedAll, reason, extra) {
    var feedback = session.blockFeedback || [];
    var lastFeedback = feedback.length ? feedback[feedback.length - 1] : null;
    var details = extra || {};
    recordLearningEvent("session_end", {
      startedAt: session.startedAt,
      endedAt: Date.now(),
      minutes: session.totalMinutes,
      blocksCompleted: session.blocksCompleted,
      blocksPlanned: session.blocks.length,
      blockIndex: session.blockIndex,
      partialBlock: Boolean(details.partialBlock),
      pauseCount: session.pauseCount || 0,
      xpEarned: session.xpEarned,
      penaltyXp: session.penaltyXp || 0,
      completedAll: Boolean(completedAll),
      endedBy: reason || "unknown",
      saved: Boolean(details.saved),
      taskTitle: session.linkedTaskId && getTask(session.linkedTaskId) ? getTask(session.linkedTaskId).title : "",
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlayingAtEnd: Boolean(details.noisePlayingAtEnd),
      noiseType: brownNoiseEnabled ? currentAmbientSound() : "",
      audioPlayedSeconds: Number.isFinite(Number(details.audioPlayedSeconds)) ? Number(details.audioPlayedSeconds) : ambientPlayedSeconds(),
      quickRestart: Boolean(session.quickRestart),
      previousSessionAudio: Boolean(session.previousSessionAudio),
      previousSessionCompletedAll: Boolean(session.previousSessionCompletedAll),
      gapSinceLastSessionSeconds: session.gapSinceLastSessionSeconds,
      blockFeedbackCount: feedback.length,
      lastFeeling: lastFeedback ? lastFeedback.feeling || "" : "",
      secondsInReveal: Number.isFinite(Number(details.secondsInReveal)) ? Number(details.secondsInReveal) : 0,
      secondsSinceBlockComplete: Number.isFinite(Number(details.secondsSinceBlockComplete)) ? Number(details.secondsSinceBlockComplete) : 0,
      source: session.source || ""
    });
  }

  function finalizeSession(completedAll, milestoneData, reason) {
    var session = state.session;
    if (!session) return;
    stopTicker();
    var noisePlayingAtEnd = ambientIsPlaying();
    var audioPlayedSeconds = ambientPlayedSeconds();
    var endedAt = Date.now();
    var secondsInReveal = revealShownAt ? Math.max(0, Math.round((endedAt - revealShownAt) / 1000)) : 0;
    var secondsSinceBlockComplete = lastBlockCompletedAt ? Math.max(0, Math.round((endedAt - lastBlockCompletedAt) / 1000)) : 0;
    stopAmbientSound();
    var currentDuration = session.blocks[session.blockIndex] || 0;
    var hasPartialProgress = session.status !== "recovery" && session.blockRemaining > 0 && session.blockRemaining < currentDuration;
    var endDetails = {
      partialBlock: hasPartialProgress,
      noisePlayingAtEnd: noisePlayingAtEnd,
      audioPlayedSeconds: audioPlayedSeconds,
      secondsInReveal: secondsInReveal,
      secondsSinceBlockComplete: secondsSinceBlockComplete
    };
    if (!completedAll && session.blocksCompleted < session.blocks.length && (session.blocksCompleted > 0 || hasPartialProgress)) {
      recordSessionEnd(session, false, reason || "saved_partial", Object.assign({}, endDetails, { saved: true }));
      saveIncompleteSession(session);
      state.session = null;
      revealShownAt = 0;
      lastBlockCompletedAt = 0;
      closeReveal();
      saveState();
      renderAll();
      switchView("focus");
      showToast("Saved. Continue it from Focus.");
      return;
    }
    if (!completedAll && !session.blocksCompleted && !hasPartialProgress) {
      recordSessionEnd(session, false, reason || "cleared", endDetails);
      state.session = null;
      revealShownAt = 0;
      lastBlockCompletedAt = 0;
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
      completedAt: endedAt,
      startedAt: session.startedAt,
      totalMinutes: session.totalMinutes,
      blocksCompleted: session.blocksCompleted,
      blocksPlanned: session.blocks.length,
      xpEarned: session.xpEarned,
      penaltyXp: session.penaltyXp || 0,
      pauseCount: session.pauseCount || 0,
      linkedTaskId: session.linkedTaskId,
      linkedTaskTitle: session.linkedTaskId && getTask(session.linkedTaskId) ? getTask(session.linkedTaskId).title : null,
      completedAll: Boolean(completedAll),
      endedBy: reason || "unknown",
      audioPlayedSeconds: audioPlayedSeconds,
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlayingAtEnd: noisePlayingAtEnd,
      noiseType: brownNoiseEnabled ? currentAmbientSound() : "",
      quickRestart: Boolean(session.quickRestart),
      blockFeedback: session.blockFeedback || []
    });
    recordSessionEnd(session, completedAll, reason || "unknown", endDetails);
    state.session = null;
    revealShownAt = 0;
    lastBlockCompletedAt = 0;
    closeReveal();
    saveState();
    renderAll();
    switchView("today");
    showToast(completedAll ? "Session complete. Progress saved." : "Progress saved.");
    queueMilestones(milestoneData);
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
      source: session.source,
      startedAt: session.startedAt,
      blocksCompleted: session.blocksCompleted,
      xpEarned: session.xpEarned,
      pauseCount: session.pauseCount || 0,
      penaltyXp: session.penaltyXp || 0,
      quickRestart: session.quickRestart,
      previousSessionAudio: session.previousSessionAudio,
      previousSessionCompletedAll: session.previousSessionCompletedAll,
      gapSinceLastSessionSeconds: session.gapSinceLastSessionSeconds,
      savedAt: Date.now(),
      lastReveal: session.lastReveal,
      blockFeedback: session.blockFeedback || []
    });
    if (!saved) return;
    recordLearningEvent("session_saved", {
      minutes: session.totalMinutes,
      blocksCompleted: session.blocksCompleted,
      blocksPlanned: session.blocks.length,
      noiseEnabled: Boolean(brownNoiseEnabled),
      noiseType: brownNoiseEnabled ? currentAmbientSound() : "",
      audioPlayedSeconds: ambientPlayedSeconds(),
      saved: true
    });
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
    revealShownAt = 0;
    lastBlockCompletedAt = 0;
    resetAmbientTracking();
    recordLearningEvent("session_resume", {
      resumedFromSaved: true,
      blockIndex: state.session.blockIndex,
      remainingSeconds: state.session.blockRemaining,
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlaying: ambientIsPlaying(),
      noiseType: brownNoiseEnabled ? currentAmbientSound() : ""
    });
    syncAmbientPlayback();
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
    var last = state.profile.lastActiveDate;
    var daysMissed = 0;
    if (last) {
      var d1 = parseDateKey(today);
      var d2 = parseDateKey(last);
      daysMissed = Math.max(0, Math.round((d1 - d2) / 86400000));
    }
    if (daysMissed === 0) return;
    if (daysMissed === 1) {
      state.profile.streak += 1;
      state.profile.momentum = Math.min(100, state.profile.momentum + 5);
    } else {
      state.profile.streak = 1;
      state.profile.momentum = Math.max(0, state.profile.momentum - daysMissed * 5);
    }
    state.profile.lastActiveDate = today;
    state.profile.momentumMissedDays = daysMissed;
  }

  function logDailyFocus(blockSeconds) {
    var today = todayStr();
    state.dailyBlockLog[today] = (state.dailyBlockLog[today] || 0) + 1;
    state.dailyFocusMinutes[today] = (state.dailyFocusMinutes[today] || 0) + Math.max(1, Math.round((Number(blockSeconds) || 0) / 60));
  }

  function awardDailyGoalBonus(beforeMinutes, afterMinutes) {
    var today = todayStr();
    if (!state.profile.goalBonus || typeof state.profile.goalBonus !== "object") state.profile.goalBonus = {};
    var record = state.profile.goalBonus[today];
    if (!record || typeof record !== "object") record = { reached: false, surpassed: false };
    var goal = Math.max(1, Number(state.profile.dailyGoalMinutes) || 60);
    var result = { xp: 0, messages: [], reached: false, surpassed: false };
    if (!record.reached && beforeMinutes < goal && afterMinutes >= goal) {
      record.reached = true;
      result.reached = true;
      result.xp += XP_GOAL_REACHED_BONUS;
      result.messages.push("Daily goal reached +" + XP_GOAL_REACHED_BONUS + " XP");
    }
    var surpassAt = Math.ceil(goal * GOAL_SURPASS_MULTIPLIER);
    if (!record.surpassed && beforeMinutes < surpassAt && afterMinutes >= surpassAt) {
      record.surpassed = true;
      result.surpassed = true;
      result.xp += XP_GOAL_SURPASSED_BONUS;
      result.messages.push("Goal surpassed +" + XP_GOAL_SURPASSED_BONUS + " XP");
    }
    state.profile.goalBonus[today] = record;
    var cutoff = addDaysKey(today, -14);
    Object.keys(state.profile.goalBonus).forEach(function (key) {
      if (key < cutoff) delete state.profile.goalBonus[key];
    });
    return result;
  }

  function recordBlockDecision(decision, data, feedback) {
    var session = state.session;
    if (!session) return;
    var now = Date.now();
    recordLearningEvent("block_decision", {
      decision: decision,
      blockIndex: session.blockIndex,
      blocksPlanned: session.blocks.length,
      isFinalBlock: Boolean(data && data.isFinalBlock),
      secondsInReveal: revealShownAt ? Math.max(0, Math.round((now - revealShownAt) / 1000)) : 0,
      secondsSinceBlockComplete: lastBlockCompletedAt ? Math.max(0, Math.round((now - lastBlockCompletedAt) / 1000)) : 0,
      noiseEnabled: Boolean(brownNoiseEnabled),
      noisePlaying: ambientIsPlaying(),
      noiseType: brownNoiseEnabled ? currentAmbientSound() : "",
      feedbackGiven: Boolean(feedback),
      taskTitle: session.linkedTaskId && getTask(session.linkedTaskId) ? getTask(session.linkedTaskId).title : ""
    });
  }

  function showSystemReveal(data) {
    if (!data || !revealOverlay) return;
    revealShownAt = Date.now();
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
    flags.innerHTML = (data.goalMessages || []).map(function (message) {
      return '<div class="reveal-flag goal-bonus">' + escapeHtml(message) + "</div>";
    }).join("");

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

    // Manual closes have no feedback panel, so collapse the desktop stage.
    revealOverlay.classList.toggle("is-single", Boolean(data.isManualDone));

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
      var feedback = captureBlockFeedback();
      recordBlockDecision("finish", data, feedback);
      finalizeSession(true, data, "finish_button");
    };
    if (cont) cont.onclick = function () {
      var feedback = captureBlockFeedback();
      recordBlockDecision("continue", data, feedback);
      continueSession();
    };
    if (stop) stop.onclick = function () {
      var feedback = captureBlockFeedback();
      recordBlockDecision("stop", data, feedback);
      finalizeSession(false, null, "stop_after_block");
    };
    if (close) close.onclick = function () {
      recordBlockDecision("close_manual", data, null);
      revealShownAt = 0;
      revealOverlay.classList.remove("open");
      queueMilestones(data);
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
    if (!feeling && !note) return null;
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
    return entry;
  }

  function closeReveal() {
    revealShownAt = 0;
    if (revealOverlay) revealOverlay.classList.remove("open");
  }

  function queueMilestones(data) {
    if (!data) return;
    if (data.leveledUp) milestoneQueue.push({ type: "level", data: data });
    if (data.rankedUpId) milestoneQueue.push({ type: "rank", data: data });
    showNextMilestone();
  }

  function showNextMilestone() {
    if (milestoneActive || !milestoneQueue.length) return;
    milestoneActive = true;
    var item = milestoneQueue.shift();
    var data = item.data;
    var rank = currentRank(data.newXp);
    var flags = document.getElementById("revealFlags");
    document.getElementById("revealXpGained").textContent = item.type === "rank" ? rank.name : "Level " + currentLevel(data.newXp);
    document.getElementById("revealRemaining").textContent = item.type === "rank"
      ? rank.desc
      : formatNumber(xpToNextLevel(data.newXp)) + " XP to next level";
    document.getElementById("revealTaskLine").textContent = item.type === "rank"
      ? "A new rank theme is now active."
      : "Your protected focus has raised your level.";
    document.getElementById("revealRankName").textContent = rank.name;
    document.getElementById("revealRankName").style.color = rank.color;
    document.getElementById("revealLevel").textContent = "Lv " + currentLevel(data.newXp);
    flags.innerHTML = '<div class="reveal-flag">' + (item.type === "rank" ? "Rank up" : "Level up") + "</div>";
    document.getElementById("blockFeedbackPanel").style.display = "none";
    document.getElementById("revealActions").innerHTML = '<button class="btn btn-primary btn-block" id="milestoneContinueBtn">' + (item.type === "rank" ? "Enter " + escapeHtml(rank.name) : "View progress") + "</button>";
    revealOverlay.classList.add("is-single");
    revealOverlay.classList.add("open");
    switchView("rank");
    document.getElementById("milestoneContinueBtn").onclick = function () {
      revealOverlay.classList.remove("open");
      milestoneActive = false;
      if (item.type === "rank") startRankUpgrade(rank);
      else showNextMilestone();
    };
  }

  function startRankUpgrade(rank) {
    var overlay = document.getElementById("rankUpgradeOverlay");
    var messages = ["Upgrading your interface...", "Increasing difficulty...", "Strengthening focus sessions...", "Recalibrating attention goals...", "Applying " + rank.name + " identity..."];
    var index = 0;
    var fill = document.getElementById("rankUpgradeFill");
    document.getElementById("rankUpgradeMark").textContent = rank.id;
    document.getElementById("rankUpgradeMark").style.color = rank.color;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    fill.style.transitionDuration = "30s";
    requestAnimationFrame(function () { fill.style.width = "100%"; });
    var interval = setInterval(function () {
      index = (index + 1) % messages.length;
      document.getElementById("rankUpgradeMessage").textContent = messages[index];
    }, 4200);
    function finish() {
      clearInterval(interval);
      clearTimeout(startRankUpgrade.timer);
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      fill.style.transitionDuration = "0s";
      fill.style.width = "0";
      milestoneActive = false;
      renderAll();
      showNextMilestone();
    }
    document.getElementById("rankUpgradeSkipBtn").onclick = finish;
    startRankUpgrade.timer = setTimeout(finish, 30000);
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

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
    backupDirty = false;
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

  function saveLocalSnapshot() {
    persistStateForExit();
    showToast("Saved to this device");
  }

  function feedbackDeliveryMode() {
    if (FEEDBACK_ENDPOINT.trim()) return "endpoint";
    if (SUPABASE_URL.trim() && SUPABASE_ANON_KEY.trim()) return "supabase";
    if (feedbackChannel === "email" && FEEDBACK_EMAIL.trim()) return "email";
    if (feedbackChannel === "whatsapp" && FEEDBACK_WHATSAPP.trim()) return "whatsapp";
    if (FEEDBACK_WHATSAPP.trim()) return "whatsapp";
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
        : mode === "whatsapp"
          ? "Opens WhatsApp with a ready-to-send message for the developer."
        : mode === "email"
          ? "Uses your email app to address the developer."
          : "Receiver not configured yet" + (pending ? " - " + pending + " saved locally" : "") + ".";
    }
    if (note) {
      note.textContent = mode === "endpoint"
        ? "This report will be sent to the configured DeeCadence developer receiver."
        : mode === "supabase"
          ? "This report will be saved to the configured Supabase table. Email delivery should be handled by an Edge Function or database trigger."
        : mode === "whatsapp"
          ? "Tap Send to WhatsApp. DeeCadence will open the chat with your message ready."
        : mode === "email"
          ? "Submitting opens a pre-addressed email draft. You remain in control of sending it."
          : "No receiver is configured yet. Submitting safely stores this report on this device.";
    }
  }

  function feedbackContextLines(context) {
    if (!context) return ["Context: Not included"];
    var lines = ["Context:"];
    function add(label, value) {
      if (value === undefined || value === null || value === "") return;
      lines.push("- " + label + ": " + value);
    }
    add("App version", context.appVersion);
    add("Current tab", context.view);
    add("Screen", context.screen);
    add("Viewport", context.viewport);
    add("Platform", context.platform);
    add("Language", context.locale);
    add("Timezone", context.timezone);
    add("Theme", context.theme);
    add("Reduced motion", typeof context.reducedMotion === "boolean" ? (context.reducedMotion ? "Yes" : "No") : "");
    add("Online", typeof context.online === "boolean" ? (context.online ? "Yes" : "No") : "");
    add("Rank", context.rank);
    add("Level", context.level);
    add("Streak", context.streak === undefined || context.streak === null ? "" : context.streak + " days");
    add("Daily goal", context.dailyGoalMinutes === undefined ? "" : formatMinutes(context.dailyGoalMinutes || 0));
    add("Current focus", context.focusState);
    add("Saved focus sessions", context.sessionCount);
    add("Saved tasks", context.taskCount);
    add("Total XP", context.totalXp);
    add("Focus in last 7 days", formatMinutes(context.focusMinutes7 || 0));
    add("Attention tests", context.attentionTests);
    return lines;
  }

  function formatFeedbackBody(payload) {
    return [
      "DeeCadence FEEDBACK — " + String(payload.type || "Other").toUpperCase(),
      "",
      "From: " + (payload.senderName || "Not provided"),
      "Sent: " + new Date(payload.sentAt).toLocaleString(),
      "Reply email: " + (payload.replyEmail || "Not provided"),
      "",
      "Message:",
      payload.message,
      "",
      feedbackContextLines(payload.context).join("\n")
    ].join("\n");
  }

  function feedbackPhoneDigits() {
    return visibleFeedbackPhone().replace(/[^\d]/g, "");
  }

  function visibleFeedbackPhone() {
    return FEEDBACK_WHATSAPP.trim() || "+2348085318908";
  }

  function visibleFeedbackEmail() {
    return FEEDBACK_EMAIL.trim() || "dominiqueglobal24@gmail.com";
  }

  function updateFeedbackDestination() {
    var mode = feedbackDeliveryMode();
    var mark = document.getElementById("feedbackDestinationMark");
    var label = document.getElementById("feedbackDestinationLabel");
    var value = document.getElementById("feedbackDestinationValue");
    if (!mark || !label || !value) return;
    if (mode === "email") {
      mark.textContent = "@";
      label.textContent = "To: DeeCadence by email";
      value.textContent = visibleFeedbackEmail();
      return;
    }
    if (mode === "whatsapp") {
      mark.textContent = "WA";
      label.textContent = "To: DeeCadence on WhatsApp";
      value.textContent = visibleFeedbackPhone();
      return;
    }
    if (mode === "endpoint" || mode === "supabase") {
      mark.textContent = "DC";
      label.textContent = "To: DeeCadence";
      value.textContent = "Secure feedback receiver";
      return;
    }
    mark.textContent = "DC";
    label.textContent = "To: This device";
    value.textContent = "Saved locally - no receiver configured";
  }

  function buildFeedbackPayload(options) {
    var opts = options || {};
    var nameInput = document.getElementById("feedbackNameInput");
    var messageInput = document.getElementById("feedbackMessageInput");
    var emailInput = document.getElementById("feedbackEmailInput");
    var contextInput = document.getElementById("feedbackContextInput");
    var message = messageInput ? messageInput.value.trim() : "";
    return {
      id: makeId("feedback"),
      type: feedbackType,
      senderName: nameInput ? nameInput.value.trim().slice(0, 60) : "",
      message: message || (opts.allowEmpty ? "No message typed yet." : ""),
      replyEmail: emailInput ? emailInput.value.trim().slice(0, 120) : "",
      sentAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      context: contextInput && contextInput.checked ? feedbackContextSnapshot() : null
    };
  }

  function resetFeedbackButton(button) {
    if (!button) return;
    var mode = feedbackDeliveryMode();
    button.disabled = false;
    button.textContent = mode === "whatsapp" ? "Send to WhatsApp" : mode === "email" ? "Send as Email" : "Send feedback";
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
    feedbackChannel = "whatsapp";
    var name = document.getElementById("feedbackNameInput");
    var message = document.getElementById("feedbackMessageInput");
    var email = document.getElementById("feedbackEmailInput");
    var submit = document.getElementById("feedbackSubmitBtn");
    if (name) {
      name.value = "";
      name.removeAttribute("aria-invalid");
    }
    if (message) message.value = "";
    if (email) email.value = "";
    resetFeedbackButton(submit);
    var count = document.getElementById("feedbackCharCount");
    if (count) count.textContent = "0";
    Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-type]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-feedback-type") === feedbackType);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-channel]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-feedback-channel") === feedbackChannel);
    });
    updateFeedbackDeliveryCopy();
    updateFeedbackDestination();
    feedbackModal.classList.add("open");
    setTimeout(function () { if (message) message.focus(); }, 80);
  }

  function closeFeedback() {
    if (feedbackModal) feedbackModal.classList.remove("open");
  }

  function feedbackContextSnapshot() {
    var minutesByDate = focusMinutesByDate();
    var focus7 = 0;
    for (var i = 0; i < 7; i += 1) focus7 += minutesByDate[addDaysKey(todayStr(), -i)] || 0;
    var timezone = "";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (error) {
      timezone = "";
    }
    return {
      appVersion: APP_VERSION,
      view: activeView,
      screen: window.screen ? window.screen.width + "x" + window.screen.height : "",
      viewport: window.innerWidth + "x" + window.innerHeight,
      platform: navigator.platform || "unknown",
      locale: navigator.language || "",
      timezone: timezone,
      online: navigator.onLine,
      theme: state.settings.theme,
      reducedMotion: state.settings.reducedMotion,
      rank: currentRank(state.profile.totalXp).name,
      level: currentLevel(state.profile.totalXp),
      streak: state.profile.streak,
      dailyGoalMinutes: state.profile.dailyGoalMinutes,
      focusState: state.session ? state.session.status : "idle",
      sessionCount: state.history.length,
      taskCount: state.tasks.length,
      totalXp: state.profile.totalXp,
      focusMinutes7: focus7,
      attentionTests: state.attentionTests.length
    };
  }

  function submitFeedback() {
    var nameInput = document.getElementById("feedbackNameInput");
    var senderName = nameInput ? nameInput.value.trim() : "";
    if (!senderName) {
      if (nameInput) {
        nameInput.setAttribute("aria-invalid", "true");
        nameInput.focus();
      }
      showToast("Add your name so the developer can follow up");
      return;
    }
    var message = document.getElementById("feedbackMessageInput").value.trim();
    if (message.length < 8) {
      showToast("Add a little more detail");
      return;
    }
    var payload = buildFeedbackPayload();
    var button = document.getElementById("feedbackSubmitBtn");
    var mode = feedbackDeliveryMode();
    button.disabled = true;
    button.textContent = "Sending...";
    if (mode === "whatsapp") {
      var phone = feedbackPhoneDigits();
      var whatsappBody = encodeURIComponent(formatFeedbackBody(payload));
      window.open("https://wa.me/" + phone + "?text=" + whatsappBody, "_blank", "noopener");
      closeFeedback();
      showToast("WhatsApp message prepared");
      resetFeedbackButton(button);
      return;
    }
    if (mode === "email") {
      var subject = encodeURIComponent(
        "[DeeCadence FEEDBACK — " + String(feedbackType).toUpperCase() + "] " +
        (payload.senderName || "Feedback") + " — " +
        new Date(payload.sentAt).toLocaleDateString()
      );
      var body = encodeURIComponent(formatFeedbackBody(payload));
      window.location.href = "mailto:" + visibleFeedbackEmail() + "?subject=" + subject + "&body=" + body;
      closeFeedback();
      showToast("Email draft opened");
      resetFeedbackButton(button);
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
          resetFeedbackButton(button);
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
          resetFeedbackButton(button);
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
    resetFeedbackButton(button);
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
      sender_name: payload.senderName || null,
      message: payload.message,
      reply_email: payload.replyEmail || null,
      app_version: payload.appVersion,
      context: payload.context || null,
      recipient_email: FEEDBACK_EMAIL || "dominiqueglobal24@gmail.com",
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
    document.getElementById("attentionTestBody").innerHTML =
      '<section class="test-result">' +
        '<div class="attention-kicker">' + (previous ? "New check saved" : "Starting baseline saved") + '</div>' +
        '<h3 id="attentionTestTitle">' + result.score + '<span class="score-denominator">/100</span></h3>' +
        '<p>' + (previous ? "That is " + (change >= 0 ? "+" : "") + change + " compared with your previous check." : "This is your personal starting point.") + ' Treat the pattern across several checks as useful, not one isolated score. The marker is a product guide, not a population or clinical norm.</p>' +
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

  function applyRankTheme(rank) {
    var activeRank = rank || currentRank(state.profile.totalXp);
    document.documentElement.setAttribute("data-rank", activeRank.id);
    document.body.setAttribute("data-rank", activeRank.id);
    document.documentElement.style.setProperty("--rank-accent", activeRank.color);
    document.documentElement.style.setProperty("--rank-glow-color", activeRank.color);
  }

  function renderRankConsole(prefix) {
    var xp = state.profile.totalXp;
    var level = currentLevel(xp);
    var rank = currentRank(xp);
    var next = nextRank(xp);
    var progress = levelProgress(xp);
    var circumference = 2 * Math.PI * 42;
    applyRankTheme(rank);

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

  function focusWindowFromHour(hour) {
    var value = Number(hour);
    if (!Number.isFinite(value)) return null;
    if (value >= 5 && value < 12) return "morning";
    if (value >= 12 && value < 17) return "afternoon";
    if (value >= 17 && value < 21) return "evening";
    return "late-night";
  }

  function focusWindowLabel(id) {
    if (id === "morning") return "Morning";
    if (id === "afternoon") return "Afternoon";
    if (id === "evening") return "Evening";
    if (id === "late-night") return "Late night";
    return "Not enough data";
  }

  function learnedFocusWindow(sourceState) {
    var data = sourceState || state;
    var buckets = {
      morning: { minutes: 0, sessions: 0 },
      afternoon: { minutes: 0, sessions: 0 },
      evening: { minutes: 0, sessions: 0 },
      "late-night": { minutes: 0, sessions: 0 }
    };

    (data.history || []).forEach(function (item) {
      if (!item || item.manualDone || !item.completedAt) return;
      var completed = Math.max(0, Number(item.blocksCompleted) || 0);
      if (!completed) return;
      var planned = Math.max(1, Number(item.blocksPlanned) || completed || 1);
      var minutes = Math.max(1, Math.round((Number(item.totalMinutes) || 0) * Math.min(1, completed / planned)));
      var hour = new Date(Number(item.completedAt)).getHours();
      var id = focusWindowFromHour(hour);
      if (!id) return;
      buckets[id].minutes += minutes;
      buckets[id].sessions += 1;
    });

    var best = Object.keys(buckets).map(function (id) {
      return { id: id, label: focusWindowLabel(id), minutes: buckets[id].minutes, sessions: buckets[id].sessions };
    }).sort(function (a, b) {
      return b.minutes - a.minutes || b.sessions - a.sessions;
    })[0];

    if (!best || !best.minutes) {
      return {
        id: state.onboarding && state.onboarding.focusWindow && state.onboarding.focusWindow !== "not-sure" ? state.onboarding.focusWindow : "not-sure",
        label: state.onboarding && state.onboarding.focusWindow && state.onboarding.focusWindow !== "not-sure" ? focusWindowLabel(state.onboarding.focusWindow) : "Not enough data",
        minutes: 0,
        sessions: 0,
        confidence: "Learning from completed blocks"
      };
    }

    return {
      id: best.id,
      label: best.label,
      minutes: best.minutes,
      sessions: best.sessions,
      confidence: best.sessions >= 5 ? "Strong pattern" : "Early pattern"
    };
  }

  function sustainableFocusProfile(sourceState) {
    var data = sourceState || state;
    var samples = [];
    var seenSessions = Object.create(null);
    var focusWindow = learnedFocusWindow(data);

    function sessionTimestamp(session) {
      return Number(session.completedAt || session.savedAt || session.startedAt || 0);
    }

    function addCompletedBlocks(session) {
      if (!session || session.manualDone) return;
      var identity = String(session.id || "");
      if (identity && seenSessions[identity]) return;
      if (identity) seenSessions[identity] = true;
      var completed = Math.max(0, parseInt(session.blocksCompleted, 10) || 0);
      if (!completed) return;
      var blockDurations = Array.isArray(session.blocks) ? session.blocks : null;
      var planned = Math.max(1, parseInt(session.blocksPlanned, 10) || (blockDurations ? blockDurations.length : 1));
      var averageMinutes = Math.max(1, Number(session.totalMinutes) || 0) / planned;
      for (var i = 0; i < Math.min(completed, planned); i += 1) {
        var minutes = blockDurations && Number(blockDurations[i]) > 0
          ? Number(blockDurations[i]) / 60
          : averageMinutes;
        samples.push(Math.max(1, Math.min(240, Math.round(minutes))));
      }
    }

    var sessions = [];
    if (data.session) sessions.push(data.session);
    sessions = sessions.concat(data.savedSessions || [], data.history || []);
    sessions
      .slice()
      .sort(function (a, b) { return sessionTimestamp(b) - sessionTimestamp(a); })
      .forEach(addCompletedBlocks);

    var completed = samples.length;
    var evidenceProgress = Math.min(100, Math.round((completed / 10) * 100));
    if (!completed) {
      return {
        sampleCount: 0,
        rangeLabel: "Not measured yet",
        recommendedMinutes: 5,
        evidenceText: "Complete three focus blocks to establish your starting range. DeeCadence also learns which time of day works best.",
        confidence: "Building evidence",
        evidenceProgress: 0,
        bestFocusWindow: focusWindow
      };
    }

    var ordered = samples.slice().sort(function (a, b) { return a - b; });
    var median = ordered[Math.floor((ordered.length - 1) / 2)];
    if (completed < 3) {
      return {
        sampleCount: completed,
        rangeLabel: median + " min observed",
        recommendedMinutes: Math.max(4, median),
        evidenceText: completed + " of 3 blocks completed. Keep the next block comfortable while DeeCadence learns your best focus window.",
        confidence: "Building evidence",
        evidenceProgress: evidenceProgress,
        bestFocusWindow: focusWindow
      };
    }

    var lowerRaw = ordered[Math.floor((ordered.length - 1) * 0.25)];
    var upperRaw = ordered[Math.ceil((ordered.length - 1) * 0.75)];
    var lower = Math.max(4, Math.floor(lowerRaw / 5) * 5);
    var upper = Math.max(lower, Math.ceil(upperRaw / 5) * 5);
    var recommended = Math.min(240, upper + (upper < 15 ? 2 : 5));
    var recentSessions = (data.history || []).filter(function (item) {
      return item && !item.manualDone && Number(item.blocksPlanned) > 0;
    }).slice(0, 5);
    var plannedTotal = recentSessions.reduce(function (sum, item) { return sum + Math.max(1, Number(item.blocksPlanned) || 1); }, 0);
    var completedTotal = recentSessions.reduce(function (sum, item) { return sum + Math.max(0, Number(item.blocksCompleted) || 0); }, 0);
    var completionRate = plannedTotal ? Math.round((completedTotal / plannedTotal) * 100) : 100;
    var label = lower === upper ? lower + " min" : lower + "-" + upper + " min";
    var confidence = completed >= 10 ? "Established range" : completed >= 6 ? "Emerging pattern" : "Early pattern";

    return {
      sampleCount: completed,
      rangeLabel: label,
      recommendedMinutes: recommended,
      evidenceText: "Calculated from all " + completed + " completed focus blocks saved on this device" + (recentSessions.length ? ". Recent session completion: " + completionRate + "%" : "") + ". Best window so far: " + focusWindow.label + ". Next stretch: " + recommended + " minutes.",
      confidence: confidence,
      evidenceProgress: evidenceProgress,
      bestFocusWindow: focusWindow
    };
  }

  function todayHeroText() {
    var setup = state.onboarding || defaultOnboarding();
    var target = String(setup.target || "").trim();
    if (target) {
      var displayTarget = target.length > 32 ? target.slice(0, 29).trim() + "..." : target;
      return {
        title: "Keep showing up for " + displayTarget + ".",
        body: "Start with one protected block. DeeCadence tracks the minutes you finish and grows your level from there."
      };
    }
    if (setup.purpose === "studying") {
      return {
        title: "Build study focus you can sustain.",
        body: "Add a subject, schedule a block, then let completed minutes show your attention getting stronger."
      };
    }
    if (setup.purpose === "coding") {
      return {
        title: "Protect one coding block at a time.",
        body: "Use the timer for deep build work, debugging, or practice. XP follows the minutes you finish."
      };
    }
    return {
      title: "Build focus you can actually sustain.",
      body: "DeeCadence learns from the blocks you finish, then helps you stretch your focus gradually instead of forcing a fixed timer."
    };
  }

  function renderTodayGreeting() {
    var now = new Date();
    var hour = now.getHours();
    var greeting = hour < 5 ? "Hello"
      : hour < 12 ? "Good morning"
      : hour < 17 ? "Good afternoon"
      : hour < 22 ? "Good evening"
      : "Welcome";
    var skyPhase = hour < 5 ? "night"
      : hour < 12 ? "morning"
      : hour < 17 ? "afternoon"
      : hour < 22 ? "evening"
      : "night";
    var greetingNode = document.getElementById("todayGreeting");
    var dateNode = document.getElementById("todayHeroDate");
    var skyIcon = document.getElementById("todaySkyIcon");
    if (greetingNode) greetingNode.textContent = greeting;
    if (skyIcon) skyIcon.setAttribute("data-phase", skyPhase);
    if (dateNode) {
      dateNode.textContent = now.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      });
      var year = now.getFullYear();
      var month = String(now.getMonth() + 1).padStart(2, "0");
      var day = String(now.getDate()).padStart(2, "0");
      dateNode.setAttribute("datetime", year + "-" + month + "-" + day);
    }
  }

  function renderToday() {
    var missed = state.profile.momentumMissedDays || 0;
    if (missed >= 3) {
      var wrap = document.getElementById("todayNextTaskWrap");
      if (wrap) {
        wrap.innerHTML = '<div class="recovery-hook" style="padding:16px; border:1px solid var(--border); border-radius:16px; background:color-mix(in srgb, var(--rank-accent) 10%, transparent); margin-bottom:16px;">' +
          '<div class="eyebrow" style="font-size:0.75rem; color:var(--rank-accent); text-transform:uppercase;">Momentum recovery</div>' +
          '<div style="font-size:1rem; color:var(--text); margin-bottom:8px;">Your focus momentum dipped to <strong>' + state.profile.momentum + '%</strong> after ' + missed + ' days away.</div>' +
          '<div style="font-size:0.85rem; color:var(--text-dim); margin-bottom:12px;">No guilt — just a warm-up to rebuild your rhythm.</div>' +
          '<button class="btn btn-primary" id="recoveryWarmupBtn" style="width:100%;">Start warm-up block</button></div>';
        document.getElementById("recoveryWarmupBtn").onclick = function () {
          switchView("focus");
          openStartModal(null, Math.max(5, Math.round(state.profile.momentum / 10)));
          showToast("Warm-up block: rebuild at your pace.");
        };
      }
    }
    var hero = todayHeroText();
    renderTodayGreeting();
    var heroTitle = document.getElementById("todayHeroTitle");
    var heroCopy = document.getElementById("todayHeroCopy");
    if (heroTitle) heroTitle.textContent = hero.title;
    if (heroCopy) heroCopy.textContent = hero.body;
    renderRankConsole("today");
    var capacity = sustainableFocusProfile();
    var capacityRange = document.getElementById("sustainableFocusRange");
    var capacityEvidence = document.getElementById("sustainableFocusEvidence");
    var capacityConfidence = document.getElementById("capacityConfidence");
    var capacityFill = document.getElementById("capacityEvidenceFill");
    var capacityButton = document.getElementById("startSuggestedFocusBtn");
    if (capacityRange) capacityRange.textContent = capacity.rangeLabel;
    if (capacityEvidence) capacityEvidence.textContent = capacity.evidenceText;
    if (capacityConfidence) capacityConfidence.textContent = capacity.confidence;
    if (capacityFill) capacityFill.style.width = capacity.evidenceProgress + "%";
    if (capacityButton) {
      capacityButton.textContent = state.session || state.savedSessions.length
        ? "Continue focus"
        : (capacity.sampleCount ? "Try " + capacity.recommendedMinutes + " min" : "Start with " + capacity.recommendedMinutes + " min");
    }
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

  function focusStageSignature(session) {
    return [session.id || "", session.status, session.blockIndex, session.blocks.length].join("|");
  }

  function refreshFocusStage(root, session) {
    var stage = root.querySelector(".focus-stage");
    if (!stage || stage.getAttribute("data-signature") !== focusStageSignature(session)) return false;
    var digits = stage.querySelector(".timer-digits");
    var center = stage.querySelector(".timer-center");
    if (!digits || !center) return false;
    if (session.status === "recovery") {
      var recoveryClock = stage.querySelector(".recovery-note strong");
      if (recoveryClock) recoveryClock.textContent = fmtClock(session.recoveryRemaining);
      return true;
    }
    var blockTotal = session.blocks[session.blockIndex] || 1;
    var progress = Math.max(0, Math.min(1, (blockTotal - session.blockRemaining) / blockTotal));
    var ring = stage.querySelector(".timer-ring-progress");
    digits.textContent = fmtClock(session.blockRemaining);
    center.setAttribute("aria-label", fmtClock(session.blockRemaining) + " remaining in current block");
    if (ring) ring.setAttribute("stroke-dashoffset", String((2 * Math.PI * 118) * (1 - progress)));
    return true;
  }

  function renderFocus() {
    var root = document.getElementById("focusRoot");
    var session = state.session;
    if (!session) {
      var savedHtml = renderSavedSessions();
      root.innerHTML = savedHtml || '<section class="card empty-focus"><span class="attention-kicker">Your next protected block</span><h2>Start from what you can sustain today.</h2><p>Choose a real task, a comfortable total duration, and one to four blocks. DeeCadence will only show the block in front of you.</p><button class="btn btn-primary" id="focusStartFromEmpty">Set up a focus block</button></section>';
      var startEmpty = document.getElementById("focusStartFromEmpty");
      if (startEmpty) startEmpty.onclick = function () { openStartModal(null, sustainableFocusProfile().recommendedMinutes, "input"); };
      Array.prototype.forEach.call(root.querySelectorAll("[data-continue-saved-session]"), function (button) {
        button.onclick = function () { continueSavedSession(button.getAttribute("data-continue-saved-session")); };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-discard-saved-session]"), function (button) {
        button.onclick = function () { discardSavedSession(button.getAttribute("data-discard-saved-session")); };
      });
      renderSessionIndicators();
      return;
    }

    if (refreshFocusStage(root, session)) {
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
    var taskName = linkedTask ? escapeHtml(linkedTask.title) : "Free focus";
    var html = '<section class="card focus-stage" data-focus-status="' + session.status + '" data-signature="' + focusStageSignature(session) + '"><header class="focus-stage-head"><div><span class="attention-kicker">' + (session.status === "recovery" ? "Block secured" : "Protected focus") + '</span><h2>' + taskName + '</h2></div><div class="focus-stage-progress"><span>' + statusLabel + '</span><div class="block-indicator" aria-hidden="true">' + pips + "</div></div></header>";

    if (session.status === "recovery") {
      html += '<div class="timer-ring-wrap"><svg viewBox="0 0 260 260"><circle class="timer-ring-track" cx="130" cy="130" r="118" fill="none" stroke="var(--surface-2)" stroke-width="10"/><circle class="timer-ring-progress" cx="130" cy="130" r="118" fill="none" stroke="var(--success)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="0"/></svg><div class="timer-center"><div class="timer-digits mono">Saved</div><div class="timer-caption">Block ' + (session.blockIndex + 1) + " complete</div></div></div>";
      html += '<div class="focus-linked">' + (linkedTask ? "Progress saved to this task." : "Free focus block logged.") + "</div>";
      html += '<div class="recovery-note"><span>Recovery window</span><strong>' + fmtClock(session.recoveryRemaining) + "</strong><small>The next block will wait for your confirmation.</small></div>";
      html += '<div class="focus-controls"><button class="btn btn-primary" id="reopenReveal">View result</button><button class="btn btn-ghost" id="stopBtn">Stop and save</button></div>';
    } else {
      html += '<div class="timer-ring-wrap"><svg viewBox="0 0 260 260"><circle class="timer-ring-track" cx="130" cy="130" r="118" fill="none" stroke="var(--surface-2)" stroke-width="10"/><circle class="timer-ring-progress" cx="130" cy="130" r="118" fill="none" stroke="var(--cyan)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + (circumference * (1 - progress)) + '"/></svg><div class="timer-center" role="timer" aria-label="' + fmtClock(session.blockRemaining) + ' remaining in current block"><div class="timer-digits mono">' + fmtClock(session.blockRemaining) + '</div><div class="timer-caption">' + statusLabel + "</div></div></div>";
      html += '<div class="focus-linked">' + (session.status === "running" ? "Stay with this one block. Everything else can wait." : "Your remaining time is saved on this device.") + "</div>";
      if (session.status === "paused") {
        html += '<div class="paused-session-card"><strong>Most recently paused block</strong><span>Block ' + (session.blockIndex + 1) + " is waiting with " + fmtClock(session.blockRemaining) + " left.</span></div>";
      }
      html += '<div class="focus-controls">' + (session.status === "running" ? '<button class="btn btn-secondary" id="pauseBtn">Pause</button>' : '<button class="btn btn-primary" id="resumeBtn">Continue paused block</button>') + '<button class="btn btn-secondary" id="stopBtn">Stop and save</button></div>';
    }
    root.innerHTML = html + "</section>";

    var pause = document.getElementById("pauseBtn");
    var resume = document.getElementById("resumeBtn");
    var stop = document.getElementById("stopBtn");
    var reopen = document.getElementById("reopenReveal");
    if (pause) pause.onclick = pauseSession;
    if (resume) resume.onclick = resumeSession;
    if (stop) stop.onclick = function () { finalizeSession(false, null, "stop_from_focus"); };
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
      var isActive = button.getAttribute("data-plan-mode") === currentPlanMode;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function syncPlanTabButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-planview]"), function (button) {
      var isActive = button.getAttribute("data-planview") === currentPlanTab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
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
    var pending = list.filter(function (task) { return task.status !== "completed"; });
    var done = list.filter(function (task) { return task.status === "completed"; });
    root.innerHTML = '<div class="task-list-stack">' +
      '<div class="task-list-heading"><span>Ready</span><small>' + pending.length + '</small></div>' +
      (pending.length ? pending.map(renderTaskCard).join("") : '<div class="task-list-empty">No pending tasks in this view.</div>') +
      '<details class="task-done-group"><summary><span>Done</span><small>' + done.length + '</small></summary>' +
      '<div class="task-done-list">' + (done.length ? done.map(renderTaskCard).join("") : '<div class="task-list-empty">Nothing completed here yet.</div>') + '</div></details>' +
      "</div>";
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

    root.innerHTML = '<section class="schedule-shell schedule-main"><div class="schedule-head"><div><div class="eyebrow">Today schedule</div><h3>' + formatReadableDate(todayStr()) + '</h3></div><div class="schedule-head-actions"><span>00:00 - 23:59 - ' + timed.length + " block" + (timed.length === 1 ? "" : "s") + '</span><div><button type="button" data-schedule-jump="start">Start</button><button type="button" data-schedule-jump="now">Now</button></div></div></div><div class="schedule-scroll"><div class="schedule-timeline" style="height:' + timelineHeight + 'px"><div class="schedule-hours">' + hours.join("") + '</div><div class="schedule-block-layer">' + renderNowLine(todayStr(), pxPerMinute, SCHEDULE_START_MINUTES, SCHEDULE_END_MINUTES) + (blocks || '<div class="schedule-empty-timeline">No scheduled blocks yet. Add a time or use Auto-arrange.</div>') + '</div></div></div></section>';
    var scheduleScroll = root.querySelector(".schedule-scroll");
    var jumpStart = root.querySelector('[data-schedule-jump="start"]');
    var jumpNow = root.querySelector('[data-schedule-jump="now"]');
    if (jumpStart) jumpStart.onclick = function () { scheduleScroll.scrollTo({ top: 0, behavior: "smooth" }); };
    if (jumpNow) jumpNow.onclick = function () {
      var now = new Date();
      var minute = (now.getHours() * 60) + now.getMinutes();
      scheduleScroll.scrollTo({ top: Math.max(0, (minute * pxPerMinute) - (scheduleScroll.clientHeight * 0.35)), behavior: "smooth" });
    };
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
    var today = todayStr();
    // Weeks start on Sunday. Show the current Sunday-to-Saturday week so the
    // week view matches the repeat-day picker and the calendar people expect.
    var start = addDaysKey(today, -parseDateKey(today).getDay());
    var days = [];
    for (var i = 0; i < 7; i += 1) days.push(addDaysKey(start, i));
    root.innerHTML = '<section class="schedule-shell"><div class="schedule-head"><div><div class="eyebrow">Week schedule</div><h3>This week</h3></div><span>Sunday to Saturday</span></div><div class="schedule-week-grid">' + days.map(function (date) {
      var dayTasks = state.tasks.filter(function (task) { return task.date === date && task.status !== "completed"; }).sort(sortTasksForPlan);
      return '<article class="schedule-day-card' + (date === today ? " is-today" : "") + '"><div class="schedule-day-head"><strong>' + shortDayLabel(date) + '</strong><span>' + dayTasks.length + " task" + (dayTasks.length === 1 ? "" : "s") + '</span></div>' + (dayTasks.length ? dayTasks.map(renderMiniScheduleBlock).join("") : '<p>No blocks</p>') + '</article>';
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
      createNextRecurringTask(task);
      recordLearningEvent("task_done", {
        taskId: task.id,
        title: task.title,
        estMinutes: task.estMinutes,
        units: task.units.total,
        time: task.time || "",
        repeat: task.repeat
      });
      showXpFloat(xpAward);
    }
    saveState();
    renderAll();
    if (shouldAward && (detectLevelUp(prevXp, state.profile.totalXp) || detectRankUp(prevXp, state.profile.totalXp))) {
      queueMilestones({
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
    setTimeout(updateRankLadderArrows, 0);
  }

  function updateRankLadderArrows() {
    var ladder = document.getElementById("rankLadder");
    var previous = document.getElementById("rankLadderPrev");
    var next = document.getElementById("rankLadderNext");
    if (!ladder || !previous || !next) return;
    var maxScroll = Math.max(0, (Number(ladder.scrollWidth) || 0) - (Number(ladder.clientWidth) || 0));
    previous.disabled = (Number(ladder.scrollLeft) || 0) <= 2;
    next.disabled = maxScroll <= 2 || (Number(ladder.scrollLeft) || 0) >= maxScroll - 2;
  }

  function scrollRankLadder(direction) {
    var ladder = document.getElementById("rankLadder");
    if (!ladder) return;
    var distance = Math.max(220, Math.round((Number(ladder.clientWidth) || 320) * 0.72));
    if (typeof ladder.scrollBy === "function") {
      ladder.scrollBy({
        left: (direction < 0 ? -1 : 1) * distance,
        behavior: state.settings.reducedMotion ? "auto" : "smooth"
      });
    } else {
      ladder.scrollLeft = (Number(ladder.scrollLeft) || 0) + ((direction < 0 ? -1 : 1) * distance);
    }
    setTimeout(updateRankLadderArrows, state.settings.reducedMotion ? 0 : 260);
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

  function focusSessionsByDate() {
    var byDate = {};
    state.history.forEach(function (item) {
      if (!item || item.manualDone) return;
      var key = item.date && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date))
        ? item.date
        : localDateKey(new Date(item.completedAt || Date.now()));
      byDate[key] = (byDate[key] || 0) + 1;
    });
    return byDate;
  }

  function progressDayMeta(day, goal) {
    if (!day || day.future) return "Upcoming";
    var parts = [];
    if (!day.minutes) parts.push("No focus logged");
    if (day.sessions) parts.push(day.sessions + " session" + (day.sessions === 1 ? "" : "s"));
    if (day.minutes >= goal) parts.push("goal reached");
    else parts.push(Math.max(0, goal - day.minutes) + "m to goal");
    return parts.join(" \u00b7 ");
  }

  function progressDayTip(day, goal) {
    var dateValue = new Date(day.date + "T00:00:00");
    var shortDate = dateValue.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    var meta = progressDayMeta(day, goal);
    return '<span class="cadence-tip" aria-hidden="true">' +
      '<span class="cadence-tip-date">' + escapeHtml(shortDate) + '</span>' +
      '<strong>' + (day.future ? "Coming up" : formatMinutesCompact(day.minutes) + ' focused') + '</strong>' +
      '<span class="cadence-tip-meta">' + escapeHtml(meta) + '</span>' +
    '</span>';
  }

  function renderCadenceChart(days, maxMinutes) {
    if (!days.length) return "";
    var goal = Math.max(15, Number(state.profile.dailyGoalMinutes) || 60);
    var max = Math.max(1, Number(maxMinutes) || goal);
    var selectedDate = selectedProgressDate || (days[days.length - 1] || {}).date;
    var selected = days.find(function (day) { return day.date === selectedDate; }) || days[days.length - 1];
    var selectedFullDate = new Date(selected.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    var selectedMeta = progressDayMeta(selected, goal);
    var total = days.reduce(function (sum, day) { return sum + day.minutes; }, 0);
    var goalRatio = Math.max(4, Math.min(100, Math.round((goal / max) * 100)));
    var labelStep = days.length <= 7 ? 1 : days.length <= 14 ? 2 : 5;
    var chartClass = days.length <= 3 ? 3 : days.length <= 7 ? 7 : days.length <= 21 ? 14 : 30;
    var columns = days.map(function (day, index) {
      var height = Math.max(0, Math.min(100, Math.round((day.minutes / max) * 100)));
      var isZero = !day.minutes;
      var isFuture = Boolean(day.future);
      var isSelected = day.date === selectedDate;
      var showLabel = index === 0 || index === days.length - 1 || index % labelStep === 0;
      var dateValue = new Date(day.date + "T00:00:00");
      var dayLabel = dateValue.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
      var fullDate = dateValue.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      var meta = progressDayMeta(day, goal);
      return '<button type="button" class="cadence-col' + (isZero ? " is-zero" : "") + (isFuture ? " is-future" : "") + (isSelected ? " active" : "") + '" data-progress-day="' + day.date + '"' + (isFuture ? ' aria-disabled="true"' : "") + ' style="--h:' + height + '%" aria-pressed="' + (isSelected ? "true" : "false") + '" aria-label="' + escapeHtml(fullDate) + ": " + (isFuture ? "coming up" : formatMinutesCompact(day.minutes) + " focused. " + meta) + '">' +
        progressDayTip(day, goal) +
        '<span class="cadence-bar" aria-hidden="true"></span>' +
        (showLabel ? '<span class="cadence-day" aria-hidden="true">' + dayLabel + '</span>' : "") +
      '</button>';
    }).join("");
    return '<div class="progress-attention-chart cadence-chart-' + chartClass + '" aria-label="' + days.length + ' day focus cadence">' +
      '<div class="progress-chart-head"><div><span>Selected day</span><strong>' + escapeHtml(selectedFullDate) + '</strong><small class="progress-selected-meta">' + escapeHtml(selectedMeta) + '</small></div><b>' + formatMinutesCompact(selected.minutes) + ' focused</b></div>' +
      '<div class="progress-graph-stage cadence-stage">' +
        '<div class="cadence-plot" style="--goal:' + goalRatio + '%">' +
          '<div class="cadence-goal" aria-hidden="true"><span>Goal ' + goal + 'm</span></div>' +
          '<div class="cadence-bars">' + columns + '</div>' +
        '</div>' +
        (total ? "" : '<p class="cadence-empty">No protected focus in this ' + days.length + '-day window yet.</p>') +
      '</div>' +
    '</div>';
  }

  function renderLineChart(days, maxMinutes) {
    if (!days.length) return "";
    var goal = Math.max(15, Number(state.profile.dailyGoalMinutes) || 60);
    var dataMax = Math.max(1, Number(maxMinutes) || goal);
    // A little headroom keeps peaks clear of the card edge without flattening
    // quiet weeks. The goal rule stays readable at every range.
    var scaleMax = Math.max(goal, dataMax) * 1.12;
    var selectedDate = selectedProgressDate || (days[days.length - 1] || {}).date;
    var selected = days.find(function (day) { return day.date === selectedDate; }) || days[days.length - 1];
    var selectedFullDate = new Date(selected.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    var selectedMeta = progressDayMeta(selected, goal);
    var total = days.reduce(function (sum, day) { return sum + day.minutes; }, 0);
    var goalRatio = Math.max(2, Math.min(98, (goal / scaleMax) * 100));
    var labelStep = days.length <= 7 ? 1 : days.length <= 14 ? 2 : 5;
    var chartClass = days.length <= 3 ? 3 : days.length <= 7 ? 7 : days.length <= 21 ? 14 : 30;
    var axis = days.map(function (day, index) {
      var x = days.length === 1 ? 50 : (index / (days.length - 1)) * 100;
      var y = Math.max(0, Math.min(100, (day.minutes / scaleMax) * 100));
      return { day: day, index: index, x: x, y: y };
    });
    var plotted = axis.filter(function (entry) { return !entry.day.future; });
    var points = plotted.map(function (entry) {
      var day = entry.day;
      var isZero = !day.minutes;
      var isSelected = day.date === selectedDate;
      var dateValue = new Date(day.date + "T00:00:00");
      var fullDate = dateValue.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      var meta = progressDayMeta(day, goal);
      var edgeClass = entry.index === 0 ? " is-first" : entry.index === days.length - 1 ? " is-last" : "";
      return '<button type="button" class="line-point' + (isZero ? " is-zero" : "") + (isSelected ? " active" : "") + edgeClass + '" data-progress-day="' + day.date + '" style="left:' + entry.x.toFixed(3) + '%;bottom:' + entry.y.toFixed(3) + '%" aria-pressed="' + (isSelected ? "true" : "false") + '" aria-label="' + escapeHtml(fullDate) + ": " + formatMinutesCompact(day.minutes) + ' focused. ' + meta + '">' +
        '<span class="line-dot" aria-hidden="true"></span>' +
        progressDayTip(day, goal) +
      '</button>';
    }).join("");
    var labels = axis.filter(function (entry) {
      return entry.index === 0 || entry.index === days.length - 1 || entry.index % labelStep === 0;
    }).map(function (entry) {
      var dateValue = new Date(entry.day.date + "T00:00:00");
      var dayLabel = dateValue.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
      var align = entry.index === 0 ? " is-start" : entry.index === days.length - 1 ? " is-end" : "";
      return '<span class="line-day' + align + '" style="left:' + entry.x.toFixed(3) + '%" aria-hidden="true">' + dayLabel + "</span>";
    }).join("");
    var svgPoints = plotted.map(function (entry) {
      var x = days.length === 1 ? 500 : (entry.index / (days.length - 1)) * 1000;
      var y = 100 - Math.max(0, Math.min(100, (entry.day.minutes / scaleMax) * 100));
      return x.toFixed(2) + "," + y.toFixed(2);
    }).join(" ");
    var areaEndX = plotted.length && days.length > 1 ? (plotted[plotted.length - 1].index / (days.length - 1)) * 1000 : 1000;
    var areaPoints = "0,100 " + svgPoints + " " + areaEndX.toFixed(2) + ",100";
    return '<div class="progress-attention-chart line-chart line-chart-' + chartClass + '" aria-label="' + days.length + ' day focus line chart">' +
      '<div class="progress-chart-head"><div><span>Selected day</span><strong>' + escapeHtml(selectedFullDate) + '</strong><small class="progress-selected-meta">' + escapeHtml(selectedMeta) + '</small></div><b>' + formatMinutesCompact(selected.minutes) + ' focused</b></div>' +
      '<div class="progress-graph-stage line-stage">' +
        '<div class="line-plot" style="--goal:' + goalRatio.toFixed(2) + '%">' +
          '<div class="line-grid" aria-hidden="true"><i style="bottom:25%"></i><i style="bottom:50%"></i><i style="bottom:75%"></i></div>' +
          '<div class="cadence-goal" aria-hidden="true"><span>Goal ' + goal + 'm</span></div>' +
          '<svg class="line-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><polygon class="line-area" points="' + areaPoints + '"/><polyline class="line-path" points="' + svgPoints + '"/></svg>' +
          points +
          '<div class="line-days" aria-hidden="true">' + labels + '</div>' +
        '</div>' +
        (total ? "" : '<p class="cadence-empty">No protected focus in this ' + days.length + '-day window yet.</p>') +
      '</div>' +
    '</div>';
  }

  function renderHeatmapChart(days) {
    if (!days.length) return "";
    var goal = Math.max(15, Number(state.profile.dailyGoalMinutes) || 60);
    var selectedDate = selectedProgressDate || (days[days.length - 1] || {}).date;
    var selected = days.find(function (day) { return day.date === selectedDate; }) || days[days.length - 1];
    var selectedFullDate = new Date(selected.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    var selectedMeta = progressDayMeta(selected, goal);
    var total = days.reduce(function (sum, day) { return sum + day.minutes; }, 0);
    var startWeekday = new Date(days[0].date + "T00:00:00").getDay();
    var cells = [];
    var weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function heatmapMinutes(minutes) {
      if (!minutes) return "";
      if (minutes >= 60) {
        var hours = Math.round((minutes / 60) * 10) / 10;
        return (hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)) + "h";
      }
      return Math.round(minutes) + "m";
    }

    for (var blank = 0; blank < startWeekday; blank += 1) {
      cells.push('<span class="heatmap-cell is-empty" aria-hidden="true"></span>');
    }

    days.forEach(function (day, index) {
      var dateValue = new Date(day.date + "T00:00:00");
      var weekday = dateValue.getDay();
      var rowIndex = Math.floor((startWeekday + index) / 7);
      var isSelected = day.date === selectedDate;
      var intensity = !day.minutes ? 0 : Math.min(4, Math.ceil((day.minutes / goal) * 4));
      var fullDate = dateValue.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      var meta = progressDayMeta(day, goal);
      var classes = [
        "heatmap-cell",
        "heatmap-level-" + intensity,
        weekday === 0 ? "is-sun" : "",
        weekday === 6 ? "is-sat" : "",
        rowIndex === 0 ? "is-top-row" : "",
        isSelected ? "active" : "",
        day.future ? "is-future" : ""
      ].filter(Boolean).join(" ");
      cells.push(
        '<button type="button" class="' + classes + '" data-progress-day="' + day.date + '"' +
          (day.future ? ' aria-disabled="true"' : "") +
          ' aria-pressed="' + (isSelected ? "true" : "false") + '"' +
          ' aria-label="' + escapeHtml(fullDate) + ": " + (day.future ? "coming up" : formatMinutesCompact(day.minutes) + " focused. " + meta) + '">' +
          '<span class="heatmap-date">' + dateValue.getDate() + '</span>' +
          (day.minutes ? '<span class="heatmap-value">' + heatmapMinutes(day.minutes) + '</span>' : "") +
          progressDayTip(day, goal) +
        '</button>'
      );
    });

    while (cells.length % 7 !== 0) {
      cells.push('<span class="heatmap-cell is-empty" aria-hidden="true"></span>');
    }

    return '<div class="progress-attention-chart heatmap-chart" aria-label="30 day focus calendar">' +
      '<div class="progress-chart-head"><div><span>Selected day</span><strong>' + escapeHtml(selectedFullDate) + '</strong><small class="progress-selected-meta">' + escapeHtml(selectedMeta) + '</small></div><b>' + formatMinutesCompact(selected.minutes) + ' focused</b></div>' +
      '<div class="heatmap-stage">' +
        '<div class="heatmap-weekdays" aria-hidden="true">' + weekdayLabels.map(function (label) {
          return '<span>' + label + '</span>';
        }).join("") + '</div>' +
        '<div class="heatmap-grid">' + cells.join("") + '</div>' +
        '<div class="heatmap-legend" aria-hidden="true"><span>Less</span><i class="heatmap-level-0"></i><i class="heatmap-level-1"></i><i class="heatmap-level-2"></i><i class="heatmap-level-3"></i><i class="heatmap-level-4"></i><span>More</span></div>' +
        (total ? "" : '<p class="heatmap-empty">No protected focus in this 30-day window yet. Select any day to inspect it.</p>') +
      '</div>' +
    '</div>';
  }

  function progressInsights(days) {
    // Future days in the Sunday-first week view are placeholders, not missed days.
    var elapsed = days.filter(function (day) { return !day.future; });
    if (!elapsed.length) elapsed = days;
    var total = elapsed.reduce(function (sum, day) { return sum + day.minutes; }, 0);
    var active = elapsed.filter(function (day) { return day.minutes > 0; });
    var goal = Math.max(15, Number(state.profile.dailyGoalMinutes) || 60);
    var goalDays = elapsed.filter(function (day) { return day.minutes >= goal; }).length;
    var strongest = elapsed.reduce(function (best, day) {
      return !best || day.minutes > best.minutes ? day : best;
    }, null);
    var midpoint = Math.max(1, Math.floor(elapsed.length / 2));
    var first = elapsed.slice(0, midpoint);
    var second = elapsed.slice(midpoint);
    var firstAverage = first.reduce(function (sum, day) { return sum + day.minutes; }, 0) / Math.max(1, first.length);
    var secondAverage = second.reduce(function (sum, day) { return sum + day.minutes; }, 0) / Math.max(1, second.length);
    var activeRatio = active.length / Math.max(1, elapsed.length);
    var cadenceText = !active.length
      ? "No protected focus is recorded in this window yet."
      : activeRatio >= 0.7
        ? "Your focus is repeating across most days in this window."
        : activeRatio >= 0.4
          ? "Your cadence is forming. A few more active days would make it steadier."
          : "Your focus is concentrated on a small number of days. Short repeatable blocks can smooth the pattern.";
    var trendText;
    var trendValue;
    if (!total) {
      trendValue = "No trend yet";
      trendText = "Complete a focus block to create the first comparison.";
    } else if (!firstAverage && secondAverage) {
      trendValue = "Activity started";
      trendText = "All recorded focus in this window happened in its more recent half.";
    } else {
      var change = firstAverage ? Math.round(((secondAverage - firstAverage) / firstAverage) * 100) : 0;
      trendValue = change > 0 ? "+" + change + "%" : change + "%";
      trendText = Math.abs(change) < 8
        ? "Your daily average is holding steady across this window."
        : change > 0
          ? "Your recent daily average is higher than the earlier half."
          : "Your recent daily average is lower than the earlier half. Reduce the next block if recovery would help.";
    }
    var strongestLabel = strongest && strongest.minutes
      ? new Date(strongest.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" })
      : "No active day";
    return [
      {
        label: "Cadence",
        value: active.length + "/" + elapsed.length + " active days",
        text: cadenceText
      },
      {
        label: "Momentum",
        value: trendValue,
        text: trendText
      },
      {
        label: "Strongest day",
        value: strongestLabel,
        text: strongest && strongest.minutes
          ? formatMinutesCompact(strongest.minutes) + " focused. " + goalDays + " day" + (goalDays === 1 ? "" : "s") + " reached your " + goal + " minute goal."
          : "No day has protected focus in this window yet."
      }
    ];
  }

  function wireProgressChart(days) {
    var selected = days.find(function (day) { return day.date === selectedProgressDate; }) || days[days.length - 1];
    if (!selected) return;
    selectedProgressDate = selected.date;
    var progressRoot = document.getElementById("view-progress");
    if (!progressRoot) return;
    Array.prototype.forEach.call(progressRoot.querySelectorAll("[data-progress-day]"), function (button) {
      button.onclick = function () {
        if (button.getAttribute("aria-disabled") === "true") return;
        selectedProgressDate = button.getAttribute("data-progress-day");
        renderProgress();
      };
    });
  }

  function renderPersonalSetup() {
    var root = document.getElementById("personalSetupCard");
    if (!root) return;
    var setup = normalizeOnboarding(state.onboarding);
    var purpose = PERSONAL_PURPOSE_LABELS[setup.purpose] || "";
    var windowLabel = setup.focusWindow && setup.focusWindow !== "not-sure" ? focusWindowLabel(setup.focusWindow) : "";
    var lengthLabel = PERSONAL_LENGTH_LABELS[String(setup.focusLength)] || "";
    var title = setup.target ? "Built around " + setup.target + "." : "Tell DeeCadence what matters now.";
    var details = [];
    if (purpose) details.push("Protecting attention for " + purpose.toLowerCase());
    if (windowLabel) details.push("best focus window: " + windowLabel.toLowerCase());
    if (lengthLabel) details.push("natural block: " + lengthLabel);
    if (setup.challenge) details.push("hard part: " + setup.challenge);
    if (setup.goal) details.push("next goal: " + setup.goal);
    var summary = details.length
      ? details.join(". ") + "."
      : "A few optional answers shape task suggestions, first-block length, and focus-window guidance.";
    var tags = [];
    if (purpose) tags.push(purpose);
    if (windowLabel) tags.push(windowLabel);
    if (lengthLabel) tags.push(lengthLabel);
    if (PERSONAL_DISTRACTION_LABELS[setup.distraction]) tags.push(PERSONAL_DISTRACTION_LABELS[setup.distraction]);
    root.innerHTML =
      '<div class="personal-setup-copy">' +
        '<div class="eyebrow">Personal setup</div>' +
        '<h3>' + escapeHtml(title) + '</h3>' +
        '<p>' + escapeHtml(summary) + '</p>' +
        (tags.length ? '<div class="personal-setup-tags">' + tags.map(function (tag) {
          return '<span>' + escapeHtml(tag) + '</span>';
        }).join("") + '</div>' : "") +
      '</div>' +
      '<button class="btn btn-secondary" type="button" id="openPersonalizeBtn">' +
        (purpose || setup.target || setup.focusLength ? "Refine setup" : "Set up") +
      '</button>';
    var open = document.getElementById("openPersonalizeBtn");
    if (open) open.onclick = openPersonalize;
  }

  function personalizeCopy() {
    return ONBOARDING_PURPOSE_COPY[personalizeDraft && personalizeDraft.purpose] || {
      targetLabel: "Focus area",
      targetPlaceholder: "e.g. Physics, client work, JavaScript",
      challengeLabel: "Hardest part",
      challengePlaceholder: "e.g. Past questions, outreach, algorithms",
      goalLabel: "Next goal",
      goalPlaceholder: "e.g. Finish the first chapter"
    };
  }

  function syncPersonalizeForm() {
    if (!personalizeModal || !personalizeDraft) return;
    Array.prototype.forEach.call(personalizeModal.querySelectorAll("[data-personalize-purpose]"), function (button) {
      var active = button.getAttribute("data-personalize-purpose") === personalizeDraft.purpose;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    Array.prototype.forEach.call(personalizeModal.querySelectorAll("[data-personalize-window]"), function (button) {
      var active = button.getAttribute("data-personalize-window") === personalizeDraft.focusWindow;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    Array.prototype.forEach.call(personalizeModal.querySelectorAll("[data-personalize-distraction]"), function (button) {
      var active = button.getAttribute("data-personalize-distraction") === personalizeDraft.distraction;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    Array.prototype.forEach.call(personalizeModal.querySelectorAll("[data-personalize-length]"), function (button) {
      var active = Number(button.getAttribute("data-personalize-length")) === Number(personalizeDraft.focusLength);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    var copy = personalizeCopy();
    var targetLabel = document.getElementById("personalizeTargetLabel");
    var targetInput = document.getElementById("personalizeTargetInput");
    var challengeLabel = document.getElementById("personalizeChallengeLabel");
    var challengeInput = document.getElementById("personalizeChallengeInput");
    var goalLabel = document.getElementById("personalizeGoalLabel");
    var goalInput = document.getElementById("personalizeGoalInput");
    if (targetLabel) targetLabel.textContent = copy.targetLabel;
    if (targetInput) targetInput.placeholder = copy.targetPlaceholder;
    if (challengeLabel) challengeLabel.textContent = copy.challengeLabel;
    if (challengeInput) challengeInput.placeholder = copy.challengePlaceholder;
    if (goalLabel) goalLabel.textContent = copy.goalLabel;
    if (goalInput) goalInput.placeholder = copy.goalPlaceholder;
  }

  function openPersonalize() {
    if (!personalizeModal) return;
    personalizeDraft = normalizeOnboarding(state.onboarding);
    var targetInput = document.getElementById("personalizeTargetInput");
    var challengeInput = document.getElementById("personalizeChallengeInput");
    var goalInput = document.getElementById("personalizeGoalInput");
    if (targetInput) targetInput.value = personalizeDraft.target;
    if (challengeInput) challengeInput.value = personalizeDraft.challenge;
    if (goalInput) goalInput.value = personalizeDraft.goal;
    syncPersonalizeForm();
    personalizeModal.classList.add("open");
    personalizeModal.setAttribute("aria-hidden", "false");
    setTimeout(function () { if (targetInput) targetInput.focus(); }, 60);
  }

  function closePersonalize() {
    if (personalizeModal) {
      personalizeModal.classList.remove("open");
      personalizeModal.setAttribute("aria-hidden", "true");
    }
    personalizeDraft = null;
  }

  function savePersonalize() {
    if (!personalizeDraft) personalizeDraft = normalizeOnboarding(state.onboarding);
    var next = normalizeOnboarding(Object.assign({}, personalizeDraft, {
      target: String((document.getElementById("personalizeTargetInput") || {}).value || "").trim().slice(0, 80),
      challenge: String((document.getElementById("personalizeChallengeInput") || {}).value || "").trim().slice(0, 80),
      goal: String((document.getElementById("personalizeGoalInput") || {}).value || "").trim().slice(0, 120),
      refinedAt: new Date().toISOString()
    }));
    state.onboarding = next;
    recordLearningEvent("personalization_saved", {
      purpose: next.purpose || "",
      focusWindow: next.focusWindow || "",
      focusLength: next.focusLength || 0
    });
    saveState();
    closePersonalize();
    renderProgress();
    showToast("Personal setup saved.");
  }

  function wirePersonalizeModal() {
    if (!personalizeModal) return;
    Array.prototype.forEach.call(personalizeModal.querySelectorAll("[data-personalize-purpose]"), function (button) {
      button.onclick = function () {
        if (!personalizeDraft) personalizeDraft = normalizeOnboarding(state.onboarding);
        personalizeDraft.purpose = button.getAttribute("data-personalize-purpose") || "";
        syncPersonalizeForm();
      };
    });
    Array.prototype.forEach.call(personalizeModal.querySelectorAll("[data-personalize-window]"), function (button) {
      button.onclick = function () {
        if (!personalizeDraft) personalizeDraft = normalizeOnboarding(state.onboarding);
        personalizeDraft.focusWindow = button.getAttribute("data-personalize-window") || "not-sure";
        syncPersonalizeForm();
      };
    });
    Array.prototype.forEach.call(personalizeModal.querySelectorAll("[data-personalize-distraction]"), function (button) {
      button.onclick = function () {
        if (!personalizeDraft) personalizeDraft = normalizeOnboarding(state.onboarding);
        personalizeDraft.distraction = button.getAttribute("data-personalize-distraction") || "";
        syncPersonalizeForm();
      };
    });
    Array.prototype.forEach.call(personalizeModal.querySelectorAll("[data-personalize-length]"), function (button) {
      button.onclick = function () {
        if (!personalizeDraft) personalizeDraft = normalizeOnboarding(state.onboarding);
        personalizeDraft.focusLength = Number(button.getAttribute("data-personalize-length")) || 0;
        personalizeDraft.capacityMinutes = personalizeDraft.focusLength;
        syncPersonalizeForm();
      };
    });
    var cancel = document.getElementById("personalizeCancelBtn");
    var close = document.getElementById("personalizeCloseBtn");
    var save = document.getElementById("personalizeSaveBtn");
    if (cancel) cancel.onclick = closePersonalize;
    if (close) close.onclick = closePersonalize;
    if (save) save.onclick = savePersonalize;
  }

  function renderProgress() {
    var validRanges = [3, 7, 14, 30];
    var rangeDays = validRanges.indexOf(Number(progressRangeDays)) > -1 ? Number(progressRangeDays) : 7;
    var days = [];
    var focusMinutesRange = 0;
    var minutesByDate = focusMinutesByDate();
    var sessionsByDate = focusSessionsByDate();
    var today = todayStr();
    var weekView = rangeDays === 7;
    if (progressRangeOffset > 0) progressRangeOffset = 0;
    // Seven days is a Sunday-to-Saturday week. The other ranges are rolling
    // lookbacks that end today, so 3 means exactly 3 days and 30 means the
    // current day plus the previous 29.
    var currentSunday = addDaysKey(today, -new Date(today + "T00:00:00").getDay());
    var rangeStart;
    var rangeEnd;
    if (weekView) {
      rangeStart = addDaysKey(currentSunday, progressRangeOffset * 7);
      rangeEnd = addDaysKey(rangeStart, 6);
    } else {
      rangeEnd = addDaysKey(today, progressRangeOffset * rangeDays);
      rangeStart = addDaysKey(rangeEnd, -(rangeDays - 1));
    }
    for (var date = rangeStart; date <= rangeEnd; date = addDaysKey(date, 1)) {
      var minutes = minutesByDate[date] || 0;
      focusMinutesRange += minutes;
      days.push({ date: date, minutes: minutes, sessions: sessionsByDate[date] || 0, future: date > today });
    }
    if (!selectedProgressDate || !days.some(function (day) { return day.date === selectedProgressDate; })) {
      if (progressRangeOffset < 0) {
        var activePastDay = days.slice().reverse().find(function (day) { return day.minutes > 0; });
        selectedProgressDate = activePastDay ? activePastDay.date : rangeEnd;
      } else {
        selectedProgressDate = days.some(function (day) { return day.date === today; })
          ? today
          : rangeEnd;
      }
    }
    document.getElementById("statStreak").textContent = state.profile.streak;
    document.getElementById("statFocus7").textContent = formatMinutesCompact(focusMinutesRange);
    document.getElementById("statFocusRangeLabel").textContent = weekView
      ? "Focus time / week"
      : "Focus time / " + rangeDays + "d";
    var rangeStartLabel = new Date(rangeStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    var rangeTitle;
    if (weekView) {
      rangeTitle = progressRangeOffset === 0
        ? "This week"
        : progressRangeOffset === -1
          ? "Last week"
          : "Week of " + rangeStartLabel;
    } else if (progressRangeOffset < 0) {
      rangeTitle = progressRangeOffset === -1 ? "Previous period" : "Earlier period";
    } else if (rangeDays === 3) {
      rangeTitle = "Recent days";
    } else if (rangeDays === 14) {
      rangeTitle = "Recent weeks";
    } else {
      rangeTitle = "Past month";
    }
    document.getElementById("progressRangeTitle").textContent = rangeTitle;
    var weekPrev = document.getElementById("progressWeekPrev");
    var weekNext = document.getElementById("progressWeekNext");
    if (weekPrev) {
      weekPrev.hidden = false;
      weekPrev.disabled = false;
      weekPrev.setAttribute("aria-label", weekView ? "Previous week" : "Previous " + rangeDays + "-day period");
    }
    if (weekNext) {
      weekNext.hidden = false;
      weekNext.disabled = progressRangeOffset >= 0;
      weekNext.setAttribute("aria-label", weekView ? "Next week" : "Next " + rangeDays + "-day period");
      weekNext.setAttribute("aria-disabled", String(progressRangeOffset >= 0));
    }
    document.getElementById("progressRangeSelect").value = String(rangeDays);
    var doneTasks = state.tasks.filter(function (task) { return task.status === "completed"; }).length;
    document.getElementById("statCompletion").textContent = state.tasks.length ? Math.round((doneTasks / state.tasks.length) * 100) + "%" : "0%";
    var max = Math.max(state.profile.dailyGoalMinutes || 60, Math.max.apply(null, days.map(function (day) { return day.minutes; })), 1);
    var chartType = state.settings.chartType === "line" ? "line" : "bars";
    var heatmapView = rangeDays === 30;
    var chartTypeToggle = document.querySelector(".chart-type-toggle");
    if (chartTypeToggle) chartTypeToggle.style.display = heatmapView ? "none" : "";
    Array.prototype.forEach.call(document.querySelectorAll("[data-chart-type]"), function (button) {
      var active = button.getAttribute("data-chart-type") === chartType;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("progressChart").innerHTML = heatmapView
      ? renderHeatmapChart(days)
      : chartType === "line"
        ? renderLineChart(days, max)
        : renderCadenceChart(days, max);
    document.getElementById("progressInsights").innerHTML = progressInsights(days).map(function (insight) {
      return '<article class="progress-insight"><span>' + escapeHtml(insight.label) + '</span><strong>' + escapeHtml(insight.value) + '</strong><p>' + escapeHtml(insight.text) + '</p></article>';
    }).join("");
    var historyXp = state.history.reduce(function (sum, item) { return sum + (item.xpEarned || 0); }, 0);
    var latest = state.attentionTests[state.attentionTests.length - 1] || null;
    var baselineDelta = latest && state.baselineScore !== null ? latest.score - state.baselineScore : null;
    var best = state.attentionTests.length ? Math.max.apply(null, state.attentionTests.map(function (test) { return test.score; })) : null;
    var focusWindow = learnedFocusWindow();
    var focusWindowHasData = Boolean(focusWindow.minutes);
    var focusWindowTitle = focusWindowHasData
      ? "You usually focus most in the " + focusWindow.label.toLowerCase() + "."
      : "DeeCadence is still learning your best focus time.";
    var focusWindowMeta = focusWindowHasData
      ? formatMinutesCompact(focusWindow.minutes) + " logged across " + focusWindow.sessions + " completed session" + (focusWindow.sessions === 1 ? "" : "s") + "."
      : (focusWindow.label !== "Not enough data" ? "Using your setup preference: " + focusWindow.label + "." : "Complete a few timed blocks so this becomes accurate.");
    document.getElementById("progressTaskSummary").innerHTML =
      '<div class="progress-summary-line">' +
        "<span>" + state.history.length + (state.history.length === 1 ? " log saved" : " logs saved") + "</span>" +
        "<span>" + formatMinutesCompact(focusMinutesRange) + (weekView ? (progressRangeOffset === 0 ? " focused this week" : " focused that week") : " focused in this view") + "</span>" +
        "<span>" + formatNumber(historyXp) + " XP earned</span>" +
        "<span>" + doneTasks + " of " + state.tasks.length + " tasks fully completed</span>" +
      "</div>" +
      '<section class="focus-window-card">' +
        '<div><span>Usual focus window</span><strong>' + escapeHtml(focusWindow.label) + '</strong></div>' +
        '<p>' + escapeHtml(focusWindowTitle) + " " + escapeHtml(focusWindowMeta) + '</p>' +
        '<small>' + escapeHtml(focusWindow.confidence) + '</small>' +
      '</section>' +
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
          '<div><span>Reference score</span><strong>' + REFERENCE_BENCHMARK.score + '</strong></div>' +
          '<div><span>Personal best</span><strong>' + (best == null ? "-" : best) + '</strong></div>' +
        '</div>' +
        '<p class="benchmark-disclaimer">This reference score is not a population norm or diagnosis. Compare your own checks under similar conditions.</p>' +
      '</section>';
    renderPersonalSetup();
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
    Array.prototype.forEach.call(document.querySelectorAll("[data-history-filter]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-history-filter") === currentHistoryFilter);
    });
    var entries = state.history.filter(function (item) {
      var complete = Boolean(item.manualDone || item.completedAll || (Number(item.blocksPlanned) > 0 && Number(item.blocksCompleted) >= Number(item.blocksPlanned)));
      if (currentHistoryFilter === "completed") return complete;
      if (currentHistoryFilter === "partial") return !complete;
      return true;
    });
    if (!entries.length) {
      var emptyCopy = currentHistoryFilter === "completed"
        ? "No fully completed sessions yet."
        : currentHistoryFilter === "partial"
          ? "No partial sessions. Your saved activity is fully complete."
          : "No sessions yet. Your first block will show up here.";
      root.innerHTML = '<div class="empty-state history-empty"><span class="history-empty-mark" aria-hidden="true"></span><p>' + emptyCopy + '</p></div>';
      return;
    }
    root.innerHTML = entries.map(function (item) {
      var date = new Date(item.completedAt || item.date || Date.now());
      var complete = Boolean(item.manualDone || item.completedAll || (Number(item.blocksPlanned) > 0 && Number(item.blocksCompleted) >= Number(item.blocksPlanned)));
      var icon = complete ? "Done" : item.blocksCompleted + "/" + item.blocksPlanned;
      var subtitle = item.manualDone
        ? "Completed outside timer"
        : complete
          ? item.blocksCompleted + " blocks fully completed"
          : item.blocksCompleted + " of " + item.blocksPlanned + " blocks completed";
      return '<div class="history-item ' + (complete ? "is-complete" : "is-partial") + '"><div class="history-icon">' + icon + '</div><div class="history-main"><div class="history-title">' + (item.linkedTaskTitle ? escapeHtml(item.linkedTaskTitle) : "Free focus") + '</div><div class="history-sub">' + date.toLocaleDateString() + " - " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " - " + subtitle + '</div>' + renderFeedbackSummary(item) + '</div><div class="history-xp">+' + item.xpEarned + " XP</div></div>";
    }).join("");
  }

  function renderSettings() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-choice]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-theme-choice") === state.settings.theme);
    });
    document.getElementById("soundSwitch").classList.toggle("on", state.settings.sound);
    document.getElementById("soundSwitch").setAttribute("aria-pressed", String(state.settings.sound));
    brownNoiseEnabled = Boolean(state.settings.brownNoise);
    ambientSoundId = AMBIENT_SOUND_IDS.indexOf(state.settings.ambientSound) > -1 ? state.settings.ambientSound : "brown";
    syncAmbientPlayback();
    syncAmbientUI();
    document.getElementById("motionSwitch").classList.toggle("on", state.settings.reducedMotion);
    document.getElementById("motionSwitch").setAttribute("aria-pressed", String(state.settings.reducedMotion));
    document.getElementById("dailyGoalSelect").value = String(state.profile.dailyGoalMinutes || 60);
    updateFeedbackDeliveryCopy();
    updateFeedbackBadge();
  }

  var CONTEXT_TIPS = {
    today: {
      eyebrow: "Start here",
      title: "Pick one thing for your attention.",
      body: "Continue a saved block, start a short focus session, or plan the next task."
    },
    focus: {
      eyebrow: "Focus blocks",
      title: "The timer only asks for the next block.",
      body: "Pause if you need to. Continue saved sessions here without losing the work already done."
    },
    plan: {
      eyebrow: "Plan",
      title: "Schedule is the calendar. Tasks is the list.",
      body: "Use Schedule for time blocks. Use Tasks to edit, mark done, or start focus quickly."
    },
    rank: {
      eyebrow: "Ranks",
      title: "Rank shows long-term attention growth.",
      body: "Everyone starts at E-Rank. Higher ranks need much more protected focus time."
    },
    progress: {
      eyebrow: "Progress",
      title: "Check if your focus is lasting longer.",
      body: "Use the graph, history, and attention check to see what is actually improving."
    },
    settings: {
      eyebrow: "Settings",
      title: "Control sound, theme, goals, and backups.",
      body: "Your data saves on this device. Export a backup before switching browsers or phones."
    }
  };

  var contextTipsShownThisSession = {};

  function renderContextTip(viewName) {
    var view = document.getElementById("view-" + viewName);
    var tip = CONTEXT_TIPS[viewName];
    if (!view || !tip) return;
    var existing = view.querySelector(".context-tip");
    if (state.dismissedContextTips && state.dismissedContextTips[viewName]) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    // One gentle notice per tab per app session. A notice that is already on
    // screen is left alone so live re-renders never restart its animation.
    if (existing || contextTipsShownThisSession[viewName]) return;
    contextTipsShownThisSession[viewName] = true;

    var el = document.createElement("div");
    el.className = "context-tip context-tip-notify";
    el.innerHTML = '<span class="context-tip-mark" aria-hidden="true"></span>' +
      '<div class="context-tip-copy"><div class="attention-kicker">' + escapeHtml(tip.eyebrow) + '</div><strong>' + escapeHtml(tip.title) + '</strong><p>' + escapeHtml(tip.body) + '</p></div>' +
      '<button type="button" class="context-tip-close" aria-label="Dismiss notice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    var topbar = view.querySelector(".topbar");
    if (topbar && topbar.parentNode) topbar.parentNode.insertBefore(el, topbar.nextSibling);
    else view.insertBefore(el, view.firstChild);

    function hideTip() {
      if (el.classList.contains("is-leaving")) return;
      state.dismissedContextTips[viewName] = true;
      saveState();
      el.classList.add("is-leaving");
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 340);
    }
    var close = el.querySelector(".context-tip-close");
    if (close) close.onclick = hideTip;
    // No fade timer: the notice waits until the reader presses ✕.
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.settings.theme);
    document.body.setAttribute("data-theme", state.settings.theme);
    document.documentElement.setAttribute("data-reduced-motion", String(state.settings.reducedMotion));
    document.body.setAttribute("data-reduced-motion", String(state.settings.reducedMotion));
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", state.settings.theme === "light" ? "#fbfaf4" : "#020706");
    applyRankTheme();
  }

  function renderSessionIndicators() {
    var active = Boolean(state.session || state.savedSessions.length);
    ["navFocusDot", "bottomNavFocusDot"].forEach(function (id) {
      var dot = document.getElementById(id);
      if (dot) dot.style.display = active ? "inline-block" : "none";
    });
  }

  function renderAll() {
    try { renderToday(); } catch (e) { console.error("renderToday error:", e); }
    try { renderFocus(); } catch (e) { console.error("renderFocus error:", e); }
    try { renderPlan(); } catch (e) { console.error("renderPlan error:", e); }
    try { renderRankPage(); } catch (e) { console.error("renderRankPage error:", e); }
    try { renderProgress(); } catch (e) { console.error("renderProgress error:", e); }
    try { renderHistory(); } catch (e) { console.error("renderHistory error:", e); }
    try { renderSettings(); } catch (e) { console.error("renderSettings error:", e); }
    applyTheme();
    renderSessionIndicators();
    try { renderContextTip(activeView); } catch (e) { console.error("renderContextTip error:", e); }
  }

  function switchView(name) {
    activeView = name;
    try { document.body.setAttribute("data-active-view", name); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll(".view"), function (view) {
      var isActive = view.id === "view-" + name;
      view.classList.toggle("active", isActive);
      if (isActive) {
        view.style.display = "block";
        view.style.opacity = "1";
        view.style.transform = "translateY(0)";
        view.style.visibility = "visible";
      } else {
        view.style.display = "none";
        view.style.opacity = "0";
        view.style.transform = "translateY(8px)";
        view.style.visibility = "hidden";
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll(".navbtn, .bottomnav button"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-view") === name);
    });
    try {
      if (name === "today") renderToday();
      if (name === "focus") renderFocus();
      if (name === "plan") renderPlan();
      if (name === "rank") renderRankPage();
      if (name === "progress") renderProgress();
      if (name === "history") renderHistory();
      if (name === "settings") renderSettings();
    } catch (e) {
      console.error("switchView render error:", e);
      // Fallback: ensure something is visible
      var viewRoot = document.getElementById("view-" + name);
      if (viewRoot && !viewRoot.innerHTML.trim()) {
        viewRoot.innerHTML = '<div class="empty-state"><h3>Loading...</h3><p>Please refresh the page if this persists.</p></div>';
      }
    }
    renderContextTip(name);
    var viewRoot = document.getElementById("view-" + name);
    if (viewRoot) viewRoot.scrollTop = 0;
    if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function openWelcome(force) {
    if (!welcomeOverlay || (!force && state.settings.welcomeComplete)) return false;
    onboardingIndex = 0;
    renderWelcomeStep();
    welcomeOverlay.classList.add("open");
    welcomeOverlay.setAttribute("aria-hidden", "false");
    var next = document.getElementById("welcomeSaveBtn");
    if (next) next.focus();
    return true;
  }

  function closeWelcome(markComplete) {
    if (!welcomeOverlay) return;
    if (welcomeOverlay.contains(document.activeElement)) document.activeElement.blur();
    welcomeOverlay.classList.remove("open");
    welcomeOverlay.setAttribute("aria-hidden", "true");
    if (markComplete) {
      state.settings.welcomeComplete = true;
      state.settings.tutorialComplete = true;
      saveState();
    }
  }

  function welcomePurposeCopy() {
    return ONBOARDING_PURPOSE_COPY[state.onboarding && state.onboarding.purpose] || {
      targetLabel: "Main area",
      targetPlaceholder: "e.g. Physics, client work, JavaScript",
      challengeLabel: "Hardest part",
      challengePlaceholder: "e.g. Past questions, outreach, algorithms",
      goalLabel: "Near goal",
      goalPlaceholder: "e.g. Prepare for Friday test",
      fallbackTask: "Focus block"
    };
  }

  function welcomeDefaultTaskTitle() {
    var setup = state.onboarding || defaultOnboarding();
    var title = String(setup.target || "").trim();
    if (title) return title;
    return welcomePurposeCopy().fallbackTask;
  }

  function welcomeFocusTime() {
    var windowName = state.onboarding && state.onboarding.focusWindow;
    if (!windowName || windowName === "not-sure") {
      windowName = learnedFocusWindow().id;
    }
    if (windowName === "morning") return "08:00";
    if (windowName === "afternoon") return "14:00";
    if (windowName === "evening") return "18:00";
    if (windowName === "late-night") return "21:00";
    return "";
  }

  function readWelcomeInput(id, limit) {
    var input = document.getElementById(id);
    return input ? String(input.value || "").trim().slice(0, limit) : "";
  }

  function saveWelcomeSetup(action) {
    var existing = state.onboarding || defaultOnboarding();
    var timeBtn = document.querySelector('.q-btn[data-q^="time-"].active');
    var distBtn = document.querySelector('.q-btn[data-q^="dist-"].active');
    var lenBtn = document.querySelector('.q-btn[data-q^="len-"].active');
    var focusLength = lenBtn ? parseInt(String(lenBtn.dataset.q || "").replace("len-", ""), 10) || 0 : existing.focusLength;
    var next = normalizeOnboarding(Object.assign({}, existing, {
      target: readWelcomeInput("welcomeTargetInput", 80) || existing.target,
      challenge: readWelcomeInput("welcomeChallengeInput", 80) || existing.challenge,
      goal: readWelcomeInput("welcomeGoalInput", 120) || existing.goal,
      distraction: distBtn ? String(distBtn.dataset.q || "").replace("dist-", "") : existing.distraction,
      focusLength: focusLength || existing.focusLength,
      capacityMinutes: focusLength || existing.capacityMinutes,
      focusWindow: (timeBtn && timeBtn.dataset.q === "time-morning") ? "morning"
        : (timeBtn && timeBtn.dataset.q === "time-afternoon") ? "afternoon"
        : (timeBtn && timeBtn.dataset.q === "time-evening") ? "evening"
        : (timeBtn && timeBtn.dataset.q === "time-late") ? "late-night"
        : "not-sure"
    }));
    if (action) {
      next.firstAction = action;
      next.completedAt = new Date().toISOString();
    }
    state.onboarding = next;
    recordLearningEvent("onboarding_saved", {
      purpose: next.purpose || "",
      focusWindow: next.focusWindow || "",
      firstAction: next.firstAction || ""
    });
    saveState();
    return next;
  }

  function canContinueWelcomeStep() {
    return true;
  }

  function updateWelcomeNextState() {
    var slides = document.querySelectorAll("[data-onboarding-panel]");
    var lastIndex = Math.max(0, slides.length - 1);
    var next = document.getElementById("welcomeSaveBtn");
    if (!next) return;
    var isLast = onboardingIndex === lastIndex;
    next.disabled = isLast || !canContinueWelcomeStep();
  }

  function syncWelcomeOptionButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-welcome-purpose]"), function (button) {
      var active = button.getAttribute("data-welcome-purpose") === (state.onboarding && state.onboarding.purpose);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-welcome-focus-window]"), function (button) {
      var active = button.getAttribute("data-welcome-focus-window") === (state.onboarding && state.onboarding.focusWindow);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderWelcomePurposeFields() {
    var copy = welcomePurposeCopy();
    var targetLabel = document.getElementById("welcomeTargetLabel");
    var targetInput = document.getElementById("welcomeTargetInput");
    var challengeLabel = document.getElementById("welcomeChallengeLabel");
    var challengeInput = document.getElementById("welcomeChallengeInput");
    var goalLabel = document.getElementById("welcomeGoalLabel");
    var goalInput = document.getElementById("welcomeGoalInput");
    var hint = document.getElementById("welcomeConsistencyHint");
    if (targetLabel) targetLabel.textContent = copy.targetLabel;
    if (targetInput) {
      targetInput.placeholder = copy.targetPlaceholder;
      targetInput.value = state.onboarding.target || "";
    }
    if (challengeLabel) challengeLabel.textContent = copy.challengeLabel;
    if (challengeInput) {
      challengeInput.placeholder = copy.challengePlaceholder;
      challengeInput.value = state.onboarding.challenge || "";
    }
    if (goalLabel) goalLabel.textContent = copy.goalLabel;
    if (goalInput) {
      goalInput.placeholder = copy.goalPlaceholder;
      goalInput.value = state.onboarding.goal || "";
    }
    if (hint) {
      hint.textContent = state.onboarding.purpose === "studying"
        ? "Add one subject or course. The challenge and goal are optional."
        : "Add one focus area. The challenge and next goal are optional.";
    }
  }

  function selectWelcomeOption(kind, value) {
    if (!state.onboarding) state.onboarding = defaultOnboarding();
    if (kind === "purpose") state.onboarding.purpose = value;
    if (kind === "focusWindow") state.onboarding.focusWindow = value;
    renderWelcomeStep();
  }

  function prefillTaskModalFromWelcome(action) {
    var titleInput = document.getElementById("taskTitleInput");
    var notesInput = document.getElementById("taskNotesInput");
    var timeInput = document.getElementById("taskTimeInput");
    var flexInput = document.getElementById("taskFlexInput");
    var sub = document.getElementById("taskModalSub");
    var setup = state.onboarding || defaultOnboarding();
    if (titleInput && !titleInput.value.trim()) titleInput.value = welcomeDefaultTaskTitle();
    if (notesInput && !notesInput.value.trim()) {
      var notes = [];
      if (setup.challenge) notes.push("Hardest part: " + setup.challenge);
      if (setup.goal) notes.push("Goal: " + setup.goal);
      notesInput.value = notes.join("\n");
    }
    if (action === "schedule") {
      if (timeInput && !timeInput.value) timeInput.value = welcomeFocusTime();
      if (flexInput) flexInput.value = timeInput && timeInput.value ? "fixed" : "flexible";
      if (sub) sub.textContent = "Add the first block to your plan. DeeCadence can split the work into smaller focus pieces.";
      showToast("Add a time for the first block, then save it to your plan.");
      updateTaskTimeHelp();
      return;
    }
    if (sub) sub.textContent = "Add one thing you want to stay consistent with. You can schedule it now or later.";
    showToast("Add one task. DeeCadence will handle the details as you go.");
    updateTaskTimeHelp();
  }

  function prefillStartModalFromWelcome() {
    var input = document.getElementById("inputTaskTitle");
    if (input && !input.value.trim()) {
      input.value = welcomeDefaultTaskTitle();
      input.placeholder = "e.g. " + welcomeDefaultTaskTitle();
    }
    syncStartTaskSource("input");
  }

  function renderWelcomeStep() {
    var slides = document.querySelectorAll("[data-onboarding-panel]");
    var dots = document.querySelectorAll(".onboarding-progress span");
    var lastIndex = Math.max(0, slides.length - 1);
    onboardingIndex = Math.max(0, Math.min(onboardingIndex, lastIndex));
    Array.prototype.forEach.call(slides, function (slide, index) {
      slide.classList.toggle("active", index === onboardingIndex);
    });
    Array.prototype.forEach.call(dots, function (dot, index) {
      dot.classList.toggle("active", index <= onboardingIndex);
    });
    var label = document.getElementById("welcomeStepLabel");
    var note = document.getElementById("welcomeNote");
    var back = document.getElementById("welcomeBackBtn");
    var next = document.getElementById("welcomeSaveBtn");
    var activePanel = slides[onboardingIndex];
    var activeHeading = activePanel ? activePanel.querySelector("h2") : null;
    if (welcomeOverlay && activeHeading && activeHeading.id) {
      welcomeOverlay.setAttribute("aria-labelledby", activeHeading.id);
    }
    var skip = document.getElementById("welcomeSkipBtn");
    if (label) label.textContent = "Step " + (onboardingIndex + 1) + " of " + (lastIndex + 1);
    if (skip) skip.textContent = onboardingIndex === lastIndex ? "Finish setup" : "Skip setup";
    if (note) note.textContent = ONBOARDING_NOTES[onboardingIndex] || ONBOARDING_NOTES[0];
    if (back) back.disabled = onboardingIndex === 0;
    if (next) {
      var isLast = onboardingIndex === lastIndex;
      next.textContent = "Continue";
      next.classList.toggle("is-hidden", isLast);
      next.setAttribute("aria-hidden", String(isLast));
      if (next.parentNode) next.parentNode.classList.toggle("is-final-step", isLast);
      updateWelcomeNextState();
    }
    renderWelcomePurposeFields();
    syncWelcomeOptionButtons();
    updateCapacityPreview();
  }

  function updateCapacityPreview() {
    var preview = document.getElementById("capacityPreview");
    if (!preview) return;
    var timeBtn = document.querySelector('.q-btn[data-q^="time-"].active');
    var distBtn = document.querySelector('.q-btn[data-q^="dist-"].active');
    var lenBtn = document.querySelector('.q-btn[data-q^="len-"].active');
    var score = 75;
    if (timeBtn && timeBtn.dataset.q === "time-unsure") score -= 5;
    if (distBtn && distBtn.dataset.q === "dist-phone") score -= 5;
    if (distBtn && distBtn.dataset.q === "dist-thoughts") score -= 3;
    if (lenBtn && lenBtn.dataset.q === "len-5") score -= 5;
    if (lenBtn && lenBtn.dataset.q === "len-45") score += 5;
    score = Math.max(40, Math.min(95, score));
    preview.style.display = "block";
    var scoreEl = document.getElementById("capacityPreviewScore");
    if (scoreEl) scoreEl.textContent = score + "%";
    state.onboarding = state.onboarding || {};
    state.onboarding.baseAttentionCapacity = score;
    saveState();
  }

  function nextWelcomeStep() {
    var lastIndex = Math.max(0, document.querySelectorAll("[data-onboarding-panel]").length - 1);
    saveWelcomeSetup();
    if (!canContinueWelcomeStep()) {
      var note = document.getElementById("welcomeNote");
      if (note) {
        note.textContent = onboardingIndex === 1
          ? "Add a focus area to continue. You can fill in the other details later."
          : "Choose the closest option first. You can still change direction later.";
      }
      return;
    }
    if (onboardingIndex >= lastIndex) {
      completeWelcome("today");
      return;
    }
    onboardingIndex += 1;
    renderWelcomeStep();
  }

  function previousWelcomeStep() {
    saveWelcomeSetup();
    if (onboardingIndex <= 0) return;
    onboardingIndex -= 1;
    renderWelcomeStep();
  }

  function completeWelcome(action) {
    saveWelcomeSetup(action);
    closeWelcome(true);
    renderAll();
    if (action === "task") {
      currentPlanMode = "tasks";
      switchView("plan");
      openTaskModal();
      prefillTaskModalFromWelcome("task");
      return;
    }
    if (action === "schedule") {
      currentPlanMode = "schedule";
      currentPlanTab = "day";
      switchView("plan");
      openTaskModal();
      prefillTaskModalFromWelcome("schedule");
      return;
    }
    if (action === "focus") {
      switchView("focus");
      openStartModal(null, sustainableFocusProfile().recommendedMinutes);
      prefillStartModalFromWelcome();
      showToast("Start with a length that feels possible today.");
      return;
    }
    if (action === "calibrate") {
      switchView("focus");
      var cap = state.onboarding && state.onboarding.baseAttentionCapacity ? state.onboarding.baseAttentionCapacity : 75;
      var minutes = cap >= 75 ? 5 : cap >= 60 ? 7 : 10;
      openStartModal(null, minutes);
      prefillStartModalFromWelcome();
      showToast("First focus block: " + minutes + " minutes. Go at your own pace.");
      return;
    }
    switchView("today");
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
    document.body.classList.remove("tour-targets-modal");
    tourOverlay.classList.remove("open");
    tourOverlay.setAttribute("aria-hidden", "true");
    var tourCard = document.getElementById("tourCard");
    if (tourCard) tourCard.classList.remove("tour-at-top", "tour-at-bottom", "tour-at-side");
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
    document.body.classList.toggle("tour-targets-modal", step.setup === "taskModal");
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
    card.classList.remove("tour-at-top", "tour-at-bottom", "tour-at-side");
    card.style.top = "";
    card.style.left = "";
    target.classList.add("tour-highlight");
    target.scrollIntoView({ behavior: state.settings.reducedMotion ? "auto" : "smooth", block: "center", inline: "center" });
    setTimeout(function () {
      var rect = target.getBoundingClientRect();
      var cardRect = card.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      if (vw <= 720) {
        var landscape = vw > vh && vh <= 600;
        if (landscape && vw >= 560) {
          card.classList.add("tour-at-side");
        } else {
          var roomAbove = Math.max(0, rect.top);
          var roomBelow = Math.max(0, vh - rect.bottom);
          card.classList.add(roomAbove > roomBelow ? "tour-at-top" : "tour-at-bottom");
        }
        var nextButton = document.getElementById("tourNextBtn");
        if (nextButton) nextButton.focus({ preventScroll: true });
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
      var desktopNext = document.getElementById("tourNextBtn");
      if (desktopNext) desktopNext.focus({ preventScroll: true });
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

  function smartTaskRecommendations(limit) {
    var now = new Date();
    var nowDay = now.getDay();
    var nowPeriod = now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening";
    var scores = Object.create(null);

    function record(title, points, timestamp, hour) {
      var clean = String(title || "").trim().replace(/\s+/g, " ");
      if (!clean) return;
      var key = clean.toLowerCase();
      if (!scores[key]) scores[key] = { title: clean, score: 0, frequency: 0, lastSeen: 0 };
      var entry = scores[key];
      entry.score += points;
      entry.frequency += 1;
      entry.lastSeen = Math.max(entry.lastSeen, Number(timestamp) || 0);
      var seen = timestamp ? new Date(timestamp) : null;
      if (seen && seen.getDay() === nowDay) entry.score += 3;
      if (Number.isFinite(hour)) {
        var period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
        if (period === nowPeriod) entry.score += 2;
      }
    }

    (state.history || []).forEach(function (item, index) {
      if (!item || typeof item !== "object") return;
      var ageWeight = Math.max(1, 8 - Math.floor(index / 4));
      var completedAt = Number(item.completedAt) || 0;
      var hour = completedAt ? new Date(completedAt).getHours() : NaN;
      record(item.linkedTaskTitle, 8 + ageWeight + (item.completedAll ? 4 : 0), completedAt, hour);
    });
    (state.tasks || []).forEach(function (task) {
      if (!task || typeof task !== "object") return;
      var hour = task.time ? Math.floor(timeToMin(task.time) / 60) : NaN;
      var date = /^\d{4}-\d{2}-\d{2}$/.test(String(task.date || "")) ? task.date : todayStr();
      var timestamp = parseDateKey(date).getTime();
      record(task.title, task.status === "completed" ? 4 : 2, timestamp, hour);
    });

    return Object.keys(scores)
      .map(function (key) { return scores[key]; })
      .sort(function (a, b) {
        return b.score - a.score || b.frequency - a.frequency || b.lastSeen - a.lastSeen || a.title.localeCompare(b.title);
      })
      .slice(0, Math.max(1, limit || 6));
  }

  /* ============================================================
     LEARNING ENGINE — signal capture + derived profile.
     Foundation for the coming "Pet Dee" feature: records
     compact behavioral events (capped at 500) and builds an
     aggregate profile that powers personalized suggestions.
     ============================================================ */
  var LEARNING_EVENT_CAP = 500;

  function recordLearningEvent(type, data) {
    try {
      if (!state.learning || !Array.isArray(state.learning.events)) state.learning = { events: [] };
      var eventType = String(type || "event");
      var payload = data && typeof data === "object" ? Object.assign({}, data) : {};
      if (state.session && state.session.id && /^(session_|block_|brown_noise)/.test(eventType) && !payload.sessionId) {
        payload.sessionId = state.session.id;
      }
      var event = {
        id: makeId("le"),
        t: Date.now(),
        type: eventType,
        d: payload
      };
      state.learning.events.push(event);
      if (state.learning.events.length > LEARNING_EVENT_CAP) {
        state.learning.events = state.learning.events.slice(-LEARNING_EVENT_CAP);
      }
      if (typeof window.CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("deecadence:learning-event", {
          detail: { id: event.id, type: event.type }
        }));
      }
    } catch (error) {
      // Learning must never break the app.
    }
  }

  function learningEmptyCounters(size) {
    var arr = [];
    for (var i = 0; i < size; i += 1) arr.push(0);
    return arr;
  }

  function learningTopBuckets(arr, count) {
    return arr
      .map(function (value, index) { return { index: index, count: value }; })
      .sort(function (a, b) { return b.count - a.count || a.index - b.index; })
      .slice(0, count)
      .filter(function (entry) { return entry.count > 0; });
  }

  function learningMode(counter) {
    var bestKey = null;
    var bestCount = 0;
    Object.keys(counter).forEach(function (key) {
      if (counter[key] > bestCount) {
        bestCount = counter[key];
        bestKey = key;
      }
    });
    return bestKey === null ? null : { value: bestKey, count: bestCount };
  }

  function learningMean(numbers) {
    if (!numbers.length) return null;
    var total = numbers.reduce(function (sum, value) { return sum + value; }, 0);
    return Math.round(total / numbers.length);
  }

  function learningProfile() {
    var events = state.learning && Array.isArray(state.learning.events) ? state.learning.events : [];
    var history = Array.isArray(state.history) ? state.history : [];
    var tasks = Array.isArray(state.tasks) ? state.tasks : [];
    var onboarding = state.onboarding || defaultOnboarding();

    var hourHistogram = learningEmptyCounters(24);
    var weekdayHistogram = learningEmptyCounters(7);
    var completionHourHistogram = learningEmptyCounters(24);
    var sessionMinutesCounter = {};
    var blockCountCounter = {};
    var taskMinutesCounter = {};
    var titleStats = Object.create(null);
    var recentSessionMinutes = [];
    var totals = {
      sessionsStarted: 0,
      sessionsCompleted: 0,
      sessionsSaved: 0,
      blocksCompleted: 0,
      pauses: 0,
      tasksDoneManually: 0,
      xpFromSessions: 0
    };
    var durationPicks = { locked: 0, free: 0 };
    function noiseGroupEmpty() {
      return { sessions: 0, completedAll: 0, blocksCompleted: 0, blocksPlanned: 0, pauses: 0, minutes: 0 };
    }
    var noiseStats = { on: noiseGroupEmpty(), off: noiseGroupEmpty() };
    var noiseBySound = { brown: noiseGroupEmpty(), rain: noiseGroupEmpty(), classical: noiseGroupEmpty(), wind: noiseGroupEmpty() };
    var noiseMixed = {
      sessions: 0, completedAll: 0, blocksCompleted: 0, blocksPlanned: 0,
      pauses: 0, minutes: 0, toggledOn: 0, toggledOff: 0, sourceChanges: 0
    };
    var noiseToggles = {
      on: { count: 0, duringSession: 0, hours: learningEmptyCounters(24), weekdays: learningEmptyCounters(7), blockIndexes: [] },
      off: { count: 0, duringSession: 0, hours: learningEmptyCounters(24), weekdays: learningEmptyCounters(7), blockIndexes: [] }
    };
    var currentNoise = null;

    function addToNoiseGroup(group, data) {
      group.sessions += 1;
      group.blocksPlanned += Number(data.blocksPlanned) || 0;
      group.blocksCompleted += Number(data.blocksCompleted) || 0;
      group.pauses += Number(data.pauseCount) || 0;
      group.minutes += Number(data.minutes) || 0;
      if (data.completedAll) group.completedAll += 1;
    }

    function dominantNoiseState(track) {
      // Mixed sessions are not thrown away: the state that covered most of the
      // session earns the outcome, and the switch itself is kept as preference
      // evidence (people may toggle because the sound became distracting).
      var endT = Math.max(track.endT, track.startT);
      var lastT = track.startT;
      var segmentState = track.key;
      var segmentSound = track.startSound;
      var onMs = 0;
      var offMs = 0;
      var soundMs = { brown: 0, rain: 0, classical: 0, wind: 0 };
      function closeSegment(until) {
        var ms = Math.max(0, until - lastT);
        if (segmentState === "on") {
          onMs += ms;
          if (soundMs[segmentSound] !== undefined) soundMs[segmentSound] += ms;
        } else {
          offMs += ms;
        }
      }
      track.toggles.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (toggle) {
        var at = Math.max(lastT, Math.min(endT, toggle.t));
        closeSegment(at);
        lastT = at;
        segmentState = toggle.on ? "on" : "off";
        if (toggle.on) segmentSound = toggle.sound || segmentSound;
      });
      closeSegment(endT);
      if (endT === track.startT) {
        if (track.key === "on") onMs = 1; else offMs = 1;
      }
      var state = onMs >= offMs ? "on" : "off";
      var bestSound = "brown";
      var bestMs = -1;
      AMBIENT_SOUND_IDS.forEach(function (id) {
        if (soundMs[id] > bestMs) {
          bestMs = soundMs[id];
          bestSound = id;
        }
      });
      return { state: state, sound: bestSound, mixed: track.toggles.length > 0 };
    }

    function titleEntry(title) {
      var clean = String(title || "").trim().replace(/\s+/g, " ").slice(0, 90);
      if (!clean) return null;
      var key = clean.toLowerCase();
      if (!titleStats[key]) {
        titleStats[key] = {
          title: clean, created: 0, completed: 0, sessions: 0,
          hours: [], weekdays: [], minutesSeen: [], lastSeen: 0
        };
      }
      return titleStats[key];
    }

    function bumpCounter(counter, value) {
      if (value === undefined || value === null || value === "") return;
      var key = String(value);
      counter[key] = (counter[key] || 0) + 1;
    }

    events.forEach(function (event) {
      var ts = Number(event.t) || 0;
      var data = event.d && typeof event.d === "object" ? event.d : {};
      var when = ts ? new Date(ts) : new Date();
      var hour = when.getHours();
      var weekday = when.getDay();
      var entry;
      if (event.type === "session_start") {
        totals.sessionsStarted += 1;
        hourHistogram[hour] += 2;
        weekdayHistogram[weekday] += 1;
        bumpCounter(sessionMinutesCounter, data.minutes);
        bumpCounter(blockCountCounter, data.blocks);
        if (data.locked) durationPicks.locked += 1; else durationPicks.free += 1;
        currentNoise = data.noise === undefined || data.noise === null ? null : {
          key: data.noise ? "on" : "off",
          startT: ts || Date.now(),
          startSound: data.noiseType || data.sound || "brown",
          toggles: []
        };
        recentSessionMinutes.push(Number(data.minutes) || 0);
        entry = titleEntry(data.taskTitle);
        if (entry) {
          entry.sessions += 1;
          entry.hours.push(hour);
          entry.weekdays.push(weekday);
          entry.lastSeen = Math.max(entry.lastSeen, ts);
        }
      } else if (event.type === "block_complete") {
        totals.blocksCompleted += 1;
        entry = titleEntry(data.taskTitle);
        if (entry) entry.minutesSeen.push(Math.round((Number(data.seconds) || 0) / 60));
      } else if (event.type === "session_end") {
        totals.sessionsCompleted += 1;
        totals.xpFromSessions += Number(data.xpEarned) || 0;
        completionHourHistogram[hour] += 1;
        if (currentNoise) {
          currentNoise.endT = Math.max(ts || Date.now(), currentNoise.startT);
          var attribution = dominantNoiseState(currentNoise);
          var noiseGroup = noiseStats[attribution.state];
          addToNoiseGroup(noiseGroup, data);
          if (attribution.state === "on") {
            addToNoiseGroup(noiseBySound[attribution.sound] || noiseBySound.brown, data);
          }
          if (attribution.mixed) {
            addToNoiseGroup(noiseMixed, data);
            currentNoise.toggles.forEach(function (toggle) {
              if (toggle.on) noiseMixed.toggledOn += 1;
              else noiseMixed.toggledOff += 1;
              if (toggle.change === "source") noiseMixed.sourceChanges += 1;
            });
          }
          currentNoise = null;
        }
        entry = titleEntry(data.taskTitle);
        if (entry) {
          entry.minutesSeen.push(Number(data.minutes) || 0);
          entry.lastSeen = Math.max(entry.lastSeen, ts);
        }
      } else if (event.type === "session_saved") {
        totals.sessionsSaved += 1;
      } else if (event.type === "task_done") {
        totals.tasksDoneManually += 1;
        bumpCounter(taskMinutesCounter, data.estMinutes);
        entry = titleEntry(data.title);
        if (entry) {
          entry.completed += 1;
          if (data.time) entry.hours.push(Math.floor(timeToMin(data.time) / 60));
          entry.lastSeen = Math.max(entry.lastSeen, ts);
        }
      } else if (event.type === "task_created" || event.type === "task_updated") {
        bumpCounter(taskMinutesCounter, data.estMinutes);
        entry = titleEntry(data.title);
        if (entry && event.type === "task_created") entry.created += 1;
        if (entry) entry.lastSeen = Math.max(entry.lastSeen, ts);
      } else if (event.type === "brown_noise") {
        var toggleBucket = data.on ? noiseToggles.on : noiseToggles.off;
        toggleBucket.count += 1;
        toggleBucket.hours[hour] += 1;
        toggleBucket.weekdays[weekday] += 1;
        if (data.duringSession) {
          toggleBucket.duringSession += 1;
          if (currentNoise) {
            currentNoise.toggles.push({
              t: ts || Date.now(),
              on: Boolean(data.on),
              sound: data.sound || currentNoise.startSound || "brown",
              change: data.change || "toggle"
            });
          }
        }
        if (data.blockIndex !== null && data.blockIndex !== undefined) {
          toggleBucket.blockIndexes.push(Math.max(0, Number(data.blockIndex) || 0));
        }
      }
    });

    // Authoritative totals from logged history (covers pre-events data).
    var historyMinutes = 0;
    history.forEach(function (item) {
      if (!item || typeof item !== "object") return;
      var planned = Math.max(1, Number(item.blocksPlanned) || 1);
      var done = Math.max(0, Number(item.blocksCompleted) || 0);
      var minutes = Number(item.totalMinutes) || 0;
      historyMinutes += Math.round(minutes * Math.max(0, Math.min(1, done / planned)));
      totals.pauses += Number(item.pauseCount) || 0;
    });

    // Task library stats.
    var taskLib = { total: tasks.length, completed: 0, open: 0, withTime: 0, withRepeat: 0, minutes: [] };
    tasks.forEach(function (task) {
      if (!task || typeof task !== "object") return;
      if (task.status === "completed") taskLib.completed += 1; else taskLib.open += 1;
      if (task.time) taskLib.withTime += 1;
      if (task.repeat && task.repeat !== "none") taskLib.withRepeat += 1;
      var est = Number(task.estMinutes);
      if (est > 0) taskLib.minutes.push(est);
    });
    // Teaching signal: a library task marked done counts even without events.
    tasks.forEach(function (task) {
      var entry = titleEntry(task.title);
      if (entry && task.status === "completed") entry.completed = Math.max(entry.completed, 1);
    });

    var recent = recentSessionMinutes.slice(-12).filter(function (m) { return m > 0; });
    var recommendedMinutes = null;
    if (recent.length) {
      var recentCounter = {};
      recent.forEach(function (m) { bumpCounter(recentCounter, m); });
      var recentMode = learningMode(recentCounter);
      recommendedMinutes = recentMode ? Number(recentMode.value) : learningMean(recent);
    }
    if (!recommendedMinutes) {
      var learnedCapacity = Number(onboarding.capacityMinutes) || Number(onboarding.focusLength) || 0;
      recommendedMinutes = learnedCapacity > 0 ? learnedCapacity : (learningMean(taskLib.minutes) || 25);
    }

    var recommendedBlocks = (function () {
      var mode = learningMode(blockCountCounter);
      if (mode) return Number(mode.value);
      var todaysOpen = tasks.filter(function (task) { return task.date === todayStr() && task.status !== "completed"; }).length;
      return clampBlockCount(todaysOpen || 4, 4);
    })();

    var topTitles = Object.keys(titleStats)
      .map(function (key) {
        var entry = titleStats[key];
        var hourCounter = {};
        entry.hours.forEach(function (hour) { bumpCounter(hourCounter, hour); });
        var weekdayCounter = {};
        entry.weekdays.forEach(function (day) { bumpCounter(weekdayCounter, day); });
        var hourMode = learningMode(hourCounter);
        var weekdayMode = learningMode(weekdayCounter);
        var recency = Math.round(entry.lastSeen / 1e10);
        return {
          title: entry.title,
          score: entry.created * 2 + entry.completed * 6 + entry.sessions * 4 + recency,
          created: entry.created,
          completed: entry.completed,
          sessions: entry.sessions,
          usualMinutes: learningMean(entry.minutesSeen),
          usualHour: hourMode ? Number(hourMode.value) : null,
          usualWeekday: weekdayMode ? Number(weekdayMode.value) : null,
          lastSeen: entry.lastSeen
        };
      })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 20);

    var now = new Date();
    var momentum = Number(state.profile && state.profile.momentum);
    if (!Number.isFinite(momentum)) momentum = 75;

    function noiseSummary(group) {
      return {
        sessions: group.sessions,
        completionRate: group.sessions ? Math.round((group.completedAll / group.sessions) * 100) : null,
        blockRate: group.blocksPlanned ? Math.round((group.blocksCompleted / group.blocksPlanned) * 100) : null,
        pauseRate: group.sessions ? Math.round((group.pauses / group.sessions) * 10) / 10 : null,
        avgMinutes: group.sessions ? Math.round(group.minutes / group.sessions) : null
      };
    }
    function toggleSummary(bucket) {
      return {
        count: bucket.count,
        duringSession: bucket.duringSession,
        topHours: learningTopBuckets(bucket.hours, 2).map(function (entry) {
          return { hour: entry.index, count: entry.count };
        }),
        topWeekdays: learningTopBuckets(bucket.weekdays, 2).map(function (entry) {
          return { weekday: entry.index, count: entry.count };
        }),
        avgBlockIndex: learningMean(bucket.blockIndexes)
      };
    }
    var mixedNoise = noiseSummary(noiseMixed);
    mixedNoise.toggledOn = noiseMixed.toggledOn;
    mixedNoise.toggledOff = noiseMixed.toggledOff;
    mixedNoise.sourceChanges = noiseMixed.sourceChanges;
    var brownNoise = {
      on: noiseSummary(noiseStats.on),
      off: noiseSummary(noiseStats.off),
      // Mixed sessions are retained and attributed to the state that covered
      // most of the session. Toggle direction, time and block are kept too.
      mixed: mixedNoise,
      bySound: {
        brown: noiseSummary(noiseBySound.brown),
        rain: noiseSummary(noiseBySound.rain),
        classical: noiseSummary(noiseBySound.classical),
        wind: noiseSummary(noiseBySound.wind)
      },
      toggles: { on: toggleSummary(noiseToggles.on), off: toggleSummary(noiseToggles.off) },
      attribution: "dominant_exposure"
    };
    var noiseEvidence = brownNoise.on.sessions >= 3 && brownNoise.off.sessions >= 3;
    var noiseRecommended = null;
    if (noiseEvidence) {
      var noiseScore = (brownNoise.on.completionRate - brownNoise.off.completionRate) - ((brownNoise.on.pauseRate - brownNoise.off.pauseRate) * 8);
      noiseRecommended = noiseScore >= 0;
    }

    return {
      version: 1,
      generatedAt: Date.now(),
      eventCount: events.length,
      totals: {
        sessionsStarted: totals.sessionsStarted,
        sessionsCompleted: totals.sessionsCompleted,
        sessionsSaved: totals.sessionsSaved,
        blocksCompleted: totals.blocksCompleted,
        focusMinutesFromHistory: historyMinutes,
        pauses: totals.pauses,
        tasksDoneManually: totals.tasksDoneManually,
        xpFromSessions: totals.xpFromSessions
      },
      taskLibrary: taskLib,
      histograms: {
        hour: hourHistogram,
        weekday: weekdayHistogram,
        completionHour: completionHourHistogram,
        sessionMinutes: sessionMinutesCounter,
        blockCounts: blockCountCounter,
        taskMinutes: taskMinutesCounter
      },
      durationPicks: durationPicks,
      onboarding: {
        purpose: onboarding.purpose || "",
        focusWindow: onboarding.focusWindow || "",
        firstAction: onboarding.firstAction || ""
      },
      momentum: momentum,
      topTitles: topTitles,
      brownNoise: brownNoise,
      suggest: {
        sessionMinutes: clampMinutes(recommendedMinutes, 25),
        sessionBlocks: recommendedBlocks,
        bestHours: learningTopBuckets(hourHistogram, 3).map(function (entry) { return entry.index; }),
        bestWeekdays: learningTopBuckets(weekdayHistogram, 3).map(function (entry) { return entry.index; }),
        rightNow: {
          hour: now.getHours(),
          weekday: now.getDay(),
          isTypicalFocusHour: hourHistogram[now.getHours()] > 0,
          inBestWindow: learningTopBuckets(hourHistogram, 3).some(function (entry) { return entry.index === now.getHours(); })
        },
        topTask: topTitles.length ? topTitles[0] : null,
        brownNoise: {
          hasEvidence: noiseEvidence,
          recommended: noiseRecommended,
          on: brownNoise.on,
          off: brownNoise.off,
          mixed: brownNoise.mixed,
          bySound: brownNoise.bySound,
          toggles: brownNoise.toggles,
          attribution: brownNoise.attribution
        }
      }
    };
  }

  function renderSmartTaskSuggestions(containerId, inputId) {
    var container = document.getElementById(containerId);
    var input = document.getElementById(inputId);
    if (!container || !input) return;
    var recommendations = [];
    try {
      recommendations = smartTaskRecommendations(6);
    } catch (error) {
      recommendations = [];
      console.warn("DeeCadence smart suggestions skipped:", error);
    }
    container.innerHTML = recommendations.length
      ? '<span>Suggested from your routine</span>' + recommendations.map(function (item, index) {
          return '<button type="button" data-smart-task-index="' + index + '">' + escapeHtml(item.title) + "</button>";
        }).join("")
      : "";
    Array.prototype.forEach.call(container.querySelectorAll("[data-smart-task-index]"), function (button) {
      button.onclick = function () {
        var recommendation = recommendations[parseInt(button.getAttribute("data-smart-task-index"), 10)];
        input.value = recommendation ? recommendation.title : "";
        input.focus();
      };
    });
  }

  function populateTaskSuggestionSurfaces() {
    var recommendations = [];
    try {
      recommendations = smartTaskRecommendations(12);
    } catch (error) {
      recommendations = [];
      console.warn("DeeCadence suggestions skipped:", error);
    }
    var options = recommendations.map(function (item) {
      return '<option value="' + escapeAttribute(item.title) + '"></option>';
    }).join("");
    var planList = document.getElementById("taskTitleSuggestions");
    var focusList = document.getElementById("focusTaskTitleSuggestions");
    if (planList) planList.innerHTML = options;
    if (focusList) focusList.innerHTML = options;
    renderSmartTaskSuggestions("taskSmartSuggestions", "taskTitleInput");
    renderSmartTaskSuggestions("startTaskSuggestions", "inputTaskTitle");
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
      unlockStartDuration();
      syncBlockCountButtons(4, "Input sessions can use any block count. Four gives the full focus rhythm.");
      document.getElementById("inputTaskTitle").focus();
    } else {
      var selected = getTask(document.getElementById("linkTaskSelect").value) || pendingStartTask;
      if (applyStartDurationLock(selected)) {
        syncBlockCountButtons(suggestedBlockCount(selected), "Suggested from this task's remaining pieces. You can change it.");
      }
      var sub = document.getElementById("startModalSub");
      if (sub) sub.textContent = startModalSubtitleFor(selected || null);
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

  /* Scheduled tasks define their own length: the picker is hidden and the
     session length is locked to the task's estimate. Block count stays free. */
  function applyStartDurationLock(task) {
    var grid = document.getElementById("durationGrid");
    var customWrap = document.getElementById("customMinWrap");
    var note = document.getElementById("durationLockNote");
    var valueEl = document.getElementById("durationLockValue");
    var est = task ? Number(task.estMinutes) : NaN;
    if (task && Number.isFinite(est) && est > 0) {
      startDurationLocked = true;
      chosenMinutes = clampMinutes(est, 25);
      if (grid) grid.hidden = true;
      if (customWrap) customWrap.style.display = "none";
      if (note) note.hidden = false;
      if (valueEl) valueEl.textContent = chosenMinutes + " min";
      return true;
    }
    unlockStartDuration();
    return false;
  }

  function unlockStartDuration() {
    startDurationLocked = false;
    var grid = document.getElementById("durationGrid");
    var note = document.getElementById("durationLockNote");
    if (grid) grid.hidden = false;
    if (note) note.hidden = true;
  }

  function startModalSubtitleFor(task) {
    if (!task) return "Choose length, blocks, then choose from Schedule or type a task title.";
    var timeBit = task.time ? " (scheduled " + task.time + ")" : "";
    if (startDurationLocked) return 'For "' + task.title + '"' + timeBit + ". Length is set from your plan.";
    return 'For "' + task.title + '"' + timeBit + ". Choose length and blocks.";
  }

  function openStartModal(task, suggestedMinutes, preferredSource) {
    if (state.session) {
      switchView("focus");
      renderFocus();
      if (state.session.status === "paused") showToast("Paused block is waiting. Continue it from Focus.");
      else if (state.session.status === "recovery") showToast("Current block is saved. Continue from the recovery screen.");
      else showToast("A focus block is already running.");
      return;
    }
    if (task && state.savedSessions.some(function (saved) { return saved.linkedTaskId === task.id; })) {
      switchView("focus");
      renderFocus();
      showToast("Continue this task's saved session first.");
      return;
    }
    pendingStartTask = task || null;
    var minutes = Number.isFinite(Number(suggestedMinutes))
      ? clampMinutes(suggestedMinutes, 10)
      : (task ? task.estMinutes : chosenMinutes);
    if (task) {
      applyStartDurationLock(task);
    } else {
      syncDurationButtons(minutes);
    }
    syncBlockCountButtons(suggestedBlockCount(task), task ? "Suggested from this task's remaining pieces. You can change it." : "Suggested from today's open plan. You can change it.");
    populateLinkTaskSelect(task ? task.id : "");
    document.getElementById("inputTaskTitle").value = "";
    populateTaskSuggestionSurfaces();
    syncStartTaskSource(preferredSource || (task || scheduledFocusTasks().length ? "schedule" : "input"));
    var headerTask = task || getTask(document.getElementById("linkTaskSelect").value) || null;
    document.getElementById("startModalSub").textContent = startModalSubtitleFor(headerTask);
    startModal.classList.add("open");
  }

  function startScheduledTask(taskId) {
    var task = getTask(taskId);
    if (task) openStartModal(task);
  }

  /* Setting a clock time pins the block: Schedule behavior switches to
     Fixed automatically. Clearing the time releases it back to Flexible. */
  function updateTaskTimeHelp() {
    var help = document.getElementById("taskTimeHelp");
    var flexHelp = document.getElementById("taskFlexHelp");
    var timeInput = document.getElementById("taskTimeInput");
    if (!timeInput) return;
    var hasTime = Boolean(timeInput.value);
    if (help) {
      help.textContent = hasTime
        ? "This time is protected. Clear the time to let auto-arrange move it."
        : "No time set - auto-arrange can place this task. Add a time to pin it.";
    }
    if (flexHelp) {
      flexHelp.textContent = hasTime
        ? "Pinned to the time above. Clear the time to make it flexible."
        : "Flexible because no time is set. Add a time above to pin it.";
    }
  }

  function syncTaskFlexFromTime() {
    var timeInput = document.getElementById("taskTimeInput");
    var flexInput = document.getElementById("taskFlexInput");
    if (!timeInput || !flexInput) return;
    var hasTime = Boolean(timeInput.value);
    flexInput.value = hasTime ? "fixed" : "flexible";
    var fixedOption = flexInput.querySelector('option[value="fixed"]');
    if (fixedOption) fixedOption.disabled = !hasTime;
    var flexibleOption = flexInput.querySelector('option[value="flexible"]');
    if (flexibleOption) flexibleOption.disabled = hasTime;
    updateTaskTimeHelp();
  }

  function openTaskModal(taskOrId) {
    var task = typeof taskOrId === "string" ? getTask(taskOrId) : (taskOrId && taskOrId.id ? taskOrId : null);
    editingTaskId = task ? task.id : null;
    document.getElementById("taskModalTitle").textContent = task ? "Edit task" : "Add task";
    document.getElementById("taskModalSub").textContent = task ? "Update the task and keep its focus progress intact." : "Add the work once. DeeCadence can split it into smaller focus pieces.";
    document.getElementById("taskModalConfirm").textContent = task ? "Save changes" : "Save task";
    document.getElementById("taskTitleInput").value = task ? task.title : "";
    document.getElementById("taskDateInput").value = task ? task.date : todayStr();
    document.getElementById("taskTimeInput").value = task && task.time ? task.time : "";
    document.getElementById("taskDurationInput").value = task ? task.estMinutes : "50";
    document.getElementById("taskPriorityInput").value = task ? task.priority : "medium";
    document.getElementById("taskUnitsInput").value = task ? task.units.total : "4";
    document.getElementById("taskFlexInput").value = task ? task.flex : "flexible";
    var taskTimeField = document.getElementById("taskTimeInput");
    var taskFlexField = document.getElementById("taskFlexInput");
    taskTimeField.onchange = function () { syncTaskFlexFromTime(); };
    taskTimeField.oninput = function () { if (!taskTimeField.value) syncTaskFlexFromTime(); };
    taskFlexField.onchange = updateTaskTimeHelp;
    syncTaskFlexFromTime();
    document.getElementById("taskRepeatInput").value = task ? task.repeat : "none";
    var repeatDaysWrap = document.getElementById("taskRepeatDaysWrap");
    var repeatSelect = document.getElementById("taskRepeatInput");
    function toggleRepeatDaysUI() {
      if (repeatSelect.value === "custom") {
        repeatDaysWrap.style.display = "block";
      } else {
        repeatDaysWrap.style.display = "none";
      }
    }
    toggleRepeatDaysUI();
    repeatSelect.onchange = toggleRepeatDaysUI;
    Array.prototype.forEach.call(document.querySelectorAll(".repeat-day-btn"), function (btn) {
      var day = parseInt(btn.getAttribute("data-repeat-day"), 10);
      btn.classList.toggle("active", task && task.repeatDays && task.repeatDays.indexOf(day) > -1);
      btn.onclick = function () {
        btn.classList.toggle("active");
        var idx = selectedRepeatDays.indexOf(day);
        if (idx > -1) selectedRepeatDays.splice(idx, 1);
        else selectedRepeatDays.push(day);
        selectedRepeatDays.sort(function (a, b) { return a - b; });
      };
    });
    document.getElementById("taskNotesInput").value = task ? task.notes : "";
    populateTaskSuggestionSurfaces();
    taskModal.classList.add("open");
    document.getElementById("taskTitleInput").focus();
  }

  function closeTaskModal() {
    editingTaskId = null;
    selectedRepeatDays = [];
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

  function openTimePicker() {
    var value = String(document.getElementById("taskTimeInput").value || "");
    var now = new Date();
    var hour24 = /^\d{2}:\d{2}$/.test(value) ? parseInt(value.slice(0, 2), 10) : now.getHours();
    var minute = /^\d{2}:\d{2}$/.test(value) ? parseInt(value.slice(3, 5), 10) : Math.round(now.getMinutes() / 5) * 5;
    if (minute >= 60) {
      minute = 0;
      hour24 = (hour24 + 1) % 24;
    }
    timePickerState.hour = hour24 % 12 || 12;
    timePickerState.minute = minute;
    timePickerState.period = hour24 >= 12 ? "PM" : "AM";
    timePickerState.stage = "hour";
    renderTimePicker();
    timePickerOverlay.classList.add("open");
    timePickerOverlay.setAttribute("aria-hidden", "false");
    document.getElementById("timePickerClose").focus();
  }

  function closeTimePicker() {
    timePickerOverlay.classList.remove("open");
    timePickerOverlay.setAttribute("aria-hidden", "true");
    document.getElementById("taskTimePickerBtn").focus();
  }

  function renderTimePicker() {
    var isHour = timePickerState.stage === "hour";
    var values = isHour
      ? [12].concat(Array.from({ length: 11 }).map(function (_, index) { return index + 1; }))
      : Array.from({ length: 12 }).map(function (_, index) { return index * 5; });
    document.getElementById("timePickerTitle").textContent = isHour ? "Choose an hour" : "Choose minutes";
    document.getElementById("timeDisplayHour").textContent = String(timePickerState.hour).padStart(2, "0");
    document.getElementById("timeDisplayMinute").textContent = String(timePickerState.minute).padStart(2, "0");
    document.getElementById("timeDisplayHour").classList.toggle("active", isHour);
    document.getElementById("timeDisplayMinute").classList.toggle("active", !isHour);
    Array.prototype.forEach.call(document.querySelectorAll("[data-time-period]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-time-period") === timePickerState.period);
    });
    var selectedValue = isHour ? timePickerState.hour : timePickerState.minute;
    document.getElementById("timeClockOptions").innerHTML = values.map(function (value, index) {
      var angle = index * 30;
      return '<button type="button" class="time-clock-option' + (value === selectedValue ? " active" : "") + '" style="--clock-angle:' + angle + 'deg;--clock-angle-reverse:' + (-angle) + 'deg" data-clock-value="' + value + '">' + String(value).padStart(isHour ? 1 : 2, "0") + "</button>";
    }).join("");
    var angle = isHour ? (timePickerState.hour % 12) * 30 : timePickerState.minute * 6;
    document.getElementById("timeClockHand").style.transform = "translateX(-50%) rotate(" + angle + "deg)";
    Array.prototype.forEach.call(document.querySelectorAll("[data-clock-value]"), function (button) {
      button.onclick = function () {
        var value = parseInt(button.getAttribute("data-clock-value"), 10) || 0;
        if (timePickerState.stage === "hour") {
          timePickerState.hour = value || 12;
          timePickerState.stage = "minute";
        } else {
          timePickerState.minute = value;
        }
        renderTimePicker();
      };
    });
  }

  function applyTimePicker() {
    var hour = timePickerState.hour % 12;
    if (timePickerState.period === "PM") hour += 12;
    document.getElementById("taskTimeInput").value = String(hour).padStart(2, "0") + ":" + String(timePickerState.minute).padStart(2, "0");
    syncTaskFlexFromTime();
    closeTimePicker();
  }

  function wireEvents() {
    var accountSetupForm = document.getElementById("accountSetupForm");
    if (accountSetupForm) accountSetupForm.onsubmit = saveAccountSetup;
    var accountSetupSignOut = document.getElementById("accountSetupSignOutBtn");
    if (accountSetupSignOut) accountSetupSignOut.onclick = function () {
      try {
        window.dispatchEvent(new CustomEvent("deecadence:account-profile-signout"));
      } catch (_) {}
    };
    window.addEventListener("deecadence:account-profile-required", function (event) {
      openAccountSetup(event.detail || {});
    });
    document.getElementById("welcomeSaveBtn").onclick = nextWelcomeStep;
    document.getElementById("welcomeBackBtn").onclick = previousWelcomeStep;
    document.getElementById("welcomeCalibrateBtn").onclick = function () {
      completeWelcome("calibrate");
    };
    document.getElementById("welcomeSkipCalibrateBtn").onclick = function () {
      completeWelcome("today");
    };
    Array.prototype.forEach.call(document.querySelectorAll(".q-btn"), function (button) {
      button.onclick = function () {
        var group = button.parentElement;
        Array.prototype.forEach.call(group.querySelectorAll(".q-btn"), function (b) { b.classList.remove("active"); });
        button.classList.add("active");
        updateCapacityPreview();
      };
    });
    document.getElementById("welcomeSkipBtn").onclick = function () {
      completeWelcome("today");
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-welcome-purpose]"), function (button) {
      button.onclick = function () {
        selectWelcomeOption("purpose", button.getAttribute("data-welcome-purpose"));
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-welcome-focus-window]"), function (button) {
      button.onclick = function () {
        selectWelcomeOption("focusWindow", button.getAttribute("data-welcome-focus-window"));
      };
    });
    ["welcomeTargetInput", "welcomeChallengeInput", "welcomeGoalInput"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.oninput = function () {
        saveWelcomeSetup();
        updateWelcomeNextState();
      };
    });
    document.getElementById("startNextBlockBtn").onclick = function () {
      if (state.savedSessions.length && !state.session) {
        switchView("focus");
        return;
      }
      openStartModal(nextTask());
    };
    document.getElementById("startSuggestedFocusBtn").onclick = function () {
      if (state.session || state.savedSessions.length) {
        switchView("focus");
        renderFocus();
        return;
      }
      var capacity = sustainableFocusProfile();
      openStartModal(nextTask(), capacity.recommendedMinutes);
    };
    document.getElementById("startModalCancel").onclick = function () { startModal.classList.remove("open"); };
    document.getElementById("startModalConfirm").onclick = function () {
      var scheduleTask = startTaskSource === "schedule"
        ? (getTask(document.getElementById("linkTaskSelect").value) || pendingStartTask)
        : null;
      var minutes;
      if (startDurationLocked && scheduleTask && Number(scheduleTask.estMinutes) > 0) {
        minutes = clampMinutes(scheduleTask.estMinutes, 25);
      } else {
        minutes = document.querySelector('.duration-opt[data-min="custom"]').classList.contains("active")
          ? clampMinutes(document.getElementById("customMinInput").value, 20)
          : chosenMinutes;
      }
      var selectedTaskId = resolveStartTaskId(clampMinutes(minutes, 25));
      if (!selectedTaskId) return;
      startModal.classList.remove("open");
      beginSession(clampMinutes(minutes, 25), selectedTaskId, chosenBlockCount, { locked: Boolean(startDurationLocked && scheduleTask) });
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
      if (task) {
        // The schedule defines the length: lock the picker to the task's estimate.
        applyStartDurationLock(task);
      } else {
        unlockStartDuration();
      }
      var sub = document.getElementById("startModalSub");
      if (sub) sub.textContent = startModalSubtitleFor(task || null);
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
        flex: document.getElementById("taskTimeInput").value ? document.getElementById("taskFlexInput").value : "flexible",
        estMinutes: clampMinutes(document.getElementById("taskDurationInput").value, 50),
        priority: document.getElementById("taskPriorityInput").value,
        units: clampBlockCount(document.getElementById("taskUnitsInput").value, 4),
        completedUnits: existingTask ? existingTask.units.completed : 0,
        status: existingTask ? existingTask.status : "pending",
        manualDoneXpAwarded: existingTask ? existingTask.manualDoneXpAwarded : false,
        notes: document.getElementById("taskNotesInput").value,
        repeat: document.getElementById("taskRepeatInput").value,
        repeatDays: selectedRepeatDays.slice(),
        repeatSourceId: existingTask ? existingTask.repeatSourceId : ""
      });
      if (task.time) task.flex = "fixed";
      else placeFlexibleTask(task);
      if (existingTask) {
        var index = state.tasks.findIndex(function (item) { return item.id === existingTask.id; });
        if (index > -1) state.tasks[index] = task;
      } else {
        state.tasks.push(task);
      }
      recordLearningEvent(existingTask ? "task_updated" : "task_created", {
        title: task.title,
        date: task.date,
        time: task.time || "",
        estMinutes: task.estMinutes,
        units: task.units.total,
        priority: task.priority,
        repeat: task.repeat,
        repeatDays: task.repeatDays || []
      });
      saveState();
      closeTaskModal();
      renderAll();
      showToast(existingTask ? "Task updated" : "Task added");
    };
    document.getElementById("taskTimePickerBtn").onclick = openTimePicker;
    document.getElementById("timePickerClose").onclick = closeTimePicker;
    document.getElementById("timePickerApply").onclick = applyTimePicker;
    document.getElementById("timePickerClear").onclick = function () {
      document.getElementById("taskTimeInput").value = "";
      syncTaskFlexFromTime();
      closeTimePicker();
    };
    document.getElementById("timeDisplayHour").onclick = function () {
      timePickerState.stage = "hour";
      renderTimePicker();
    };
    document.getElementById("timeDisplayMinute").onclick = function () {
      timePickerState.stage = "minute";
      renderTimePicker();
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-time-period]"), function (button) {
      button.onclick = function () {
        timePickerState.period = button.getAttribute("data-time-period") || "AM";
        renderTimePicker();
      };
    });
    timePickerOverlay.addEventListener("click", function (event) {
      if (event.target === timePickerOverlay) closeTimePicker();
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
    document.getElementById("replayTourBtn").onclick = function () { openWelcome(true); };
    [welcomeOverlay, startModal, taskModal, taskDetailModal, feedbackModal, personalizeModal, attentionTestModal].forEach(function (overlay) {
      if (!overlay) return;
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay) {
          if (overlay === welcomeOverlay) {
            completeWelcome("today");
            return;
          }
          if (overlay === feedbackModal) {
            closeFeedback();
            return;
          }
          if (overlay === personalizeModal) {
            closePersonalize();
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
      var placed = autoArrangeSchedule();
      renderAll();
      showToast(placed.length ? placed.length + " task" + (placed.length === 1 ? "" : "s") + " arranged" : "Nothing to arrange");
    };
    document.getElementById("autoArrangeBtnPlan").onclick = function () {
      var placed = autoArrangeSchedule();
      renderAll();
      showToast(placed.length ? placed.length + " task" + (placed.length === 1 ? "" : "s") + " arranged" : "Nothing to arrange");
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
    document.getElementById("brownNoiseSwitch").onclick = function () {
      toggleAmbientSound();
    };
    var focusNoiseBtn = document.getElementById("focusNoiseBtn");
    if (focusNoiseBtn) {
      focusNoiseBtn.onclick = function (event) {
        event.stopPropagation();
        setAmbientMenu(!ambientMenuOpen);
      };
    }
    var focusNoiseToggle = document.getElementById("focusNoiseToggle");
    if (focusNoiseToggle) {
      focusNoiseToggle.onclick = function () {
        setAmbientMenu(false);
        toggleAmbientSound();
      };
    }
    Array.prototype.forEach.call(document.querySelectorAll("#focusNoiseMenu [data-noise-sound]"), function (button) {
      button.onclick = function () {
        selectAmbientSound(button.getAttribute("data-noise-sound"));
        setAmbientMenu(false);
        if (focusNoiseBtn) focusNoiseBtn.focus();
      };
    });
    var noiseMenu = document.getElementById("focusNoiseMenu");
    if (noiseMenu) {
      noiseMenu.addEventListener("keydown", function (event) {
        var items = Array.prototype.slice.call(noiseMenu.querySelectorAll("[data-noise-sound]"));
        var index = items.indexOf(document.activeElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          var next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
          items[next].focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setAmbientMenu(false);
          if (focusNoiseBtn) focusNoiseBtn.focus();
        }
      });
    }
    document.addEventListener("click", function (event) {
      if (!ambientMenuOpen) return;
      var picker = document.querySelector(".noise-picker");
      if (picker && picker.contains(event.target)) return;
      setAmbientMenu(false);
    });
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
    document.getElementById("progressRangeSelect").onchange = function () {
      var nextRange = parseInt(this.value, 10);
      progressRangeDays = [3, 7, 14, 30].indexOf(nextRange) > -1 ? nextRange : 7;
      progressRangeOffset = 0;
      selectedProgressDate = "";
      renderProgress();
    };
    document.getElementById("progressWeekPrev").onclick = function () {
      progressRangeOffset -= 1;
      selectedProgressDate = "";
      renderProgress();
    };
    document.getElementById("progressWeekNext").onclick = function () {
      if (progressRangeOffset >= 0) return;
      progressRangeOffset += 1;
      selectedProgressDate = "";
      renderProgress();
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-chart-type]"), function (button) {
      button.onclick = function () {
        state.settings.chartType = button.getAttribute("data-chart-type") === "line" ? "line" : "bars";
        saveState();
        renderProgress();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-history-filter]"), function (button) {
      button.onclick = function () {
        currentHistoryFilter = button.getAttribute("data-history-filter") || "all";
        renderHistory();
      };
    });
    document.getElementById("rankLadderPrev").onclick = function () { scrollRankLadder(-1); };
    document.getElementById("rankLadderNext").onclick = function () { scrollRankLadder(1); };
    document.getElementById("rankLadder").addEventListener("scroll", updateRankLadderArrows);
    document.getElementById("saveLocalBtn").onclick = saveLocalSnapshot;
    document.getElementById("exportBackupBtn").onclick = exportBackup;
    document.getElementById("importBackupBtn").onclick = function () { document.getElementById("importBackupInput").click(); };
    document.getElementById("importBackupInput").onchange = importBackup;
    wirePersonalizeModal();
    document.getElementById("feedbackFab").onclick = openFeedback;
    document.getElementById("openFeedbackSettingsBtn").onclick = openFeedback;
    document.getElementById("feedbackCloseBtn").onclick = closeFeedback;
    document.getElementById("feedbackCancelBtn").onclick = closeFeedback;
    document.getElementById("feedbackSubmitBtn").onclick = submitFeedback;
    document.getElementById("feedbackNameInput").oninput = function () {
      this.removeAttribute("aria-invalid");
    };
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
    Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-channel]"), function (button) {
      button.onclick = function () {
        feedbackChannel = button.getAttribute("data-feedback-channel") || "whatsapp";
        Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-channel]"), function (item) {
          item.classList.toggle("active", item === button);
        });
        resetFeedbackButton(document.getElementById("feedbackSubmitBtn"));
        updateFeedbackDeliveryCopy();
        updateFeedbackDestination();
      };
    });
    document.getElementById("resetDataBtn").onclick = function () {
      if (confirm("This clears rank progress, tasks, and history here. If signed in, the reset will sync to the cloud copy. Continue?")) {
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
    if (document.visibilityState === "visible" && state.session &&
        ["running", "recovery"].indexOf(state.session.status) > -1 &&
        !(state.session.status === "recovery" && state.session.recoveryRemaining <= 0)) {
      startTicker();
    }
  }

  function handleStorageChange(event) {
    if (event.key !== STORAGE_KEY || state.session) return;
    state = loadState();
    renderAll();
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      if (timePickerOverlay && timePickerOverlay.classList.contains("open")) closeTimePicker();
      if (feedbackModal && feedbackModal.classList.contains("open")) closeFeedback();
      if (personalizeModal && personalizeModal.classList.contains("open")) closePersonalize();
      if (attentionTestModal && attentionTestModal.classList.contains("open")) closeAttentionTest();
    }
    if (event.code === "Space" && attentionRuntime && attentionRuntime.running && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes((document.activeElement || {}).tagName)) {
      event.preventDefault();
      registerAttentionTap();
    }
  }

  function persistStateForExit() {
    try {
      if (state.session && state.session.status === "running" && state.session.blockEndsAt) {
        state.session.blockRemaining = Math.max(0, Math.ceil((state.session.blockEndsAt - Date.now()) / 1000));
      }
      if (state.session && state.session.status === "recovery" && state.session.recoveryEndsAt) {
        state.session.recoveryRemaining = Math.max(0, Math.ceil((state.session.recoveryEndsAt - Date.now()) / 1000));
      }
      var serialized = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serialized);
      localStorage.setItem(EXIT_BACKUP_KEY, JSON.stringify({
        savedAt: Date.now(),
        appVersion: APP_VERSION,
        state: state
      }));
    } catch (error) {
      // The browser owns its storage quota. The unload flow must never trap the user.
    }
  }

  window.__DEECADENCE_DEBUG__ = {
    cumulativeXpForLevel: cumulativeXpForLevel,
    xpNeededForLevel: xpNeededForLevel,
    focusXpForSeconds: focusXpForSeconds,
    manualDoneXp: manualDoneXp,
    focusMinutesByDate: focusMinutesByDate,
    sustainableFocusProfile: sustainableFocusProfile,
    learnedFocusWindow: learnedFocusWindow,
    progressInsights: progressInsights,
    renderCadenceChart: renderCadenceChart,
    renderLineChart: renderLineChart,
    awardDailyGoalBonus: awardDailyGoalBonus,
    setAmbientEnabled: setAmbientEnabled,
    selectAmbientSound: selectAmbientSound,
    currentAmbientSound: currentAmbientSound,
    smartTaskRecommendations: smartTaskRecommendations,
    learningProfile: learningProfile,
    recordLearningEvent: recordLearningEvent,
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
    placeFlexibleTask: placeFlexibleTask,
    createNextRecurringTask: createNextRecurringTask,
    layoutScheduleBlocks: layoutScheduleBlocks,
    renderNowLine: renderNowLine,
    openWelcome: openWelcome,
    closeWelcome: closeWelcome,
    saveWelcomeSetup: saveWelcomeSetup,
    selectWelcomeOption: selectWelcomeOption,
    completeWelcome: completeWelcome,
    openAccountSetup: openAccountSetup,
    applyAccountProfile: applyAccountProfile,
    getAccountProfile: function () { return state.accountProfile; },
    startTour: startTour,
    endTour: endTour,
    persistStateForExit: persistStateForExit,
    getTourState: function () { return { active: tourActive, index: tourIndex }; },
    getState: function () { return state; },
    applySyncedState: function (incoming) {
      if (!incoming || typeof incoming !== "object") return false;
      var activeSession = state.session;
      var merged = Object.assign({}, incoming, { session: activeSession, feedbackOutbox: state.feedbackOutbox || [] });
      if (activeSession && activeSession.linkedTaskId) {
        var activeTask = state.tasks.find(function (task) { return task.id === activeSession.linkedTaskId; });
        var syncedTasks = Array.isArray(merged.tasks) ? merged.tasks.slice() : [];
        if (activeTask && !syncedTasks.some(function (task) { return task.id === activeTask.id; })) syncedTasks.push(activeTask);
        merged.tasks = syncedTasks;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      state = loadState();
      if (state.session) startTicker(); else stopTicker();
      saveState();
      renderAll();
      showToast("Cloud copy applied.");
      return true;
    }
  };

  window.__DEECADENCE_ACCOUNT__ = {
    openSetup: openAccountSetup,
    closeSetup: closeAccountSetup,
    applyProfile: applyAccountProfile,
    getName: accountProfileName
  };

  try {
    wireEvents();
  } catch (wireError) {
    console.error("wireEvents error:", wireError);
  }
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission().catch(function () {});
  }
  var remindedTaskIds = new Set();
  function checkTaskReminders() {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var today = todayStr();
    state.tasks.forEach(function (task) {
      if (!task.time || task.status === "completed") return;
      if (remindedTaskIds.has(task.id)) return;
      var taskMin = timeToMin(task.time);
      var diff = taskMin - nowMin;
      if (diff >= 0 && diff <= 5) {
        remindedTaskIds.add(task.id);
        new Notification("DeeCadence: " + task.title, {
          body: task.time + " · " + task.estMinutes + " min · " + task.priority + " priority",
          icon: "./icons/deecadence.svg",
          tag: "task-" + task.id
        });
      }
    });
  }
  setInterval(checkTaskReminders, 30000);
  checkTaskReminders();
  document.addEventListener("pointerdown", function () {
    if (brownNoiseEnabled && isFocusRunning() && (!ambientAudio || ambientAudio.paused)) startAmbientSound();
  }, true);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("online", retryFeedbackOutbox);
  window.addEventListener("pagehide", persistStateForExit);
  window.addEventListener("beforeunload", function (event) {
    persistStateForExit();
  });
  window.addEventListener("resize", function () {
    if (tourActive) positionTourCard(TOUR_STEPS[tourIndex]);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () { if (tourActive) positionTourCard(TOUR_STEPS[tourIndex]); });
    window.visualViewport.addEventListener("scroll", function () { if (tourActive) positionTourCard(TOUR_STEPS[tourIndex]); });
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof location !== "undefined" && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).catch(function () {});
    });
  }
  try {
    renderAll();
    switchView("today");
    if (state.settings.sound) primeSounds();
    if (brownNoiseEnabled && isFocusRunning()) {
      document.addEventListener("pointerdown", function resumeBrownNoise() {
        if (brownNoiseEnabled && isFocusRunning() && (!ambientAudio || ambientAudio.paused)) startAmbientSound();
      }, { once: true });
    }
    setTimeout(function () {
      openWelcome(false);
    }, 450);
    setInterval(function () {
      if (activeView === "today") renderToday();
      if (activeView === "plan" && currentPlanMode === "schedule" && currentPlanTab === "day") renderPlan();
    }, 60000);
    if (state.session && ["running", "recovery"].indexOf(state.session.status) > -1) startTicker();
  } catch (error) {
    console.error("DeeCadence init error:", error);
  }
  // The splash clears itself from the inline boot gate (or on error).
})();
