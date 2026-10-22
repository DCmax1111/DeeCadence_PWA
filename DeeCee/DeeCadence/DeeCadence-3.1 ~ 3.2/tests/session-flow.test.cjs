const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appScript = indexSource.match(/<script\s+src="([^"]+)"\s+defer><\/script>/i);

assert.ok(appScript, "index.html should declare its deferred app script");
assert.equal(appScript[1], "app.js", "session flows must be checked against the shipped app.js");
assert.ok(fs.existsSync(path.join(root, appScript[1])), "the shipped app script should exist");

console.log("Session flow app wiring check passed");
