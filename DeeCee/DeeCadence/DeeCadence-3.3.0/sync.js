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
  var learningMetaPrefix = "deecadence_learning_upload_v1_";
  var SAVE_DEBOUNCE_MS = 2500;
  var REMOTE_REFRESH_MS = 5 * 60 * 1000;
  var FOCUS_SYNC_MS = 60 * 1000;
  var LEARNING_UPLOAD_DEBOUNCE_MS = 15000;
  var LEARNING_BATCH_SIZE = 100;
  var client = null, user = null, busy = false, activating = false, timer = null, conflict = null, lastHash = "", sdkLoading = null;
  var authListenerBound = false, lastRemoteCheckAt = 0, lastFocusSyncAt = 0, lastDeviceCheckAt = 0;
  var deviceLocked = false, deviceClaimed = false, awaitingProfile = false, activationPromise = null, lastActivationUserId = "";
  var lastActivationAttemptAt = 0, lastMetadataSignature = "", startPromise = null, authNotice = "", memoryDeviceId = "";
  var learningUploadTimer = null, learningUploadPromise = null, lastLearningUploadAttemptAt = 0;
  var status = document.getElementById("syncStatus");
  var form = document.getElementById("syncSignInForm");
  var email = document.getElementById("syncEmail");
  var signInButton = document.getElementById("syncSignInBtn");
  var controls = document.getElementById("syncAccountControls");
  var accountEmail = document.getElementById("syncAccountEmail");
  var syncButton = document.getElementById("syncNowBtn");
  var outButton = document.getElementById("syncSignOutBtn");
  var conflictBox = document.getElementById("syncConflict");
  var cloudButton = document.getElementById("syncUseCloudBtn");
  var deviceButton = document.getElementById("syncKeepDeviceBtn");
  var deviceLock = document.getElementById("syncDeviceLock");
  var deviceLockLabel = document.getElementById("syncDeviceLockLabel");
  var useDeviceButton = document.getElementById("syncUseThisDeviceBtn");

  function message(text, kind) {
    if (!status) return;
    status.textContent = text;
    status.setAttribute("data-status", kind || "info");
  }

  function signedOutMessage() {
    return "Your progress is saved on this device. Sign in to back it up and sync across devices.";
  }

  function render() {
    var signed = Boolean(user);
    if (form) form.hidden = signed;
    if (controls) controls.hidden = !signed;
    if (accountEmail) accountEmail.textContent = signed ? user.email : "";
    if (deviceLock) deviceLock.hidden = !(signed && deviceLocked);
    var disabled = busy || activating;
    [signInButton, syncButton, outButton, cloudButton, deviceButton, useDeviceButton].forEach(function (button) {
      if (button) button.disabled = disabled;
    });
    if (syncButton) syncButton.disabled = disabled || deviceLocked;
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
    if (!user || !client || !deviceClaimed || deviceLocked || !navigator.onLine) {
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
          if (!user || user.id !== targetUserId || getDeviceId() !== targetDeviceId) return false;
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
    if (!user || !client || !deviceClaimed || deviceLocked || !navigator.onLine) return;
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

  function deviceName(claim) {
    var label = claim && claim.active_device_label ? String(claim.active_device_label).trim() : "";
    return label || "another device";
  }

  function profileName(state) {
    var profile = state && state.accountProfile;
    return profile && typeof profile === "object" ? String(profile.name || "").trim() : "";
  }

  function profileFromRow(row) {
    var profile = row && row.payload && row.payload.accountProfile;
    return profile && typeof profile === "object" && String(profile.name || "").trim() ? profile : null;
  }

  function copyProfileFromRow(row) {
    if (profileName(readLocalState())) return Promise.resolve(false);
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
    if (awaitingProfile && !force) return;
    awaitingProfile = true;
    message("Almost there. Add your name and a couple of account details to finish the first cloud save.", "info");
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
    if (!client || !user) return Promise.resolve(false);
    var local = readLocalState();
    var profile = local.accountProfile && typeof local.accountProfile === "object" ? local.accountProfile : {};
    var name = String(profile.name || "").trim().slice(0, 60);
    if (!name) return Promise.resolve(false);
    var signature = [name, profile.focus || "", Number(profile.dailyGoalMinutes) || 0].join("|");
    if (signature === lastMetadataSignature) return Promise.resolve(true);
    return client.auth.updateUser({
      data: {
        display_name: name,
        full_name: name,
        focus_area: profile.focus || "",
        daily_goal_minutes: Number(profile.dailyGoalMinutes) || 0
      }
    }).then(function (result) {
      if (result.error) throw result.error;
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
      var nextUser = session && session.user ? session.user : null;
      var nextId = nextUser ? nextUser.id : "";
      var previousId = user ? user.id : "";
      var changed = nextId !== previousId;
      user = nextUser;
      if (user) {
        clearPendingSignIn();
        if (changed) {
          conflict = null;
          if (conflictBox) conflictBox.hidden = true;
          deviceLocked = false;
          deviceClaimed = false;
          awaitingProfile = false;
          lastHash = "";
          lastRemoteCheckAt = 0;
          lastDeviceCheckAt = 0;
          lastActivationUserId = "";
          lastActivationAttemptAt = 0;
          lastMetadataSignature = "";
          resetLearningUploadState();
        }
        render();
        if (changed || lastActivationUserId !== user.id) {
          message("Signed in. Checking your cloud backup...", "info");
          queueActivation();
        }
      } else {
        conflict = null;
        if (conflictBox) conflictBox.hidden = true;
        deviceLocked = false;
        deviceClaimed = false;
        awaitingProfile = false;
        lastHash = "";
        lastRemoteCheckAt = 0;
        lastDeviceCheckAt = 0;
        lastActivationUserId = "";
        lastActivationAttemptAt = 0;
        lastMetadataSignature = "";
        resetLearningUploadState();
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
    });
  }

  function queueActivation() {
    if (!user || !client) return;
    window.setTimeout(function () { activateAccount(); }, 0);
  }

  function activateAccount() {
    if (!user || !client) return Promise.resolve();
    if (activationPromise) return activationPromise;
    var targetId = user.id;
    lastActivationUserId = targetId;
    lastActivationAttemptAt = Date.now();
    activationPromise = (async function () {
      activating = true;
      render();
      try {
        var claim = await claimDevice(false);
        if (!user || user.id !== targetId) return;
        lastDeviceCheckAt = Date.now();
        if (!claim || !claim.claimed) {
          deviceClaimed = false;
          deviceLocked = true;
          conflict = null;
          if (conflictBox) conflictBox.hidden = true;
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
        deviceClaimed = false;
        if (isDeviceError(error)) {
          await revokeLocalSession();
          return;
        }
        if (isMissingCloudSetup(error)) {
          message("Cloud sync needs the updated Supabase setup. Your work is saved on this device.", "error");
          return;
        }
        message("Signed in. Cloud sync is unavailable right now; your work stays saved here and will retry automatically.", "info");
      } finally {
        activating = false;
        activationPromise = null;
        render();
      }
    }());
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
    conflict = row;
    if (conflictBox) conflictBox.hidden = false;
    message("Cloud and this device both changed. Choose which copy to keep.", "conflict");
  }

  async function applyCloud(row) {
    var local = readLocalState();
    try {
      localStorage.setItem(storageKey + "_before_cloud", JSON.stringify({
        savedAt: new Date().toISOString(),
        reason: "Before applying the cloud copy",
        state: local
      }));
    } catch (_) {}
    var remoteHash = await hash(snapshot(row.payload || {}));
    var next = Object.assign({}, row.payload || {}, {
      session: local.session || null,
      feedbackOutbox: local.feedbackOutbox || []
    });
    // A completed local profile is newer than an older cloud snapshot that
    // predates the profile step. Keep it and let the next save upload it.
    if (!profileName(next) && profileName(local)) next.accountProfile = local.accountProfile;
    var debug = window.__DEECADENCE_DEBUG__;
    if (!debug || !debug.applySyncedState || !debug.applySyncedState(next)) {
      throw new Error("Could not apply the cloud copy.");
    }
    if (profileName(readLocalState())) syncProfileMetadata();
    saveMeta(row, remoteHash);
    lastHash = remoteHash;
    conflict = null;
    if (conflictBox) conflictBox.hidden = true;
    message("Cloud copy applied. Your active timer stays on this device.", "success");
  }

  function saveSucceeded(row, valueHash) {
    if (!row) return false;
    saveMeta(row, valueHash);
    lastHash = valueHash;
    message("Up to date. Last saved " + new Date(row.updated_at || Date.now()).toLocaleString() + ".", "success");
    return true;
  }

  async function synchronize(force) {
    if (!user || !client || busy) return;
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
      if (!force && localHash === lastHash) return;
      var meta = readMeta();
      var remote = await readRemote();
      lastRemoteCheckAt = Date.now();
      // Only record the local hash after the remote read succeeds. If the
      // request failed, the next local save or focus event can retry instead
      // of being skipped as "already handled".
      lastHash = localHash;

      if (!remote) {
        if (!profileName(local)) {
          requestProfile();
          return;
        }
        var firstSave = await push(local, 0);
        if (saveSucceeded(firstSave, localHash)) return;
        remote = await readRemote();
        if (!remote) throw new Error("The first cloud save did not complete. Try again.");
      }

      var remoteHash = await hash(snapshot(remote.payload || {}));
      if (remoteHash === localHash) {
        saveMeta(remote, localHash);
        if (!profileName(local)) {
          requestProfile();
          return;
        }
        message("Up to date. This device and the cloud copy match.", "success");
        return;
      }

      if (!meta) {
        if (!hasData(local)) {
          await applyCloud(remote);
          if (!profileName(readLocalState())) requestProfile();
          return;
        }
        if (hasData(remote.payload)) {
          if (!profileName(local) && !profileFromRow(remote)) {
            requestProfile();
            return;
          }
          showConflict(remote);
          return;
        }
        if (!profileName(local)) {
          if (await copyProfileFromRow(remote)) {
            local = snapshot(readLocalState());
            localHash = await hash(local);
          }
          if (!profileName(local)) {
            requestProfile();
            return;
          }
        }
        var firstMerge = await push(local, Number(remote.revision));
        if (saveSucceeded(firstMerge, localHash)) return;
        remote = await readRemote();
        if (remote) showConflict(remote);
        return;
      }

      var localChanged = localHash !== meta.hash;
      var remoteChanged = Number(remote.revision) !== Number(meta.revision) || remoteHash !== meta.hash;
      if (localChanged && remoteChanged) {
        if (!profileName(local) && !profileFromRow(remote)) {
          requestProfile();
          return;
        }
        showConflict(remote);
        return;
      }
      if (remoteChanged && !localChanged) {
        await applyCloud(remote);
        if (!profileName(readLocalState())) requestProfile();
        return;
      }
      if (localChanged) {
        if (!profileName(local)) {
          if (await copyProfileFromRow(remote)) {
            local = snapshot(readLocalState());
            localHash = await hash(local);
          }
          if (!profileName(local)) {
            requestProfile();
            return;
          }
        }
        var saved = await push(local, Number(remote.revision));
        if (saveSucceeded(saved, localHash)) return;
        remote = await readRemote();
        if (remote) showConflict(remote);
        return;
      }
      saveMeta(remote, localHash);
      if (!profileName(local)) {
        requestProfile();
        return;
      }
      message("Up to date. This device and the cloud copy match.", "success");
    } catch (error) {
      if (isDeviceError(error)) {
        await revokeLocalSession();
        return;
      }
      if (isMissingCloudSetup(error)) {
        message("Cloud sync needs the updated Supabase setup. Your work is saved on this device.", "error");
        return;
      }
      message(error && error.message ? error.message : "Sync failed. Your local copy is still available.", "error");
    } finally {
      busy = false;
      render();
    }
  }

  async function keepDevice() {
    if (!conflict || busy || deviceLocked) return;
    busy = true;
    render();
    try {
      var local = snapshot(readLocalState());
      var localHash = await hash(local);
      if (!profileName(local)) {
        if (await copyProfileFromRow(conflict)) {
          local = snapshot(readLocalState());
          localHash = await hash(local);
        }
        if (!profileName(local)) {
          requestProfile();
          return;
        }
      }
      var saved = await push(local, Number(conflict.revision));
      if (!saved) {
        var latest = await readRemote();
        if (latest) showConflict(latest);
        return;
      }
      conflict = null;
      if (conflictBox) conflictBox.hidden = true;
      saveSucceeded(saved, localHash);
    } catch (error) {
      if (isDeviceError(error)) {
        await revokeLocalSession();
        return;
      }
      if (isMissingCloudSetup(error)) {
        message("Cloud sync needs the updated Supabase setup. Your work is saved on this device.", "error");
        return;
      }
      message(error.message || "Could not save this device.", "error");
    } finally {
      busy = false;
      render();
    }
  }

  async function useThisDevice() {
    if (!user || !client || busy || activating) return;
    activating = true;
    render();
    try {
      var claim = await claimDevice(true);
      if (!claim || !claim.claimed) throw new Error("Could not move the account to this device.");
      deviceClaimed = true;
      deviceLocked = false;
      lastDeviceCheckAt = Date.now();
      syncProfileMetadata();
      message("This device is now active. Checking your cloud backup...", "info");
      render();
      await synchronize(true);
      uploadLearningEvents(true);
    } catch (error) {
      if (isDeviceError(error)) {
        await revokeLocalSession();
        return;
      }
      if (isMissingCloudSetup(error)) {
        message("Cloud sync needs the updated Supabase setup. Your work is saved on this device.", "error");
        return;
      }
      message(error.message || "Could not use this device.", "error");
    } finally {
      activating = false;
      render();
    }
  }

  async function verifyDeviceThenSync(force) {
    if (!user || !client || deviceLocked || busy || activating) return;
    if (!deviceClaimed) {
      await activateAccount();
      return;
    }
    try {
      var active = await verifyActiveDevice();
      if (!active) return;
      await synchronize(force);
    } catch (error) {
      if (isDeviceError(error)) {
        await revokeLocalSession();
        return;
      }
      if (isMissingCloudSetup(error)) {
        message("Cloud sync needs the updated Supabase setup. Your work is saved on this device.", "error");
        return;
      }
      if (force) message(error.message || "Could not check the account device. Local work is safe.", "error");
    }
  }

  async function revokeLocalSession() {
    authNotice = "This account is now active on another device. Your work is still saved here. Sign in again here if you want to move the account back.";
    deviceLocked = false;
    deviceClaimed = false;
    awaitingProfile = false;
    conflict = null;
    if (conflictBox) conflictBox.hidden = true;
    closeSetupModal();
    lastHash = "";
    lastActivationUserId = "";
    lastMetadataSignature = "";
    resetLearningUploadState();
    try {
      if (client) await client.auth.signOut({ scope: "local" });
    } catch (_) {}
    user = null;
    render();
    message(authNotice, "info");
    authNotice = "";
  }

  async function signOutCurrentDevice() {
    if (!client) {
      message("Cloud sign-in is not ready yet. Try again in a moment.", "info");
      return;
    }
    if (busy || activating) {
      message("Finishing the current account check. Try again in a moment.", "info");
      return;
    }
    busy = true;
    render();
    try {
      if (user) {
        try { await releaseDevice(); } catch (_) {}
      }
      var result = await client.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      user = null;
      deviceLocked = false;
      deviceClaimed = false;
      awaitingProfile = false;
      conflict = null;
      if (conflictBox) conflictBox.hidden = true;
      closeSetupModal();
      lastHash = "";
      lastActivationUserId = "";
      lastMetadataSignature = "";
      resetLearningUploadState();
      authNotice = "";
      message("Signed out. Your work is still saved on this device.", "success");
    } catch (error) {
      message(error.message || "Could not sign out.", "error");
    } finally {
      busy = false;
      render();
    }
  }

  async function signIn(event) {
    event.preventDefault();
    if (busy || activating) return;
    if (location.protocol === "file:") {
      message("Cloud backup needs the website or localhost. Your progress remains saved on this device.", "info");
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
      message("Check your email for a sign-in link. Open it on the device where you want to use DeeCadence; your saved work remains safe.", "success");
    } catch (error) {
      message(error.message || "Could not send a sign-in link.", "error");
    } finally {
      busy = false;
      render();
    }
  }

  function start() {
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
          ? "Your last sign-in was not completed. Local work is safe. Send a new link to finish connecting."
          : signedOutMessage(), "info");
        return;
      }
      try {
        await loadSdk();
        initClient();
        bindAuthListener();
        var result = await client.auth.getSession();
        if (result.error) throw result.error;
        user = result.data.session ? result.data.session.user : null;
        render();
        if (user) {
          clearPendingSignIn();
          await activateAccount();
        } else {
          var callbackError = authCallbackError();
          if (callbackError) {
            message("That sign-in link could not be completed. Request a new link; your work is still saved on this device.", "error");
          } else if (hasPendingSignIn()) {
            message("Your last sign-in was not completed. Local work is safe. Send a new link to finish connecting.", "info");
          } else {
            message(signedOutMessage(), "info");
          }
        }
      } catch (_) {
        message("Sync is temporarily unavailable. Local work remains available and will retry.", "info");
      }
    }()).finally(function () { startPromise = null; });
    return startPromise;
  }

  if (form) form.addEventListener("submit", signIn);
  if (syncButton) syncButton.addEventListener("click", function () {
    if (deviceLocked) {
      message("This account is active on another device. Use this device instead to move it here.", "conflict");
      return;
    }
    verifyDeviceThenSync(true);
  });
  if (outButton) outButton.addEventListener("click", signOutCurrentDevice);
  if (cloudButton) cloudButton.addEventListener("click", async function () {
    if (!conflict || busy) return;
    busy = true;
    render();
    try {
      await applyCloud(conflict);
      if (!profileName(readLocalState())) requestProfile();
    } catch (error) {
      message(error.message || "Could not apply the cloud copy.", "error");
    } finally {
      busy = false;
      render();
    }
  });
  if (deviceButton) deviceButton.addEventListener("click", keepDevice);
  if (useDeviceButton) useDeviceButton.addEventListener("click", useThisDevice);

  window.addEventListener("deecadence:local-save", function () {
    if (!user || timer || deviceLocked || awaitingProfile) return;
    timer = window.setTimeout(function () {
      timer = null;
      synchronize(false);
    }, SAVE_DEBOUNCE_MS);
  });

  window.addEventListener("deecadence:learning-event", scheduleLearningUpload);

  window.addEventListener("deecadence:account-profile-saved", function () {
    awaitingProfile = false;
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
    if (!user || !client || deviceLocked) return;
    var now = Date.now();
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

  window.setInterval(function () {
    if (!user || !client || !navigator.onLine || deviceLocked || awaitingProfile) return;
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

  render();
  start();
}());
