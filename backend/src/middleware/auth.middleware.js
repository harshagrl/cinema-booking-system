import { verifyToken } from '../utils/token.js';
import prisma from '../config/database.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Authentication Middleware.
 * Verifies JWT from HTTP-only cookie or Authorization header.
 * Attaches authenticated user object to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    // Fallback: Check Authorization: Bearer <token>
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError(
        'Authentication required. Please log in to proceed.',
        'AUTH_TOKEN_MISSING'
      );
    }

    // Verify token signature and expiration
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError(
          'Your session has expired. Please log in again.',
          'TOKEN_EXPIRED'
        );
      }
      throw new UnauthorizedError('Invalid authentication token.', 'TOKEN_INVALID');
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError(
        'User associated with this token no longer exists.',
        'USER_NOT_FOUND'
      );
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional Authentication Middleware.
 * If token is provided and valid, populates req.user.
 * If token is absent or invalid, simply sets req.user = null without throwing.
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      req.user = user || null;
    } catch {
      req.user = null;
    }

    next();
  } catch (error) {
    next(error);
  }
};
