const rateLimitStore = new Map();

/**
 * Creates an in-memory IP-based rate limiter middleware.
 * Zero external dependencies, transparent, and interview-explainable.
 *
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 mins)
 * @param {number} options.max - Max attempts permitted within the window
 * @param {string} options.message - Error response message
 */
export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 5,
  message = 'Too many attempts from this IP address. Please try again later.',
} = {}) => {
  return (req, res, next) => {
    // Disable rate limiting if running tests
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-client';

    const now = Date.now();
    const clientRecord = rateLimitStore.get(ip);

    if (!clientRecord || now > clientRecord.resetTime) {
      rateLimitStore.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (clientRecord.count >= max) {
      const retryAfterSeconds = Math.ceil((clientRecord.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfterSeconds,
      });
    }

    clientRecord.count += 1;
    next();
  };
};

/**
 * Pre-configured rate limiter for login attempts (5 attempts per 15 minutes).
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many failed login attempts. Please try again after 15 minutes.',
});

/**
 * Utility to clear the rate limit store (useful during automated tests).
 */
export const clearRateLimitStore = () => {
  rateLimitStore.clear();
};

