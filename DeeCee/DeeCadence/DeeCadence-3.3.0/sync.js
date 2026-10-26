(function () {
  "use strict";

  var projectUrl = (document.querySelector('meta[name="deecadence-sync-url"]') || {}).content || "";
  var publishableKey = (document.querySelector('meta[name="deecadence-sync-publishable-key"]') || {}).content || "";
  var redirectTarget = ((document.querySelector('meta[name="deecadence-sync-redirect-url"]') || {}).content || "").trim();
  var sdkUrl = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8/dist/umd/supabase.js";
  var storageKey = "deecadence_state_v3";
  var metaPrefix = "deecadence_sync_meta_v1_";
  var deviceKey = "deecadence_device_id_v1";
  var pendingKey = "deecadence_sync_pending_v1";
  var lastUserKey = "deecadence_sync_last_user_v1";
  var learningMetaPrefix = "deecadence_learning_upload_v1_";
  var signInCooldownKey = "deecadence_signin_cooldown_v1";
  var SAVE_DEBOUNCE_MS = 2500;
  var REMOTE_REFRESH_MS = 5 * 60 * 1000;
  var FOCUS_SYNC_MS = 60 * 1000;
  var AUTO_RETRY_BASE_MS = 5000;
  var AUTO_RETRY_MAX_MS = 5 * 60 * 1000;
  var LEARNING_UPLOAD_DEBOUNCE_MS = 15000;
  var LEARNING_BATCH_SIZE = 100;
  var focusLabels = {
    studying: "Studying",
    work: "Work",
    business: "Business",
    coding: "Coding",
    skill: "Learning a skill",
    discipline: "Personal discipline"
  };
  var client = null, user = null, busy = false, activating = false, timer = null, conflict = null, conflictDismissed = false, lastHash = "", sdkLoading = null;
  var authListenerBound = false, lastRemoteCheckAt = 0, lastFocusSyncAt = 0, lastDeviceCheckAt = 0;
  var deviceLocked = false, deviceClaimed = false, awaitingProfile = false, activationPromise = null, lastActivationUserId = "";
  var lastActivationAttemptAt = 0, lastMetadataSignature = "", startPromise = null, authNotice = "", memoryDeviceId = "";
  var switchingUser = false, authRefreshPromise = null, lastAuthRefreshAt = 0;
  var learningUploadTimer = null, learningUploadPromise = null, lastLearningUploadAttemptAt = 0;
  var signInCooldownTimer = null, signInCooldownUntil = 0, signInCooldownEmail = "", signInCooldownOwnsStatus = false;
  var autoRetryTimer = null, autoRetryAttempt = 0, signingOut = false;
  var status = document.getElementById("syncStatus");
  var form = document.getElementById("syncSignInForm");
  var signedOutCopy = document.getElementById("syncSignedOutCopy");
  var signedInCopy = document.getElementById("syncSignedInCopy");
  var email = document.getElementById("syncEmail");
  var signInButton = document.getElementById("syncSignInBtn");
  var cooldownNote = document.getElementById("syncCooldown");
  var codePanel = document.getElementById("syncCodePanel");
  var codeForm = document.getElementById("syncCodeForm");
  var codeInput = document.getElementById("syncCode");
  var codeButton = document.getElementById("syncCodeBtn");
  var controls = document.getElementById("syncAccountControls");
  var accountEmail = document.getElementById("syncAccountEmail");
  var syncButton = document.getElementById("syncNowBtn");
  var profileButton = document.getElementById("syncProfileBtn");
  var outButton = document.getElementById("syncSignOutBtn");
  var conflictBox = document.getElementById("syncConflict");
  var conflictNotice = document.getElementById("syncConflictNotice");
  var reviewConflictButton = document.getElementById("syncReviewConflictBtn");
  var conflictFab = document.getElementById("syncConflictFab");
  var conflictCloseButton = document.getElementById("syncConflictCloseBtn");
  var conflictCompare = document.getElementById("syncConflictCompare");
  var conflictDiff = document.getElementById("syncConflictDiff");
  var cloudButton = document.getElementById("syncUseCloudBtn");
  var deviceButton = document.getElementById("syncKeepDeviceBtn");
  var deviceLock = document.getElementById("syncDeviceLock");
  var deviceLockLabel = document.getElementById("syncDeviceLockLabel");
  var useDeviceButton = document.getElementById("syncUseThisDeviceBtn");

  var technicalErrorPattern = /(column reference|ambiguous|relation .* does not exist|function .* does not exist|could not find the function|schema cache|syntax error|permission denied|row-level security|JWT|invalid claim|PGRST|duplicate key|violates|SQLSTATE|Postgres|database|cloud setup|supabase)/i;

  function userSafeMessage(text) {
    var value = String(text || "").trim();
    if (!value) return "";
    if (technicalErrorPattern.test(value)) {
      try { console.warn("DeeCadence hid a technical sync error:", value); } catch (_) {}
      return "";
    }
    return value;
  }

  function message(text, kind) {
    if (!status) return;
    var safe = userSafeMessage(text);
    if (!safe) {
      safe = "Sync is temporarily unavailable. Your local work is safe and will retry.";
      kind = "info";
    }
    status.textContent = safe;
    status.setAttribute("data-status", kind || "info");
  }

  function signedOutMessage() {
    return "Your progress is saved on this device. Sign in to back it up and sync across devices.";
  }

  function pendingSignInMessage() {
    return "This browser is still signed out. If you opened the link on another device, that device is signed in. Open the link on this device, or request a new link for this browser. If your email includes a 6-digit code, you can enter it here instead.";
  }

  function readStoredCooldown() {
    try {
      var stored = JSON.parse(localStorage.getItem(signInCooldownKey) || "null");
      if (!stored || !Number.isFinite(Number(stored.until))) return null;
      return { until: Number(stored.until), email: String(stored.email || "") };
    } catch (_) {
      return null;
    }
  }

  function storeCooldown(until, address) {
    try {
      localStorage.setItem(signInCooldownKey, JSON.stringify({
        until: Number(until),
        email: String(address || "")
      }));
    } catch (_) {}
  }

  function clearStoredCooldown() {
    try { localStorage.removeItem(signInCooldownKey); } catch (_) {}
  }

  function cooldownSecondsLeft() {
    return Math.max(0, Math.ceil((signInCooldownUntil - Date.now()) / 1000));
  }

  function signInCooldownActive() {
    return cooldownSecondsLeft() > 0;
  }

  // Only this one line changes each second. The whole sync card must not
  // re-render, because that is what made the page look like it was reloading.
  function syncCooldownUI() {
    var seconds = cooldownSecondsLeft();
    if (cooldownNote) {
      if (seconds > 0) {
        cooldownNote.hidden = false;
        cooldownNote.textContent = "You can request another link in " + seconds + "s.";
      } else {
        cooldownNote.hidden = true;
        cooldownNote.textContent = "";
      }
    }
    if (signInButton) {
      if (seconds > 0) {
        signInButton.disabled = true;
        signInButton.setAttribute("aria-disabled", "true");
      } else {
        signInButton.removeAttribute("aria-disabled");
        signInButton.disabled = busy || activating;
      }
    }
    if (seconds <= 0) {
      if (signInCooldownTimer) {
        window.clearInterval(signInCooldownTimer);
        signInCooldownTimer = null;
      }
      if (signInCooldownUntil) {
        signInCooldownUntil = 0;
        signInCooldownEmail = "";
        clearStoredCooldown();
        if (signInCooldownOwnsStatus && !user) {
          signInCooldownOwnsStatus = false;
          message("You can request a new sign-in link now.", "info");
        }
      }
    }
    return seconds;
  }

  function beginSignInCooldown(seconds, address) {
    var wait = Math.max(1, Math.min(3600, parseInt(seconds, 10) || 60));
    signInCooldownUntil = Date.now() + wait * 1000;
    signInCooldownEmail = String(address || "").trim();
    signInCooldownOwnsStatus = true;
    storeCooldown(signInCooldownUntil, signInCooldownEmail);
    if (signInCooldownTimer) {
      window.clearInterval(signInCooldownTimer);
      signInCooldownTimer = null;
    }
    syncCooldownUI();
    signInCooldownTimer = window.setInterval(syncCooldownUI, 1000);
  }

  function clearSignInCooldown() {
    if (signInCooldownTimer) {
      window.clearInterval(signInCooldownTimer);
      signInCooldownTimer = null;
    }
    signInCooldownUntil = 0;
    signInCooldownEmail = "";
    signInCooldownOwnsStatus = false;
    clearStoredCooldown();
    syncCooldownUI();
  }

  function restoreSignInCooldown() {
    var stored = readStoredCooldown();
    if (!stored) return;
    var remaining = Math.ceil((stored.until - Date.now()) / 1000);
    if (remaining <= 0) {
      clearStoredCooldown();
      return;
    }
    signInCooldownUntil = stored.until;
    signInCooldownEmail = stored.email;
    signInCooldownOwnsStatus = false;
    syncCooldownUI();
    signInCooldownTimer = window.setInterval(syncCooldownUI, 1000);
  }

  function signInRateLimitSeconds(error) {
    var text = String(error && (error.message || error.error_description || error.msg) || "");
    var match = text.match(/(\d+)\s*seconds?/i);
    if (match && /(security|only request|rate|after)/i.test(text)) {
      return parseInt(match[1], 10) || 0;
    }
    if (error && (Number(error.status) === 429 ||
      error.code === "over_email_send_rate_limit" ||
      error.code === "over_request_rate_limit")) {
      return 60;
    }
    return 0;
  }

  function clearAutoRetry() {
    if (autoRetryTimer) {
      window.clearTimeout(autoRetryTimer);
      autoRetryTimer = null;
    }
  }

  function resetAutoRetry() {
    autoRetryAttempt = 0;
    clearAutoRetry();
  }

  // A signed-in user should not have to press "Sync now" after a transient
  // failure. Retry with a short backoff, capped at the normal refresh window.
  function scheduleAutoRetry() {
    if (autoRetryTimer || conflict || signingOut || !user || !client || !navigator.onLine || deviceLocked || awaitingProfile) return;
    var delay = Math.min(AUTO_RETRY_MAX_MS, AUTO_RETRY_BASE_MS * Math.pow(2, autoRetryAttempt));
    autoRetryAttempt = Math.min(autoRetryAttempt + 1, 6);
    autoRetryTimer = window.setTimeout(function () {
      autoRetryTimer = null;
      if (!user || !client || !navigator.onLine || deviceLocked || awaitingProfile) return;
      if (busy || activating) {
        scheduleAutoRetry();
        return;
      }
      if (!deviceClaimed || !lastDeviceCheckAt) {
        activateAccount();
        return;
      }
      verifyDeviceThenSync(true);
    }, delay);
  }

  function render() {
    var signed = Boolean(user);
    if (form) form.hidden = signed;
    if (codePanel) codePanel.hidden = signed;
    if (controls) controls.hidden = !signed;
    if (signedOutCopy) signedOutCopy.hidden = signed;
    if (signedInCopy) signedInCopy.hidden = !signed;
    if (accountEmail) accountEmail.textContent = signed ? user.email : "";
    if (deviceLock) deviceLock.hidden = !(signed && deviceLocked);
    var disabled = busy || activating || signingOut;
    [signInButton, codeButton, syncButton, profileButton, cloudButton, deviceButton, useDeviceButton].forEach(function (button) {
      if (button) button.disabled = disabled;
    });
    if (syncButton) syncButton.disabled = disabled || deviceLocked;
    // Signing out must remain available even while a background sync is running.
    if (outButton) {
      outButton.disabled = signingOut;
      outButton.textContent = signingOut ? "Signing out…" : "Sign out";
    }
    syncCooldownUI();
  }

  function readLocalState() {
    try {
      var stored = localStorage.getItem(storageKey);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch (_) {}
    var debug = window.__DEECADENCE_DEBUG__;
    return debug && debug.getState ? debug.getState() : {};
  }

  // Avoid loading the Supabase SDK for local-only visitors. It is needed only
  // when a session is already stored or when an email sign-in callback landed.
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i) || "";
        if (key === "supabase.auth.token" || (key.indexOf("sb-") === 0 && key.indexOf("auth-token") > -1)) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function hasAuthCallback() {
    var hash = location.hash || "";
    var query = location.search || "";
    return hash.indexOf("access_token=") > -1 ||
      hash.indexOf("error_description=") > -1 ||
      query.indexOf("code=") > -1 ||
      query.indexOf("error_description=") > -1 ||
      query.indexOf("error=") > -1;
  }

  function authCallbackError() {
    var raw = (location.hash || "").replace(/^#/, "");
    if (!raw) raw = (location.search || "").replace(/^\?/, "");
    if (!raw) return "";
    try {
      var params = new URLSearchParams(raw);
      var value = params.get("error_description") || params.get("error");
      return value ? decodeURIComponent(String(value).replace(/\+/g, " ")) : "";
    } catch (_) {
      return "";
    }
  }

  function rememberPendingSignIn(address) {
    try {
      localStorage.setItem(pendingKey, JSON.stringify({
        email: String(address || ""),
        requestedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function hasPendingSignIn() {
    try { return Boolean(localStorage.getItem(pendingKey)); } catch (_) { return false; }
  }

  function clearPendingSignIn() {
    try { localStorage.removeItem(pendingKey); } catch (_) {}
  }

  function shouldResumeSync() {
    return hasStoredSession() || hasAuthCallback();
  }

  function readLastUserId() {
    try { return localStorage.getItem(lastUserKey) || ""; } catch (_) { return ""; }
  }

  function storeLastUserId(id) {
    try {
      if (id) localStorage.setItem(lastUserKey, String(id));
    } catch (_) {}
  }

  function clearLocalProfileForAccountSwitch() {
    var bridge = window.__DEECADENCE_ACCOUNT__;
    if (bridge && typeof bridge.clearProfile === "function") {
      try { bridge.clearProfile(); return true; } catch (_) {}
    }
    // Safety net: never let an old profile travel inside a sync snapshot if
    // the app bridge is unavailable for any reason.
    try {
      var raw = localStorage.getItem(storageKey);
      if (raw) {
        var local = JSON.parse(raw);
        if (local && typeof local === "object") {
          local.accountProfile = { name: "", focus: "", focusCustom: "", dailyGoalMinutes: 0, completedAt: "" };
          if (local.profile) {
            local.profile.dailyGoalMinutes = 60;
            local.profile.dailyGoalBlocks = 4;
          }
          if (local.onboarding) local.onboarding.purpose = "";
          localStorage.setItem(storageKey, JSON.stringify(local));
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function prepareAccountUser(nextUser) {
    var nextId = nextUser ? nextUser.id : "";
    var lastId = readLastUserId();
    var switched = Boolean(nextId && lastId && lastId !== nextId);
    // A profile created before this owner marker existed cannot be tied to
    // an account. Clear it once so a different email never inherits it.
    var legacyProfile = Boolean(nextId && !lastId && profileComplete(readLocalState()));
    var cleared = false;
    if (switched || legacyProfile) {
      cleared = clearLocalProfileForAccountSwitch();
      lastMetadataSignature = "";
    }
    if (nextId) storeLastUserId(nextId);
    return cleared ? (switched ? "switch" : "legacy") : "";
  }

  function resetAccountRuntime() {
    clearConflictUI();
    deviceLocked = false;
    deviceClaimed = false;
    awaitingProfile = false;
    lastHash = "";
    lastRemoteCheckAt = 0;
    lastDeviceCheckAt = 0;
    lastActivationUserId = "";
    lastActivationAttemptAt = 0;
    lastMetadataSignature = "";
    resetAutoRetry();
    resetLearningUploadState();
  }

  function adoptAuthUser(nextUser, event) {
    if (signingOut && nextUser) return;
    var nextId = nextUser ? nextUser.id : "";
    var previousId = user ? user.id : "";
    var changed = nextId !== previousId;
    user = nextUser;
    if (user) {
      if (changed) resetAccountRuntime();
      switchingUser = true;
      var clearReason = prepareAccountUser(user);
      switchingUser = false;
      clearPendingSignIn();
      clearSignInCooldown();
      render();
      if (changed || lastActivationUserId !== user.id) {
        message(clearReason
          ? "Signed in as " + user.email + ". The previous local profile was cleared so it cannot be saved to this account. Your tasks and progress remain."
          : "Signed in. Checking your cloud backup...", "info");
        queueActivation();
      }
      return;
    }
    resetAccountRuntime();
    render();
    if (authNotice) {
      message(authNotice, "info");
      authNotice = "";
    } else if (event === "SIGNED_OUT") {
      message("Signed out. Your work is still saved on this device.", "success");
    } else {
      message(signedOutMessage(), "info");
    }
  }

  async function refreshAuthFromSession() {
    if (signingOut) return false;
    if (authRefreshPromise) return authRefreshPromise;
    authRefreshPromise = (async function () {
      try {
        if (!client) {
          if (!hasStoredSession()) return false;
          await start();
          return true;
        }
        var result = await client.auth.getSession();
        if (result.error) throw result.error;
        var nextUser = result.data.session ? result.data.session.user : null;
        var nextId = nextUser ? nextUser.id : "";
        var previousId = user ? user.id : "";
        if (nextId === previousId) return false;
        adoptAuthUser(nextUser, nextId ? "SIGNED_IN" : "SIGNED_OUT");
        return true;
      } catch (_) {
        return false;
      } finally {
        authRefreshPromise = null;
      }
    }());
    return authRefreshPromise;
  }

  // The running timer and the feedback delivery queue belong to one device.
  // Everything else, including the account profile, can travel through the account.
  function snapshot(state) {
    var copy = JSON.parse(JSON.stringify(state || {}));
    copy.session = null;
    copy.feedbackOutbox = [];
    return copy;
  }

  function hasData(state) {
    state = state || {};
    var profile = state.profile || {};
    var setup = state.onboarding || {};
    var settings = state.settings || {};
    var changedSettings = (settings.theme && settings.theme !== "dark") ||
      settings.sound === false || settings.soundPreferenceTouched ||
      settings.brownNoise || (settings.ambientSound && settings.ambientSound !== "brown") ||
      (settings.chartType && settings.chartType !== "bars") ||
      settings.welcomeComplete || settings.tutorialComplete;
    var changedGoals = (Number(profile.dailyGoalMinutes) && Number(profile.dailyGoalMinutes) !== 60) ||
      (Number(profile.dailyGoalBlocks) && Number(profile.dailyGoalBlocks) !== 4);
    var hasDailyLog = Object.keys(state.dailyBlockLog || {}).some(function (key) {
      return Number(state.dailyBlockLog[key]) > 0;
    }) || Object.keys(state.dailyFocusMinutes || {}).some(function (key) {
      return Number(state.dailyFocusMinutes[key]) > 0;
    });
    return Boolean(Number(profile.totalXp) || Number(profile.streak) || profile.lastActiveDate ||
      changedGoals || changedSettings || hasDailyLog ||
      (state.tasks || []).length || (state.savedSessions || []).length ||
      (state.history || []).length || (state.attentionTests || []).length ||
      (state.baselineScore !== null && state.baselineScore !== undefined) ||
      Object.keys(state.dismissedContextTips || {}).length ||
      (state.learning && Array.isArray(state.learning.events) && state.learning.events.length) ||
      setup.purpose || setup.target || setup.challenge || setup.goal ||
      (setup.focusWindow && setup.focusWindow !== "not-sure") || setup.firstAction);
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      var ordered = {};
      Object.keys(value).sort().forEach(function (name) { ordered[name] = stable(value[name]); });
      return ordered;
    }
    return value;
  }

  function hash(value) {
    var text = JSON.stringify(stable(value));
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (bytes) {
        return Array.prototype.map.call(new Uint8Array(bytes), function (byte) {
          return byte.toString(16).padStart(2, "0");
        }).join("");
      });
    }
    var result = 2166136261;
    for (var i = 0; i < text.length; i += 1) result = Math.imul(result ^ text.charCodeAt(i), 16777619);
    return Promise.resolve((result >>> 0).toString(16));
  }

  function metaKey() { return metaPrefix + (user ? user.id : "anonymous"); }

  function readMeta() {
    try { return JSON.parse(localStorage.getItem(metaKey()) || "null"); } catch (_) { return null; }
  }

  function saveMeta(row, valueHash) {
    try {
      localStorage.setItem(metaKey(), JSON.stringify({ revision: Number(row.revision), hash: valueHash }));
    } catch (_) {}
  }

  function loadSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (sdkLoading) return sdkLoading;
    sdkLoading = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = sdkUrl;
      script.async = true;
      script.setAttribute("data-deecadence-supabase-sdk", "true");
      script.onload = function () {
        if (window.supabase && window.supabase.createClient) resolve();
        else reject(new Error("The sign-in library did not initialize."));
      };
      script.onerror = function () { reject(new Error("The sign-in service could not be reached.")); };
      document.head.appendChild(script);
    }).catch(function (error) {
      sdkLoading = null;
      throw error;
    });
    return sdkLoading;
  }

  function initClient() {
    if (!projectUrl || !publishableKey) throw new Error("Cloud sync is not configured.");
    if (!client) client = window.supabase.createClient(projectUrl, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  function getDeviceId() {
    try {
      var existing = localStorage.getItem(deviceKey);
      if (existing && existing.length >= 8) return existing;
    } catch (_) {}
    if (memoryDeviceId) return memoryDeviceId;
    var id = "";
    try {
      if (window.crypto && window.crypto.randomUUID) id = window.crypto.randomUUID();
    } catch (_) {}
    if (!id) {
      id = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
    }
    memoryDeviceId = id;
    try { localStorage.setItem(deviceKey, id); } catch (_) {}
    return id;
  }

  function learningMetaKey(userId) {
    return learningMetaPrefix + String(userId || "anonymous");
  }

  function readLearningMeta(userId) {
    try {
      return JSON.parse(localStorage.getItem(learningMetaKey(userId)) || "null");
    } catch (_) {
      return null;
    }
  }

  function saveLearningMeta(userId, value) {
    try {
      localStorage.setItem(learningMetaKey(userId), JSON.stringify(value));
    } catch (_) {}
  }

  function learningAppVersion() {
    var local = readLocalState();
    return String(local.appVersion || "3.3.0");
  }

  function pendingLearningEvents(userId) {
    var local = readLocalState();
    var events = local && local.learning && Array.isArray(local.learning.events)
      ? local.learning.events
      : [];
    events = events.filter(function (event) {
      return event && typeof event.id === "string" && event.id.length >= 8 &&
        typeof event.type === "string" && event.type.length &&
        Number.isFinite(Number(event.t));
    });
    var meta = readLearningMeta(userId);
    if (meta && typeof meta.lastEventId === "string") {
      var index = -1;
      for (var i = events.length - 1; i >= 0; i -= 1) {
        if (events[i].id === meta.lastEventId) {
          index = i;
          break;
        }
      }
      if (index > -1) events = events.slice(index + 1);
    }
    return events.slice(-500);
  }

  function resetLearningUploadState() {
    if (learningUploadTimer) {
      window.clearTimeout(learningUploadTimer);
      learningUploadTimer = null;
    }
    lastLearningUploadAttemptAt = 0;
  }

  function uploadLearningEvents(force) {
    if (!user || !client || !deviceClaimed || deviceLocked || !navigator.onLine || signingOut) {
      return Promise.resolve(false);
    }
    if (learningUploadPromise) return learningUploadPromise;
    var now = Date.now();
    if (!force && now - lastLearningUploadAttemptAt < 10000) return Promise.resolve(false);
    var pending = pendingLearningEvents(user.id);
    if (!pending.length) return Promise.resolve(false);
    lastLearningUploadAttemptAt = now;
    var targetUserId = user.id;
    var targetDeviceId = getDeviceId();
    var appVersion = learningAppVersion();
    learningUploadPromise = (async function () {
      try {
        for (var i = 0; i < pending.length; i += LEARNING_BATCH_SIZE) {
          // Do not let a sign-out, account switch, or device takeover send
          // events recorded under one account into another session.
          if (!user || user.id !== targetUserId || getDeviceId() !== targetDeviceId || signingOut) return false;
          var batch = pending.slice(i, i + LEARNING_BATCH_SIZE);
          var result = await client.rpc("deecadence_ingest_learning_events", {
            p_device_id: targetDeviceId,
            p_events: batch,
            p_app_version: appVersion
          });
          if (result.error) throw result.error;
        }
        if (user && user.id === targetUserId) {
          saveLearningMeta(targetUserId, {
            lastEventId: pending[pending.length - 1].id,
            uploadedAt: new Date().toISOString()
          });
        }
        return true;
      } catch (_) {
        // The local event log remains the backup. A later event, focus check,
        // or reconnect retries the same batch.
        return false;
      } finally {
        learningUploadPromise = null;
      }
    }());
    return learningUploadPromise;
  }

  function scheduleLearningUpload() {
    if (!user || !client || !deviceClaimed || deviceLocked || !navigator.onLine || signingOut) return;
    if (learningUploadTimer) window.clearTimeout(learningUploadTimer);
    learningUploadTimer = window.setTimeout(function () {
      learningUploadTimer = null;
      uploadLearningEvents(true);
    }, LEARNING_UPLOAD_DEBOUNCE_MS);
  }

  function deviceLabel() {
    var ua = navigator.userAgent || "";
    var browser = "Browser";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/OPR\//.test(ua)) browser = "Opera";
    else if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua)) browser = "Safari";
    var os = "device";
    if (/Windows/.test(ua)) os = "Windows";
    else if (/Android/.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
    else if (/Mac OS X/.test(ua)) os = "macOS";
    else if (/Linux/.test(ua)) os = "Linux";
    return browser + " on " + os;
  }

  function claimDevice(takeover) {
    return client.rpc("deecadence_claim_device", {
      p_device_id: getDeviceId(),
      p_device_label: deviceLabel(),
      p_takeover: Boolean(takeover)
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      return row || { claimed: false, active_device_id: "", active_device_label: "", active_since: null };
    });
  }

  function releaseDevice() {
    return client.rpc("deecadence_release_device", { p_device_id: getDeviceId() })
      .then(function (result) {
        if (result.error) throw result.error;
        return result.data === true;
      });
  }

  function verifyActiveDevice() {
    return client.rpc("deecadence_touch_device", { p_device_id: getDeviceId() })
      .then(function (result) {
        if (result.error) throw result.error;
        if (result.data !== true) {
          return revokeLocalSession().then(function () { return false; });
        }
        lastDeviceCheckAt = Date.now();
        return true;
      });
  }

  function isDeviceError(error) {
    var text = String(error && (error.message || error.details || error.hint) || "");
    return text.indexOf("device is not active") > -1 || text.indexOf("device is not registered") > -1;
  }

  function isMissingCloudSetup(error) {
    var text = String(error && (error.message || error.details || error.hint) || "");
    return /deecadence_(claim_device|touch_device|release_device|save_sync_snapshot)/.test(text) &&
      /could not find|schema cache|does not exist|not found/i.test(text);
  }

  // Keep setup details in the console for whoever maintains the project.
  // People using DeeCadence only need to know that local work is safe.
  function reportCloudSetupIssue(error) {
    try {
      console.warn("DeeCadence cloud setup is incomplete:", error && (error.message || error));
    } catch (_) {}
    message("Cloud sync is temporarily unavailable. Your work is saved on this device and will retry automatically.", "info");
  }

  function deviceName(claim) {
    var label = claim && claim.active_device_label ? String(claim.active_device_label).trim() : "";
    return label || "another device";
  }

  function profileName(state) {
    var profile = state && state.accountProfile;
    return profile && typeof profile === "object" ? String(profile.name || "").trim() : "";
  }

  function profileComplete(state) {
    var profile = state && state.accountProfile;
    return Boolean(profile && typeof profile === "object" &&
      String(profile.name || "").trim() &&
      String(profile.completedAt || "").trim());
  }

  function profileFromRow(row) {
    var profile = row && row.payload && row.payload.accountProfile;
    return profile && typeof profile === "object" && String(profile.name || "").trim() ? profile : null;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function finiteNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function formatCount(value) {
    return Math.max(0, Math.round(finiteNumber(value))).toLocaleString();
  }

  function formatFocusMinutes(value) {
    var minutes = Math.max(0, Math.round(finiteNumber(value)));
    if (minutes < 60) return minutes + " min";
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return hours + "h" + (rest ? " " + rest + "m" : "");
  }

  function profileFocusLabel(profile) {
    var focus = String(profile && profile.focus || "").trim();
    if (focus === "custom") return String(profile.focusCustom || "").trim() || "Custom";
    return focusLabels[focus] || focus;
  }

  function conflictTimeValue(value) {
    if (!value) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    var text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += "T00:00:00";
    var time = new Date(text).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function formatConflictTime(value, dateOnly) {
    var time = conflictTimeValue(value);
    if (!time) return "";
    var date = new Date(time);
    var now = new Date();
    if (dateOnly) {
      var dateOptions = { month: "short", day: "numeric" };
      if (date.getFullYear() !== now.getFullYear()) dateOptions.year = "numeric";
      return date.toLocaleDateString(undefined, dateOptions);
    }
    var options = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
    if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
    return date.toLocaleString(undefined, options);
  }

  function latestActivityAt(state) {
    state = state && typeof state === "object" ? state : {};
    var latest = 0;
    function consider(value) {
      var time = conflictTimeValue(value);
      if (time > latest) latest = time;
    }
    (Array.isArray(state.history) ? state.history : []).forEach(function (item) {
      consider(item && item.completedAt);
    });
    (Array.isArray(state.savedSessions) ? state.savedSessions : []).forEach(function (item) {
      consider(item && item.savedAt);
    });
    (Array.isArray(state.attentionTests) ? state.attentionTests : []).forEach(function (item) {
      consider(item && item.takenAt);
    });
    if (latest) return { time: latest, dateOnly: false };
    var profile = state.profile && typeof state.profile === "object" ? state.profile : {};
    var lastActive = String(profile.lastActiveDate || "").trim();
    if (lastActive) {
      return {
        time: conflictTimeValue(lastActive),
        dateOnly: /^\d{4}-\d{2}-\d{2}$/.test(lastActive)
      };
    }
    return null;
  }

  function conflictStateSummary(state) {
    state = state && typeof state === "object" ? state : {};
    var profile = state.accountProfile && typeof state.accountProfile === "object" ? state.accountProfile : {};
    var progress = state.profile && typeof state.profile === "object" ? state.profile : {};
    var tasks = Array.isArray(state.tasks) ? state.tasks : [];
    var history = Array.isArray(state.history) ? state.history : [];
    var saved = Array.isArray(state.savedSessions) ? state.savedSessions : [];
    var tests = Array.isArray(state.attentionTests) ? state.attentionTests : [];
    var taskDone = 0;
    tasks.forEach(function (task) {
      var units = task && task.units && typeof task.units === "object" ? task.units : {};
      var total = Math.max(1, parseInt(units.total, 10) || 1);
      var done = Math.max(0, Math.min(total, parseInt(units.completed, 10) || 0));
      if (done >= total || (task && task.status === "completed")) taskDone += 1;
    });
    var focusMinutes = 0;
    var dailyFocus = state.dailyFocusMinutes && typeof state.dailyFocusMinutes === "object" ? state.dailyFocusMinutes : {};
    Object.keys(dailyFocus).forEach(function (key) {
      focusMinutes += Math.max(0, finiteNumber(dailyFocus[key]));
    });
    if (!focusMinutes) {
      focusMinutes = history.reduce(function (sum, item) {
        var planned = Math.max(0, finiteNumber(item && item.blocksPlanned));
        var completed = Math.max(0, finiteNumber(item && item.blocksCompleted));
        var minutes = Math.max(0, finiteNumber(item && item.totalMinutes));
        if (!minutes) return sum;
        if (planned > 0 && completed > 0) return sum + Math.round(minutes * Math.min(1, completed / planned));
        return sum + minutes;
      }, 0);
    }
    var name = String(profile.name || "").trim();
    var focus = profileFocusLabel(profile);
    var goal = Math.max(0, parseInt(profile.dailyGoalMinutes, 10) || 0);
    var profileText = name
      ? name + (focus ? " · " + focus : "") + (goal ? " · " + goal + " min/day" : "")
      : "Not set up";
    var latestTest = tests.length ? tests[tests.length - 1] : null;
    var latestScore = latestTest && Number.isFinite(Number(latestTest.score))
      ? Math.round(Number(latestTest.score))
      : null;
    var activity = latestActivityAt(state);
    var streak = Math.max(0, Math.round(finiteNumber(progress.streak)));
    return {
      profile: profileText,
      tasks: tasks.length ? (tasks.length - taskDone) + " open · " + tasks.length + " total" : "No tasks",
      sessions: history.length || saved.length
        ? [history.length ? history.length + " logged" : "", saved.length ? saved.length + " saved" : ""].filter(Boolean).join(" · ")
        : "None yet",
      focus: formatFocusMinutes(focusMinutes),
      xp: formatCount(progress.totalXp) + " XP",
      attention: tests.length
        ? tests.length + " check" + (tests.length === 1 ? "" : "s") + (latestScore === null ? "" : " · latest " + latestScore + "/100")
        : "None yet",
      streak: streak ? streak + " day" + (streak === 1 ? "" : "s") : "No streak yet",
      activity: activity ? formatConflictTime(activity.time, activity.dateOnly) : "No activity yet"
    };
  }

  function renderConflictComparison(row) {
    if (!conflictCompare) return;
    var device = conflictStateSummary(readLocalState());
    var cloud = conflictStateSummary(row && row.payload || {});
    var rows = [
      ["profile", "Profile"],
      ["tasks", "Tasks"],
      ["sessions", "Sessions"],
      ["focus", "Focus time"],
      ["xp", "Total XP"],
      ["attention", "Attention checks"],
      ["streak", "Current streak"],
      ["activity", "Last activity"]
    ];
    var differenceCount = 0;
    var deviceRows = "";
    var cloudRows = "";
    rows.forEach(function (entry) {
      var key = entry[0];
      var label = entry[1];
      var different = device[key] !== cloud[key];
      if (different) differenceCount += 1;
      var rowClass = "sync-copy-row" + (different ? " is-different" : "");
      deviceRows += '<div class="' + rowClass + '"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(device[key]) + '</dd></div>';
      cloudRows += '<div class="' + rowClass + '"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(cloud[key]) + '</dd></div>';
    });
    var backup = formatConflictTime(row && row.updated_at, false);
    if (conflictDiff) {
      conflictDiff.textContent = differenceCount
        ? differenceCount + " detail" + (differenceCount === 1 ? " differs" : "s differ") + " between the copies. Highlighted values are the differences."
        : "The main saved details match. Other settings may still differ.";
    }
    conflictCompare.innerHTML =
      '<section class="sync-copy-card sync-copy-card--device" aria-label="This device copy">' +
        '<div class="sync-copy-head"><span class="sync-copy-tag">This device</span><span class="sync-copy-time">Current local copy</span></div>' +
        '<dl class="sync-copy-facts">' + deviceRows + '</dl>' +
        '<p class="sync-copy-effect"><strong>Keep this device</strong> uploads this copy and replaces the cloud copy. Your running timer stays here.</p>' +
      '</section>' +
      '<section class="sync-copy-card sync-copy-card--cloud" aria-label="Cloud copy">' +
        '<div class="sync-copy-head"><span class="sync-copy-tag">Cloud copy</span><span class="sync-copy-time">' + (backup ? "Backed up " + escapeHtml(backup) : "Backup time unavailable") + '</span></div>' +
        '<dl class="sync-copy-facts">' + cloudRows + '</dl>' +
        '<p class="sync-copy-effect"><strong>Use cloud copy</strong> replaces this device\'s synced data. A recovery copy is saved in this browser first. Your running timer stays here.</p>' +
      '</section>';
  }

  function openConflictReview() {
    if (!conflict) return;
    conflictDismissed = false;
    var wasHidden = !conflictBox || conflictBox.hidden;
    renderConflictComparison(conflict);
    if (conflictNotice) conflictNotice.hidden = false;
    if (conflictFab) conflictFab.hidden = true;
    if (conflictBox) {
      conflictBox.hidden = false;
      conflictBox.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("sync-conflict-open");
    if (wasHidden && conflictCloseButton) {
      window.setTimeout(function () { conflictCloseButton.focus(); }, 0);
    }
  }

  function closeConflictReview() {
    if (!conflictBox || conflictBox.hidden) return;
    conflictDismissed = true;
    conflictBox.hidden = true;
    conflictBox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sync-conflict-open");
    if (conflict) {
      if (conflictNotice) conflictNotice.hidden = false;
      if (conflictFab) conflictFab.hidden = false;
      message("No changes made. Review the two copies when you're ready.", "conflict");
    }
    window.setTimeout(function () {
      if (conflictFab) conflictFab.focus();
      else if (reviewConflictButton) reviewConflictButton.focus();
    }, 0);
  }

  function clearConflictUI() {
    conflict = null;
    conflictDismissed = false;
    if (conflictBox) {
      conflictBox.hidden = true;
      conflictBox.setAttribute("aria-hidden", "true");
    }
    if (conflictNotice) conflictNotice.hidden = true;
    if (conflictFab) conflictFab.hidden = true;
    if (conflictCompare) conflictCompare.innerHTML = "";
    if (conflictDiff) conflictDiff.textContent = "";
    document.body.classList.remove("sync-conflict-open");
  }

  function copyProfileFromRow(row) {
    if (profileComplete(readLocalState())) return Promise.resolve(false);
    var profile = profileFromRow(row);
    if (!profile) return Promise.resolve(false);
    var bridge = window.__DEECADENCE_ACCOUNT__;
    var applied = bridge && typeof bridge.applyProfile === "function" ? bridge.applyProfile(profile) : false;
    if (!applied) {
      var debug = window.__DEECADENCE_DEBUG__;
      applied = debug && typeof debug.applyAccountProfile === "function" ? debug.applyAccountProfile(profile) : false;
    }
    if (applied) syncProfileMetadata();
    return Promise.resolve(Boolean(applied));
  }

  function requestProfile(force) {
    if (signingOut) return;
    if (awaitingProfile && !force) return;
    resetAutoRetry();
    awaitingProfile = true;
    message(profileComplete(readLocalState())
      ? "Update your name and account details. They are saved with your synced progress."
      : "Almost there. Add your name and a couple of account details to finish the first cloud save.", "info");
    var detail = { email: user ? user.email : "", device: deviceLabel() };
    var bridge = window.__DEECADENCE_ACCOUNT__;
    if (bridge && typeof bridge.openSetup === "function") {
      try {
        bridge.openSetup(detail);
        return;
      } catch (_) {}
    }
    try {
      window.dispatchEvent(new CustomEvent("deecadence:account-profile-required", { detail: detail }));
    } catch (_) {}
  }

  function closeSetupModal() {
    var bridge = window.__DEECADENCE_ACCOUNT__;
    if (bridge && typeof bridge.closeSetup === "function") {
      try { bridge.closeSetup(); } catch (_) {}
    }
  }

  // Keep the Supabase user record readable in the dashboard. The synced state
  // remains the source of truth; this is a small, non-blocking metadata copy.
  function syncProfileMetadata() {
    if (!client || !user || signingOut) return Promise.resolve(false);
    var targetId = user.id;
    var local = readLocalState();
    var profile = local.accountProfile && typeof local.accountProfile === "object" ? local.accountProfile : {};
    var name = String(profile.name || "").trim().slice(0, 60);
    if (!name) return Promise.resolve(false);
    var focusCustom = String(profile.focusCustom || "").trim();
    var focusLabel = profile.focus === "custom" ? focusCustom : String(profile.focus || "").trim();
    var signature = [name, profile.focus || "", focusCustom, Number(profile.dailyGoalMinutes) || 0].join("|");
    if (signature === lastMetadataSignature) return Promise.resolve(true);
    return client.auth.updateUser({
      data: {
        display_name: name,
        full_name: name,
        focus_area: focusLabel,
        focus_custom: focusCustom,
        daily_goal_minutes: Number(profile.dailyGoalMinutes) || 0
      }
    }).then(function (result) {
      if (result.error) throw result.error;
      if (signingOut || !user || user.id !== targetId) return false;
      lastMetadataSignature = signature;
      return true;
    }).catch(function () {
      return false;
    });
  }

  function bindAuthListener() {
    if (authListenerBound || !client) return;
    authListenerBound = true;
    client.auth.onAuthStateChange(function (event, session) {
      adoptAuthUser(session && session.user ? session.user : null, event);
    });
  }

  function queueActivation() {
    if (!user || !client || signingOut) return;
    window.setTimeout(function () { activateAccount(); }, 0);
  }

  function activateAccount() {
    if (!user || !client || signingOut) return Promise.resolve();
    if (activationPromise) {
      if (lastActivationUserId === user.id) return activationPromise;
      // The account changed while a check was running. Let the old check
      // finish, then claim the device for the new account instead of
      // leaving it unclaimed until the next focus event.
      var waitingId = user.id;
      return activationPromise.then(function () {
        if (user && user.id === waitingId) return activateAccount();
      });
    }
    var targetId = user.id;
    lastActivationUserId = targetId;
    lastActivationAttemptAt = Date.now();
    var run;
    run = (async function () {
      activating = true;
      render();
      try {
        var claim = await claimDevice(false);
        if (!user || user.id !== targetId || activationPromise !== run || signingOut) {
          if (signingOut) {
            try { await withTimeout(releaseDevice(), 2000); } catch (_) {}
          }
          return;
        }
        lastDeviceCheckAt = Date.now();
        if (!claim || !claim.claimed) {
          deviceClaimed = false;
          deviceLocked = true;
          clearConflictUI();
          resetAutoRetry();
          if (deviceLockLabel) deviceLockLabel.textContent = deviceName(claim);
          message("This account is already active on " + deviceName(claim) + ". DeeCadence allows one active device per account for now. Sign out there first, or use this device instead.", "conflict");
          return;
        }
        deviceClaimed = true;
        deviceLocked = false;
        render();
        syncProfileMetadata();
        await synchronize(true);
        uploadLearningEvents(true);
      } catch (error) {
        if (!user || user.id !== targetId || activationPromise !== run || signingOut) return;
        deviceClaimed = false;
        if (isDeviceError(error)) {
          resetAutoRetry();
          await revokeLocalSession();
          return;
        }
        if (isMissingCloudSetup(error)) {
          reportCloudSetupIssue(error);
          scheduleAutoRetry();
          return;
        }
        scheduleAutoRetry();
        message("Signed in. Cloud sync is unavailable right now; your work stays saved here and will retry automatically.", "info");
      } finally {
        if (activationPromise === run) {
          activating = false;
          activationPromise = null;
          render();
        }
      }
    }());
    activationPromise = run;
    return activationPromise;
  }

  function readRemote() {
    return client.from("deecadence_sync_state").select("revision,payload,updated_at")
      .eq("user_id", user.id).maybeSingle().then(function (result) {
        if (result.error) throw result.error;
        return result.data || null;
      });
  }

  function push(value, revision) {
    return client.rpc("deecadence_save_sync_snapshot", {
      p_expected_revision: revision,
      p_payload: value,
      p_device_id: getDeviceId()
    }).then(function (result) {
      if (result.error) throw result.error;
      lastDeviceCheckAt = Date.now();
      return Array.isArray(result.data) ? (result.data[0] || null) : null;
    });
  }

  function showConflict(row) {
    clearAutoRetry();
    conflict = row;
    if (conflictNotice) conflictNotice.hidden = false;
    if (conflictDismissed) {
      renderConflictComparison(conflict);
      if (conflictFab) conflictFab.hidden = false;
      message("Two copies still need your review. Nothing has been replaced.", "conflict");
      return;
    }
    openConflictReview();
    message("Cloud and this device both changed. Compare the two copies, then choose which one to keep.", "conflict");
  }

  async function applyCloud(row) {
    if (signingOut) return;
    var local = readLocalState();
    try {
      localStorage.setItem(storageKey + "_before_cloud", JSON.stringify({
        savedAt: new Date().toISOString(),
        reason: "Before applying the cloud copy",
        state: local
      }));
    } catch (_) {}
    var remoteHash = await hash(snapshot(row.payload || {}));
    if (signingOut) return;
    var next = Object.assign({}, row.payload || {}, {
      session: local.session || null,
      feedbackOutbox: local.feedbackOutbox || []
    });
    // A completed local profile is newer than an older cloud snapshot that
    // predates the profile step. Keep it and let the next save upload it.
    if (!profileComplete(next) && profileComplete(local)) next.accountProfile = local.accountProfile;
    var debug = window.__DEECADENCE_DEBUG__;
    if (!debug || !debug.applySyncedState || !debug.applySyncedState(next)) {
      throw new Error("Could not apply the cloud copy.");
    }
    if (signingOut) return;
    if (profileName(readLocalState())) syncProfileMetadata();
    saveMeta(row, remoteHash);
    lastHash = remoteHash;
    clearConflictUI();
    resetAutoRetry();
    message("Cloud copy applied. Your active timer stays on this device.", "success");
  }

  function saveSucceeded(row, valueHash) {
    if (!row || signingOut) return false;
    saveMeta(row, valueHash);
    lastHash = valueHash;
    resetAutoRetry();
    message("Up to date. Last saved " + new Date(row.updated_at || Date.now()).toLocaleString() + ".", "success");
    return true;
  }

  function syncStillCurrent(id) {
    return Boolean(user && user.id === id && !signingOut);
  }

  async function synchronize(force) {
    if (!user || !client || busy || signingOut) return;
    var targetId = user.id;
    if (deviceLocked) {
      if (force) message("This account is active on another device. Use this device instead to move it here.", "conflict");
      return;
    }
    if (!deviceClaimed) {
      if (force) activateAccount();
      return;
    }
    if (awaitingProfile) {
      if (force) requestProfile(true);
      return;
    }
    if (!navigator.onLine) {
      if (force) message("You are offline. Your work stays saved on this device and will sync when the connection returns.", "info");
      return;
    }
    busy = true;
    render();
    try {
      var local = snapshot(readLocalState());
      var localHash = await hash(local);
      if (!syncStillCurrent(targetId)) return;
      if (!force && localHash === lastHash) return;
      var meta = readMeta();
      var remote = await readRemote();
      if (!syncStillCurrent(targetId)) return;
      lastRemoteCheckAt = Date.now();

      if (!remote) {
        if (!profileComplete(local)) {
          requestProfile();
          return;
        }
        var firstSave = await push(local, 0);
        if (!syncStillCurrent(targetId)) return;
        if (saveSucceeded(firstSave, localHash)) return;
        remote = await readRemote();
        if (!syncStillCurrent(targetId)) return;
        if (!remote) throw new Error("The first cloud save did not complete. DeeCadence will retry automatically.");
      }

      var remoteHash = await hash(snapshot(remote.payload || {}));
      if (!syncStillCurrent(targetId)) return;
      if (remoteHash === localHash) {
        saveMeta(remote, localHash);
        lastHash = localHash;
        resetAutoRetry();
        if (!profileComplete(local)) {
          requestProfile();
          return;
        }
        message("Up to date. This device and the cloud copy match.", "success");
        return;
      }

      if (!meta) {
        if (!hasData(local)) {
          await applyCloud(remote);
          if (!syncStillCurrent(targetId)) return;
          if (!profileComplete(readLocalState())) requestProfile();
          return;
        }
        if (hasData(remote.payload)) {
          if (!profileComplete(local) && !profileFromRow(remote)) {
            requestProfile();
            return;
          }
          showConflict(remote);
          return;
        }
        if (!profileComplete(local)) {
          var copied = await copyProfileFromRow(remote);
          if (!syncStillCurrent(targetId)) return;
          if (copied) {
            local = snapshot(readLocalState());
            localHash = await hash(local);
          }
          if (!profileComplete(local)) {
            requestProfile();
            return;
          }
        }
        var firstMerge = await push(local, Number(remote.revision));
        if (!syncStillCurrent(targetId)) return;
        if (saveSucceeded(firstMerge, localHash)) return;
        remote = await readRemote();
        if (!syncStillCurrent(targetId)) return;
        if (remote) showConflict(remote);
        return;
      }

      var localChanged = localHash !== meta.hash;
      var remoteChanged = Number(remote.revision) !== Number(meta.revision) || remoteHash !== meta.hash;
      if (localChanged && remoteChanged) {
        if (!profileComplete(local) && !profileFromRow(remote)) {
          requestProfile();
          return;
        }
        showConflict(remote);
        return;
      }
      if (remoteChanged && !localChanged) {
        await applyCloud(remote);
        if (!syncStillCurrent(targetId)) return;
        if (!profileComplete(readLocalState())) requestProfile();
        return;
      }
      if (localChanged) {
        if (!profileComplete(local)) {
          var copiedLocal = await copyProfileFromRow(remote);
          if (!syncStillCurrent(targetId)) return;
          if (copiedLocal) {
            local = snapshot(readLocalState());
            localHash = await hash(local);
          }
          if (!profileComplete(local)) {
            requestProfile();
            return;
          }
        }
        var saved = await push(local, Number(remote.revision));
        if (!syncStillCurrent(targetId)) return;
        if (saveSucceeded(saved, localHash)) return;
        remote = await readRemote();
        if (!syncStillCurrent(targetId)) return;
        if (remote) showConflict(remote);
        return;
      }
      if (!syncStillCurrent(targetId)) return;
      saveMeta(remote, localHash);
      lastHash = localHash;
      resetAutoRetry();
      if (!profileComplete(local)) {
        requestProfile();
        return;
      }
      message("Up to date. This device and the cloud copy match.", "success");
    } catch (error) {
      if (signingOut) return;
      if (isDeviceError(error)) {
        resetAutoRetry();
        await revokeLocalSession();
        return;
      }
      if (isMissingCloudSetup(error)) {
        reportCloudSetupIssue(error);
        scheduleAutoRetry();
        return;
      }
      try { console.warn("DeeCadence sync failed:", error); } catch (_) {}
      scheduleAutoRetry();
      message("Sync is temporarily unavailable. Your local work is safe and will retry automatically.", "info");
    } finally {
      busy = false;
      render();
    }
  }

  async function keepDevice() {
    if (!conflict || busy || deviceLocked || signingOut || !user) return;
    var targetId = user.id;
    busy = true;
    render();
    try {
      var local = snapshot(readLocalState());
      var localHash = await hash(local);
      if (!syncStillCurrent(targetId)) return;
      if (!profileComplete(local)) {
        var copied = await copyProfileFromRow(conflict);
        if (!syncStillCurrent(targetId)) return;
        if (copied) {
          local = snapshot(readLocalState());
          localHash = await hash(local);
          if (!syncStillCurrent(targetId)) return;
        }
        if (!profileComplete(local)) {
          requestProfile();
          return;
        }
      }
      if (!syncStillCurrent(targetId)) return;
      var saved = await push(local, Number(conflict.revision));
      if (!syncStillCurrent(targetId)) return;
      if (!saved) {
        var latest = await readRemote();
        if (!syncStillCurrent(targetId)) return;
        if (latest) showConflict(latest);
        return;
      }
      clearConflictUI();
      saveSucceeded(saved, localHash);
    } catch (error) {
      if (signingOut) return;
      if (isDeviceError(error)) {
        resetAutoRetry();
        await revokeLocalSession();
        return;
      }
      if (isMissingCloudSetup(error)) {
        reportCloudSetupIssue(error);
        scheduleAutoRetry();
        return;
      }
      try { console.warn("DeeCadence device save failed:", error); } catch (_) {}
      scheduleAutoRetry();
      message("Could not save this device. Your local copy is safe.", "error");
    } finally {
      busy = false;
      render();
    }
  }

  async function useThisDevice() {
    if (!user || !client || busy || activating || signingOut) return;
    var targetId = user.id;
    activating = true;
    render();
    try {
      var claim = await claimDevice(true);
      if (!syncStillCurrent(targetId)) {
        if (signingOut) {
          try { await withTimeout(releaseDevice(), 2000); } catch (_) {}
        }
        return;
      }
      if (!claim || !claim.claimed) throw new Error("Could not move the account to this device.");
      deviceClaimed = true;
      deviceLocked = false;
      lastDeviceCheckAt = Date.now();
      syncProfileMetadata();
      message("This device is now active. Checking your cloud backup...", "info");
      render();
      await synchronize(true);
      if (!syncStillCurrent(targetId)) return;
      uploadLearningEvents(true);
    } catch (error) {
      if (signingOut) return;
      if (isDeviceError(error)) {
        resetAutoRetry();
        await revokeLocalSession();
        return;
      }
      if (isMissingCloudSetup(error)) {
        reportCloudSetupIssue(error);
        scheduleAutoRetry();
        return;
      }
      try { console.warn("DeeCadence device takeover failed:", error); } catch (_) {}
      scheduleAutoRetry();
      message("Could not move the account to this device. Try again in a moment.", "error");
    } finally {
      activating = false;
      render();
    }
  }

  async function verifyDeviceThenSync(force) {
    if (!user || !client || deviceLocked || busy || activating || signingOut) return;
    var targetId = user.id;
    if (!deviceClaimed) {
      await activateAccount();
      return;
    }
    try {
      var active = await verifyActiveDevice();
      if (!syncStillCurrent(targetId)) return;
      if (!active) return;
      await synchronize(force);
    } catch (error) {
      if (signingOut) return;
      if (isDeviceError(error)) {
        resetAutoRetry();
        await revokeLocalSession();
        return;
      }
      if (isMissingCloudSetup(error)) {
        reportCloudSetupIssue(error);
        scheduleAutoRetry();
        return;
      }
      try { console.warn("DeeCadence device check failed:", error); } catch (_) {}
      scheduleAutoRetry();
      if (force) message("Could not check the account device. Local work is safe.", "error");
    }
  }

  async function revokeLocalSession() {
    authNotice = "This account is now active on another device. Your work is still saved here. Sign in again here if you want to move the account back.";
    deviceLocked = false;
    deviceClaimed = false;
    awaitingProfile = false;
    clearConflictUI();
    closeSetupModal();
    clearSignInCooldown();
    lastHash = "";
    lastActivationUserId = "";
    lastMetadataSignature = "";
    resetAutoRetry();
    resetLearningUploadState();
    try {
      if (client) await client.auth.signOut({ scope: "local" });
    } catch (_) {}
    user = null;
    render();
    message(authNotice, "info");
    authNotice = "";
  }

  function clearLocalAuthSession() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i) || "";
        if (key === "supabase.auth.token" || (key.indexOf("sb-") === 0 && key.indexOf("auth-token") > -1)) {
          keys.push(key);
        }
      }
      keys.forEach(function (key) { localStorage.removeItem(key); });
    } catch (_) {}
  }

  function completeLocalSignOut() {
    user = null;
    resetAccountRuntime();
    closeSetupModal();
    clearSignInCooldown();
    clearPendingSignIn();
    authNotice = "";
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve({ timedOut: true });
      }, ms);
      promise.then(function (value) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      }, function (error) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function waitForIdle(maxMs) {
    var started = Date.now();
    return new Promise(function (resolve) {
      function check() {
        if (!busy && !activating) {
          resolve();
          return;
        }
        if (Date.now() - started >= maxMs) {
          resolve();
          return;
        }
        window.setTimeout(check, 100);
      }
      check();
    });
  }

  async function signOutCurrentDevice() {
    if (signingOut) return;
    if (!client && !user) {
      message("Cloud sign-in is not ready yet. Try again in a moment.", "info");
      return;
    }
    signingOut = true;
    message("Signing out...", "info");
    render();
    try {
      // Let an in-flight sync settle, but never let it block sign-out forever.
      await waitForIdle(1500);
      if (user) {
        try { await withTimeout(releaseDevice(), 2500); } catch (_) {}
      }
      if (client) {
        var result = await withTimeout(client.auth.signOut({ scope: "local" }), 4000);
        if (result && result.timedOut) throw new Error("Sign-out timed out");
        if (result && result.error) throw result.error;
      } else {
        clearLocalAuthSession();
      }
      completeLocalSignOut();
      message("Signed out. Your work is still saved on this device.", "success");
    } catch (error) {
      try { console.warn("DeeCadence sign-out failed:", error); } catch (_) {}
      // Local-only sign-out is the important part. If the SDK or network
      // stalls, remove the stored session so this device is actually signed out.
      try {
        if (client && client.auth && typeof client.auth.stopAutoRefresh === "function") {
          client.auth.stopAutoRefresh();
        }
      } catch (_) {}
      clearLocalAuthSession();
      completeLocalSignOut();
      message("Signed out on this device. Your local work is still saved.", "success");
    } finally {
      signingOut = false;
      render();
    }
  }

  async function signIn(event) {
    event.preventDefault();
    if (busy || activating || signingOut) return;
    if (location.protocol === "file:") {
      message("Cloud backup needs the website or localhost. Your progress remains saved on this device.", "info");
      return;
    }
    if (signInCooldownActive()) {
      syncCooldownUI();
      message("A sign-in link was already sent. Check your inbox.", "info");
      return;
    }
    var address = email ? String(email.value || "").trim() : "";
    if (!address) {
      if (email) email.focus();
      message("Enter the email address for your account.", "error");
      return;
    }
    busy = true;
    render();
    message("Preparing a secure sign-in link...", "info");
    try {
      await loadSdk();
      initClient();
      bindAuthListener();
      var redirectTo = redirectTarget || (location.origin + location.pathname);
      try { new URL(redirectTo); } catch (_) { redirectTo = location.origin + location.pathname; }
      var result = await client.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: redirectTo }
      });
      if (result.error) throw result.error;
      rememberPendingSignIn(address);
      beginSignInCooldown(60, address);
      message("Check your email. Open the link on this device to finish signing in.", "success");
    } catch (error) {
      try { console.warn("DeeCadence sign-in request failed:", error && (error.message || error)); } catch (_) {}
      var wait = signInRateLimitSeconds(error);
      if (wait) {
        beginSignInCooldown(wait, address);
        message("A sign-in link was already sent. Check your inbox.", "info");
      } else {
        message("Could not send a sign-in link. Try again in a moment.", "error");
      }
    } finally {
      busy = false;
      render();
    }
  }

  async function verifySignInCode(event) {
    if (event) event.preventDefault();
    if (busy || activating || signingOut) return;
    if (location.protocol === "file:") {
      message("Cloud backup needs the website or localhost. Your progress remains saved on this device.", "info");
      return;
    }
    var address = email ? String(email.value || "").trim() : "";
    var code = codeInput ? String(codeInput.value || "").replace(/\D/g, "").slice(0, 6) : "";
    if (!address) {
      if (email) email.focus();
      message("Enter the email address for your account.", "error");
      return;
    }
    if (code.length !== 6) {
      if (codeInput) codeInput.focus();
      message("Enter the 6-digit code from your email.", "error");
      return;
    }
    busy = true;
    render();
    message("Checking your code...", "info");
    try {
      await loadSdk();
      initClient();
      bindAuthListener();
      var result = await client.auth.verifyOtp({ email: address, token: code, type: "email" });
      if (result.error) throw result.error;
      var session = result.data && result.data.session;
      if (session && session.user) {
        adoptAuthUser(session.user, "SIGNED_IN");
        await activateAccount();
      } else {
        clearPendingSignIn();
        message("Signed in. Checking your cloud backup...", "success");
      }
      if (codeInput) codeInput.value = "";
    } catch (error) {
      try { console.warn("DeeCadence code verification failed:", error && (error.message || error)); } catch (_) {}
      message("That code is incorrect or expired. Request a new link and try again.", "error");
    } finally {
      busy = false;
      render();
    }
  }

  function start() {
    if (signingOut) return Promise.resolve();
    if (startPromise) return startPromise;
    startPromise = (async function () {
      if (!projectUrl || !publishableKey) {
        message("Sync is not set up in this build. Your work is saved on this device.", "info");
        return;
      }
      if (location.protocol === "file:" || !navigator.onLine) {
        message("Cloud backup needs the website or localhost and an internet connection. Your progress remains saved on this device.", "info");
        return;
      }
      if (!shouldResumeSync()) {
        message(hasPendingSignIn()
          ? pendingSignInMessage()
          : signedOutMessage(), "info");
        return;
      }
      try {
        await loadSdk();
        initClient();
        bindAuthListener();
        var result = await client.auth.getSession();
        if (result.error) throw result.error;
        var sessionUser = result.data.session ? result.data.session.user : null;
        if (sessionUser) {
          adoptAuthUser(sessionUser, "INITIAL_SESSION");
          await activateAccount();
        } else {
          adoptAuthUser(null, "INITIAL_SESSION");
          var callbackError = authCallbackError();
          if (callbackError) {
            message("That sign-in link could not be completed. Request a new link; your work is still saved on this device.", "error");
          } else if (hasPendingSignIn()) {
            message(pendingSignInMessage(), "info");
          } else {
            message(signedOutMessage(), "info");
          }
        }
      } catch (_) {
        scheduleAutoRetry();
        message("Sync is temporarily unavailable. Local work remains available and will retry.", "info");
      }
    }()).finally(function () { startPromise = null; });
    return startPromise;
  }

  if (form) form.addEventListener("submit", signIn);
  if (codeForm) codeForm.addEventListener("submit", verifySignInCode);
  if (codeInput) codeInput.addEventListener("input", function () {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
  });
  if (syncButton) syncButton.addEventListener("click", function () {
    if (deviceLocked) {
      message("This account is active on another device. Use this device instead to move it here.", "conflict");
      return;
    }
    resetAutoRetry();
    verifyDeviceThenSync(true);
  });
  if (profileButton) profileButton.addEventListener("click", function () {
    requestProfile(true);
  });
  if (outButton) outButton.addEventListener("click", signOutCurrentDevice);
  if (cloudButton) cloudButton.addEventListener("click", async function () {
    if (!conflict || busy || signingOut) return;
    busy = true;
    render();
    try {
      await applyCloud(conflict);
      if (!profileComplete(readLocalState())) requestProfile();
    } catch (error) {
      message(error.message || "Could not apply the cloud copy.", "error");
    } finally {
      busy = false;
      render();
    }
  });
  if (deviceButton) deviceButton.addEventListener("click", keepDevice);
  if (useDeviceButton) useDeviceButton.addEventListener("click", useThisDevice);
  if (reviewConflictButton) reviewConflictButton.addEventListener("click", openConflictReview);
  if (conflictFab) conflictFab.addEventListener("click", openConflictReview);
  if (conflictCloseButton) conflictCloseButton.addEventListener("click", closeConflictReview);

  document.addEventListener("keydown", function (event) {
    if (!conflictBox || conflictBox.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeConflictReview();
      return;
    }
    if (event.key !== "Tab") return;
    var focusable = conflictBox.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (!conflictBox.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("deecadence:local-save", function () {
    if (conflict) renderConflictComparison(conflict);
    if (!user || switchingUser || timer || deviceLocked || awaitingProfile || signingOut) return;
    timer = window.setTimeout(function () {
      timer = null;
      synchronize(false);
    }, SAVE_DEBOUNCE_MS);
  });

  window.addEventListener("deecadence:learning-event", scheduleLearningUpload);

  window.addEventListener("deecadence:account-profile-saved", function () {
    if (signingOut) return;
    awaitingProfile = false;
    resetAutoRetry();
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (!user || !client) return;
    syncProfileMetadata();
    if (!deviceLocked) synchronize(true);
  });

  window.addEventListener("deecadence:account-profile-signout", function () {
    signOutCurrentDevice();
  });

  window.addEventListener("online", function () {
    if (signingOut) return;
    resetAutoRetry();
    if (!client) {
      start();
      return;
    }
    if (user) {
      if (!deviceClaimed || deviceLocked || !lastDeviceCheckAt) {
        activateAccount();
      } else {
        verifyDeviceThenSync(true);
        uploadLearningEvents(true);
      }
    } else if (shouldResumeSync()) {
      start();
    }
  });

  window.addEventListener("focus", function () {
    var now = Date.now();
    var shouldRefresh = now - lastAuthRefreshAt >= 2000;
    if (shouldRefresh) lastAuthRefreshAt = now;
    var refresh = shouldRefresh ? refreshAuthFromSession() : Promise.resolve(false);
    refresh.then(function (changed) {
      if (changed || signingOut || !user || !client || deviceLocked) return;
      if (now - lastFocusSyncAt < FOCUS_SYNC_MS) return;
      lastFocusSyncAt = now;
      if (!deviceClaimed || !lastDeviceCheckAt) {
        activateAccount();
        return;
      }
      if (now - lastDeviceCheckAt >= REMOTE_REFRESH_MS) {
        verifyDeviceThenSync(true);
        return;
      }
      synchronize(now - lastRemoteCheckAt >= REMOTE_REFRESH_MS);
    });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || signingOut) return;
    lastAuthRefreshAt = Date.now();
    resetAutoRetry();
    refreshAuthFromSession().then(function (changed) {
      if (changed || signingOut || !user || !client || deviceLocked || awaitingProfile || !navigator.onLine) return;
      if (!deviceClaimed || !lastDeviceCheckAt) {
        activateAccount();
        return;
      }
      synchronize(true);
    });
  });

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted || signingOut) return;
    resetAutoRetry();
    refreshAuthFromSession().then(function (changed) {
      if (changed || signingOut || !user || !client || deviceLocked || awaitingProfile || !navigator.onLine) return;
      if (!deviceClaimed || !lastDeviceCheckAt) {
        activateAccount();
        return;
      }
      synchronize(true);
    });
  });

  window.addEventListener("storage", function (event) {
    var key = event.key || "";
    if (key === "supabase.auth.token" || (key.indexOf("sb-") === 0 && key.indexOf("auth-token") > -1)) {
      refreshAuthFromSession();
    }
  });

  window.setInterval(async function () {
    var changed = await refreshAuthFromSession();
    if (changed || signingOut || !user || !client || !navigator.onLine || deviceLocked || awaitingProfile) return;
    var now = Date.now();
    if (!deviceClaimed || !lastDeviceCheckAt) {
      if (!lastActivationAttemptAt || now - lastActivationAttemptAt >= REMOTE_REFRESH_MS) activateAccount();
      return;
    }
    if (now - lastDeviceCheckAt >= REMOTE_REFRESH_MS) {
      activateAccount();
      return;
    }
    if (now - lastRemoteCheckAt >= REMOTE_REFRESH_MS) synchronize(true);
    uploadLearningEvents(false);
  }, 60000);

  restoreSignInCooldown();
  render();
  start();
}());
