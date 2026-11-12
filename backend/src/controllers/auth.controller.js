import authService from '../services/auth.service.js';
import { getCookieOptions, getClearCookieOptions } from '../utils/token.js';

class AuthController {
  /**
   * POST /api/auth/register
   * Register a new customer account, set HTTP-only cookie, and return profile.
   */
  async register(req, res, next) {
    try {
      const { user, token } = await authService.register(req.body);

      // Set access token in HTTP-only cookie
      res.cookie('token', token, getCookieOptions());

      res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Authenticate user with credentials, set HTTP-only cookie, and return profile.
   */
  async login(req, res, next) {
    try {
      const { user, token } = await authService.login(req.body);

      // Set access token in HTTP-only cookie
      res.cookie('token', token, getCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Invalidate session by clearing the HTTP-only cookie.
   */
  async logout(req, res, next) {
    try {
      res.clearCookie('token', getClearCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Return authenticated user profile.
   */
  async getMe(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data: { user: req.user },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();

