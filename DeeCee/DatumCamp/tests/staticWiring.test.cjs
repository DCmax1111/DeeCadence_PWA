const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appPath = path.resolve(__dirname, "..", "src", "app.js");
const indexPath = path.resolve(__dirname, "..", "index.html");
const source = fs.readFileSync(appPath, "utf8");
const shellSource = fs.readFileSync(indexPath, "utf8");

function unique(matches) {
  return Array.from(new Set(matches));
}

const renderedForms = unique(
  Array.from(source.matchAll(/data-form=["']([^"']+)["']/g), (match) => match[1])
);
const handledForms = unique(
  Array.from(source.matchAll(/type === ["']([^"']+)["']/g), (match) => match[1])
);

const intentionallyExternal = new Set([]);
const missingHandlers = renderedForms.filter((form) => !handledForms.includes(form) && !intentionallyExternal.has(form));

assert.deepEqual(
  missingHandlers,
  [],
  `Rendered forms without handleForm branches: ${missingHandlers.join(", ")}`
);

const requiredFocusActions = [
  "data-start-focus",
  "data-pause-focus",
  "data-abandon-focus",
  "data-complete-focus",
  "Block ${segment.current}/4",
  "blockLabel",
  "endedOnBlock"
];

for (const token of requiredFocusActions) {
  assert.equal(source.includes(token), true, `Focus wiring is missing ${token}`);
}

const requiredAuthTokens = [
  "data-form=\"auth-register\"",
  "data-form=\"auth-login\"",
  "data-auth-confirm-password",
  "passwordChecklist",
  "syncPasswordFields",
  "loadOwnerAccess",
  "data-route=\"account\""
];

for (const token of requiredAuthTokens) {
  assert.equal((source + shellSource).includes(token), true, `Account/security wiring is missing ${token}`);
}

const requiredDatumCampTokens = [
  "DATUMCAMP_PATHS",
  "DATUMCAMP_RESOURCES",
  "datumcamp: () => renderDatumCamp()",
  "data-route=\"datumcamp\"",
  "data-datum-path",
  "data-datum-child-mode",
  "data-datum-start",
  "data-datum-complete",
  "startDatumCampPath",
  "completeDatumCampItem",
  "datumcamp-${kind}",
  "kind === \"mission\""
];

for (const token of requiredDatumCampTokens) {
  assert.equal(source.includes(token), true, `DatumCamp wiring is missing ${token}`);
}

console.log("ok - rendered forms and focus actions are wired");
