import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { validate, registerSchema, loginSchema } from '../validators/auth.validator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin, requireStaffOrAdmin } from '../middleware/role.middleware.js';
import { loginRateLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), (req, res, next) =>
  authController.register(req, res, next)
);

router.post('/login', loginRateLimiter, validate(loginSchema), (req, res, next) =>
  authController.login(req, res, next)
);

router.post('/logout', (req, res, next) =>
  authController.logout(req, res, next)
);

// Protected routes (Requires valid session)
router.get('/me', authenticate, (req, res, next) =>
  authController.getMe(req, res, next)
);

// Role-protected verification routes (Used for security testing & route guards)
router.get('/admin-check', authenticate, requireAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin authorization verified successfully.',
    data: { user: req.user },
  });
});

router.get('/staff-check', authenticate, requireStaffOrAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Staff/Admin authorization verified successfully.',
    data: { user: req.user },
  });
});

export default router;

