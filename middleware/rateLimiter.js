/**
 * Simple in-memory sliding window rate limiter
 */
const requestLogs = new Map();

export function createRateLimiter({ windowMs = 60 * 1000, maxRequests = 10, message = "Too many requests. Please try again later." }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global";
    const key = `${req.baseUrl || ""}${req.path}:${ip}`;
    const now = Date.now();

    let logs = requestLogs.get(key) || [];
    // Filter timestamps within window
    logs = logs.filter((timestamp) => now - timestamp < windowMs);

    if (logs.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: message
      });
    }

    logs.push(now);
    requestLogs.set(key, logs);

    // Periodic cleanup of map
    if (requestLogs.size > 5000) {
      for (const [k, v] of requestLogs.entries()) {
        if (v.length === 0 || now - v[v.length - 1] > windowMs) {
          requestLogs.delete(k);
        }
      }
    }

    next();
  };
}
