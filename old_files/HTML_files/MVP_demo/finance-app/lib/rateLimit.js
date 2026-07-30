const requestCounters = new Map();
const WINDOW_SIZE_MS = 60 * 1000;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function withRateLimit(handler, options = {}) {
  const maxRequests = Number(options.max || 40);
  const windowMs = Number(options.windowMs || WINDOW_SIZE_MS);

  return async function rateLimitedHandler(req, res) {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = requestCounters.get(ip) || { count: 0, windowStart: now };

    if (now - entry.windowStart > windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count += 1;
    requestCounters.set(ip, entry);

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - entry.windowStart)) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }

    return handler(req, res);
  };
}

export function withStrictRateLimit(handler) {
  return withRateLimit(handler, { max: 20, windowMs: 60 * 1000 });
}
