import { Router } from 'express';
import showController from '../controllers/show.controller.js';
import { validate } from '../validators/auth.validator.js';
import {
  createShowSchema,
  updateShowSchema,
  showStatusSchema,
} from '../validators/show.validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

// Public / customer discovery endpoints
router.get('/', optionalAuthenticate, (req, res, next) =>
  showController.getShows(req, res, next)
);

router.get('/:id', optionalAuthenticate, (req, res, next) =>
  showController.getShowById(req, res, next)
);

// Admin-only mutation endpoints
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createShowSchema),
  (req, res, next) => showController.createShow(req, res, next)
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateShowSchema),
  (req, res, next) => showController.updateShow(req, res, next)
);

router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  validate(showStatusSchema),
  (req, res, next) => showController.updateShowStatus(req, res, next)
);

export default router;
