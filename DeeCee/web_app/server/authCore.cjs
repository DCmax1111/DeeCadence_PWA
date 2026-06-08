function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isGmailEmail(email) {
  return /^[a-z0-9._%+-]+@gmail\.com$/i.test(normalizeEmail(email));
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,24}$/.test(normalizeUsername(username));
}

function normalizeDisplayName(name, fallback = "DC") {
  const cleaned = String(name || "").trim().replace(/\s+/g, " ").slice(0, 48);
  return cleaned || fallback;
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 128) return "Password is too long.";
  return "";
}

function sanitizeAuthPayload(body = {}) {
  const identifier = String(body.identifier || body.email || body.username || "").trim();
  const email = normalizeEmail(body.email || identifier);
  const username = normalizeUsername(body.username || "");
  const displayName = normalizeDisplayName(body.displayName || body.name || username || "DC");
  const password = String(body.password || "");
  return { identifier, email, username, displayName, password };
}

module.exports = {
  isGmailEmail,
  isValidUsername,
  normalizeDisplayName,
  normalizeEmail,
  normalizeUsername,
  sanitizeAuthPayload,
  validatePassword
};
