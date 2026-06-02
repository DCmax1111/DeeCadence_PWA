const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function publicFiles() {
  const files = [path.join(root, "index.html")];
  const stack = [path.join(root, "src"), path.join(root, "public")];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile()) files.push(fullPath);
    }
  }
  return files;
}

const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_ADMIN_TOKEN",
  "PAYMENT_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "101019644",
  "8085318908",
  "1948013882"
];

for (const file of publicFiles()) {
  const text = fs.readFileSync(file, "utf8");
  for (const value of forbidden) {
    assert.equal(
      text.includes(value),
      false,
      `${path.relative(root, file)} leaked forbidden server/payment material: ${value}`
    );
  }
}

console.log("ok - browser bundle does not expose server secrets or payment accounts");
