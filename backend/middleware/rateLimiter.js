const { sendError } = require('../utils/response');

const createRateLimiter = ({ windowMs, max, message }) => {
  const store = new Map();
  let lastSweepAt = 0;

  const sweepExpiredEntries = (now) => {
    if (now - lastSweepAt < windowMs) {
      return;
    }

    lastSweepAt = now;

    for (const [key, value] of store.entries()) {
      if (value.resetAt <= now) {
        store.delete(key);
      }
    }
  };

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    sweepExpiredEntries(now);

    const entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return sendError(res, {
        status: 429,
        message,
      });
    }

    return next();
  };
};

module.exports = createRateLimiter;
