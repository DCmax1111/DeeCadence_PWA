const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
loadEnv(path.join(root, ".env"));
loadEnv(path.join(root, ".env.local"));

const routes = {
  "/api/auth/password": require(path.join(root, "api", "auth", "password.js")),
  "/api/profile": require(path.join(root, "api", "profile.js")),
  "/api/checkout": require(path.join(root, "api", "checkout.js")),
  "/api/subscription": require(path.join(root, "api", "subscription.js")),
  "/api/app-config": require(path.join(root, "api", "app-config.js")),
  "/api/focus-strength": require(path.join(root, "api", "focus-strength.js")),
  "/api/admin/me": require(path.join(root, "api", "admin", "me.js")),
  "/api/admin/payments": require(path.join(root, "api", "admin", "payments.js")),
  "/api/sandbox/complete": require(path.join(root, "api", "sandbox", "complete.js")),
  "/api/webhooks/sandbox-payment": require(path.join(root, "api", "webhooks", "sandbox-payment.js"))
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function makeApiResponse(res) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      send(res, this.statusCode, JSON.stringify(payload), {
        "Content-Type": "application/json; charset=utf-8",
        ...this.headers
      });
    },
    end(payload = "") {
      send(res, this.statusCode, payload, this.headers);
    }
  };
}

async function parseBody(req) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  req.rawBody = raw;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function handleApi(req, res, url) {
  const handler = routes[url.pathname];
  if (!handler) {
    send(res, 404, JSON.stringify({ error: "API route not found" }), { "Content-Type": "application/json" });
    return;
  }
  req.query = Object.fromEntries(url.searchParams.entries());
  req.body = await parseBody(req);
  await handler(req, makeApiResponse(res));
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const decoded = decodeURIComponent(requested);
  const filePath = path.normalize(path.join(root, decoded));
  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }
  const target = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(root, "index.html");
  const ext = path.extname(target).toLowerCase();
  send(res, 200, fs.readFileSync(target), { "Content-Type": contentTypes[ext] || "application/octet-stream" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    send(res, 500, JSON.stringify({ error: "Local dev server failed" }), { "Content-Type": "application/json" });
  }
});

const port = Number(process.env.PORT || 3002);
server.listen(port, () => {
  console.log(`DeeCee local fallback server running at http://localhost:${port}`);
});
