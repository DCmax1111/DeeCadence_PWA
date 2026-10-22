(function () {
  "use strict";
  // Cloud sync is coming soon in a future release.
  // This stub keeps the settings card non-functional and avoids
  // any silent Supabase connection attempts.
  var status = document.getElementById("syncStatus");
  if (status) {
    status.textContent = "Local-only. Cloud sync coming soon.";
    status.setAttribute("data-status", "info");
  }
}());
