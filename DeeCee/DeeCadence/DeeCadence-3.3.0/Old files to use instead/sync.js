(function () {
  "use strict";
  var projectUrl = (document.querySelector('meta[name="deecadence-sync-url"]') || {}).content || "";
  var publishableKey = (document.querySelector('meta[name="deecadence-sync-publishable-key"]') || {}).content || "";
  var sdkUrl = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8/dist/umd/supabase.js";
  var storageKey = "deecadence_state_v2";
  var metaPrefix = "deecadence_sync_meta_v1_";
  var client = null, user = null, busy = false, timer = null, conflict = null, lastHash = "", sdkLoading = null;
  var status = document.getElementById("syncStatus");
  var form = document.getElementById("syncSignInForm");
  var email = document.getElementById("syncEmail");
  var controls = document.getElementById("syncAccountControls");
  var accountEmail = document.getElementById("syncAccountEmail");
  var syncButton = document.getElementById("syncNowBtn");
  var outButton = document.getElementById("syncSignOutBtn");
  var conflictBox = document.getElementById("syncConflict");
  var cloudButton = document.getElementById("syncUseCloudBtn");
  var deviceButton = document.getElementById("syncKeepDeviceBtn");

  function message(text, kind) {
    if (!status) return;
    status.textContent = text;
    status.setAttribute("data-status", kind || "info");
  }
  function render() {
    var signed = Boolean(user);
    if (form) form.hidden = signed;
    if (controls) controls.hidden = !signed;
    if (accountEmail) accountEmail.textContent = signed ? user.email : "";
    [syncButton, outButton, cloudButton, deviceButton].forEach(function (button) {
      if (button) button.disabled = busy;
    });
  }
  function readLocalState() {
    try {
      var stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    var debug = window.__DEECADENCE_DEBUG__;
    return debug && debug.getState ? debug.getState() : {};
  }
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
    var changedSettings = settings.theme && settings.theme !== "dark" ||
      settings.sound === false || settings.soundPreferenceTouched ||
      settings.welcomeComplete || settings.tutorialComplete || settings.reducedMotion;
    var changedGoals = (Number(profile.dailyGoalMinutes) && Number(profile.dailyGoalMinutes) !== 60) ||
      (Number(profile.dailyGoalBlocks) && Number(profile.dailyGoalBlocks) !== 4);
    return Boolean(Number(profile.totalXp) || changedGoals || changedSettings ||
      (state.tasks || []).length || (state.savedSessions || []).length ||
      (state.history || []).length || (state.attentionTests || []).length ||
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
    localStorage.setItem(metaKey(), JSON.stringify({ revision: Number(row.revision), hash: valueHash }));
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
  function readRemote() {
    return client.from("deecadence_sync_state").select("revision,payload,updated_at")
      .eq("user_id", user.id).maybeSingle().then(function (result) {
        if (result.error) throw result.error;
        return result.data || null;
      });
  }
  function push(value, revision) {
    return client.rpc("deecadence_save_sync_snapshot", {
      p_expected_revision: revision, p_payload: value
    }).then(function (result) {
      if (result.error) throw result.error;
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
    localStorage.setItem(storageKey + "_before_cloud", JSON.stringify({
      savedAt: new Date().toISOString(), reason: "Before cloud sync", state: local
    }));
    var remoteHash = await hash(snapshot(row.payload || {}));

    var next = Object.assign({}, row.payload || {}, {
      session: local.session || null,
      feedbackOutbox: local.feedbackOutbox || []
    });
    var debug = window.__DEECADENCE_DEBUG__;
    if (!debug || !debug.applySyncedState || !debug.applySyncedState(next)) {
      throw new Error("Could not apply the cloud copy.");
    }
    saveMeta(row, remoteHash);
    lastHash = remoteHash;
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
    if (!user || !client || busy || !navigator.onLine) return;
    busy = true;
    render();
    try {
      var local = snapshot(readLocalState());
      var localHash = await hash(local);
      if (!force && localHash === lastHash) return;
      lastHash = localHash;
      var meta = readMeta();
      var remote = await readRemote();
      if (!remote) {
        var firstSave = await push(local, 0);
        if (saveSucceeded(firstSave, localHash)) return;
        remote = await readRemote();
        if (!remote) throw new Error("The first cloud save did not complete. Try again.");
      }
      var remoteHash = await hash(snapshot(remote.payload || {}));
      if (remoteHash === localHash) {
        saveMeta(remote, localHash);
        message("Up to date. This device and the cloud copy match.", "success");
        return;
      }
      if (!meta) {
        if (!hasData(local)) { await applyCloud(remote); return; }
        if (hasData(remote.payload)) { showConflict(remote); return; }
        var firstMerge = await push(local, Number(remote.revision));
        if (saveSucceeded(firstMerge, localHash)) return;
        remote = await readRemote();
        if (remote) showConflict(remote);
        return;
      }
      var localChanged = localHash !== meta.hash;
      var remoteChanged = Number(remote.revision) !== Number(meta.revision) || remoteHash !== meta.hash;
      if (localChanged && remoteChanged) { showConflict(remote); return; }
      if (remoteChanged && !localChanged) { await applyCloud(remote); return; }
      if (localChanged) {
        var saved = await push(local, Number(remote.revision));
        if (saveSucceeded(saved, localHash)) return;
        remote = await readRemote();
        if (remote) showConflict(remote);
        return;
      }
      saveMeta(remote, localHash);
      message("Up to date. This device and the cloud copy match.", "success");
    } catch (error) {
      message(error && error.message ? error.message : "Sync failed. Your local copy is still available.", "error");
    } finally {
      busy = false;
      render();
    }
  }
  async function keepDevice() {
    if (!conflict || busy) return;
    busy = true;
    render();
    try {
      var local = snapshot(readLocalState());
      var localHash = await hash(local);
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
      message(error.message || "Could not save this device.", "error");
    } finally {
      busy = false;
      render();
    }
  }
  async function signIn(event) {
    event.preventDefault();
    if (location.protocol === "file:") {
      message("Cloud backup needs the website or localhost. Your progress remains saved on this device.", "info");
      return;
    }
    busy = true;
    render();
    message("Preparing a secure sign-in link...", "info");
    try {
      await loadSdk();
      initClient();
      var result = await client.auth.signInWithOtp({
        email: String(email.value || "").trim(),
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (result.error) throw result.error;
      message("Check your email for a sign-in link. Open it on this device to finish connecting; your saved work remains safe.", "success");
    } catch (error) {
      message(error.message || "Could not send a sign-in link.", "error");
    } finally {
      busy = false;
      render();
    }
  }
  async function start() {
    if (!projectUrl || !publishableKey) {
      message("Sync is not set up yet. Your work is saved on this device.", "info");
      return;
    }
    if (location.protocol === "file:" || !navigator.onLine) {
      message("Cloud backup needs the website or localhost and an internet connection. Your progress remains saved on this device.", "info");
      return;
    }
    try {
      await loadSdk();
      initClient();
      client.auth.onAuthStateChange(function (_event, session) {
        user = session && session.user ? session.user : null;
        conflict = null;
        if (conflictBox) conflictBox.hidden = true;
        render();
        if (user) {
          message("Signed in. Checking your cloud backup...", "info");
          window.setTimeout(function () { synchronize(true); }, 0);
        } else {
          message("Your progress is saved on this device. Sign in to back it up and sync across devices.", "info");
        }
      });
      var result = await client.auth.getSession();
      if (result.error) throw result.error;
      user = result.data.session ? result.data.session.user : null;
      render();
      if (user) synchronize(true);
    } catch (_) {
      message("Sync is temporarily unavailable. Local work remains available.", "info");
    }
  }

  if (form) form.addEventListener("submit", signIn);
  if (syncButton) syncButton.addEventListener("click", function () { synchronize(true); });
  if (outButton) outButton.addEventListener("click", async function () {
    if (!client || busy) return;
    busy = true;
    render();
    try {
      var result = await client.auth.signOut();
      if (result.error) throw result.error;
      user = null;
      message("Signed out. Your work is still saved on this device.", "success");
    } catch (error) {
      message(error.message || "Could not sign out.", "error");
    } finally {
      busy = false;
      render();
    }
  });
  if (cloudButton) cloudButton.addEventListener("click", async function () {
    if (!conflict || busy) return;
    busy = true;
    render();
    try {
      await applyCloud(conflict);
      conflict = null;
      if (conflictBox) conflictBox.hidden = true;
    } catch (error) {
      message(error.message || "Could not apply the cloud copy.", "error");
    } finally {
      busy = false;
      render();
    }
  });
  if (deviceButton) deviceButton.addEventListener("click", keepDevice);
  window.addEventListener("deecadence:local-save", function () {
    if (timer) return;
    timer = window.setTimeout(function () { timer = null; synchronize(false); }, 1200);
  });
  window.addEventListener("online", function () {
    if (client) { if (user) synchronize(true); }
    else start();
  });
  window.addEventListener("focus", function () { if (user) synchronize(true); });
  window.setInterval(function () { if (user && navigator.onLine) synchronize(true); }, 60000);
  render();
  start();
}());