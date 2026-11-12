/**
 * Lightweight, zero-dependency cookie parser middleware.
 * Populates req.cookies from req.headers.cookie.
 */
export const cookieParser = (req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx !== -1) {
        const key = pair.substring(0, idx).trim();
        const rawVal = pair.substring(idx + 1).trim();
        try {
          req.cookies[key] = decodeURIComponent(rawVal);
        } catch {
          req.cookies[key] = rawVal;
        }
      }
    }
  }

  next();
};

/**
 * CSRF defense-in-depth middleware for state-changing requests.
 * Modern browsers use SameSite=Lax for cookies by default.
 * For extra protection, mutating requests (POST, PUT, DELETE, PATCH)
 * verify that Origin / Referer matches the application's trusted origin.
 */
export const csrfProtection = (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const trustedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  // If origin is provided, verify it matches the trusted origin or local development host
  if (origin) {
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isTrusted = origin === trustedOrigin || (process.env.NODE_ENV !== 'production' && isLocalhost);

    if (!isTrusted) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Untrusted request origin',
        code: 'CSRF_ORIGIN_MISMATCH',
      });
    }
  }

  next();
};

