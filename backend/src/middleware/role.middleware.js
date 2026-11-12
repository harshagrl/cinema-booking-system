import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Role-Based Access Control Middleware.
 * Enforces that req.user possesses at least one of the allowed roles.
 *
 * @param  {...string} allowedRoles - Allowed UserRole enums ('ADMIN', 'STAFF', 'CUSTOMER')
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new UnauthorizedError('Authentication required prior to role verification.')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}]. Your role is '${req.user.role}'.`,
          'INSUFFICIENT_ROLE'
        )
      );
    }

    next();
  };
};

/** Convenience alias for admin-only routes */
export const requireAdmin = requireRole('ADMIN');

/** Convenience alias for staff or admin routes */
export const requireStaffOrAdmin = requireRole('ADMIN', 'STAFF');

