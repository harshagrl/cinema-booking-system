import { Router } from 'express';
import screenController from '../controllers/screen.controller.js';
import seatController from '../controllers/seat.controller.js';
import { validate } from '../validators/auth.validator.js';
import {
  updateScreenSchema,
  screenStatusSchema,
} from '../validators/screen.validator.js';
import {
  bulkConfigureSeatsSchema,
  bulkUpdateSeatsSchema,
} from '../validators/seat.validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

// Screen details
router.get('/:id', optionalAuthenticate, (req, res, next) =>
  screenController.getScreenById(req, res, next)
);

// Admin-only screen mutations
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateScreenSchema),
  (req, res, next) => screenController.updateScreen(req, res, next)
);

router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  validate(screenStatusSchema),
  (req, res, next) => screenController.updateScreenStatus(req, res, next)
);

// Physical seat layout endpoints under screen
router.get('/:screenId/seats', optionalAuthenticate, (req, res, next) =>
  seatController.getSeatsByScreen(req, res, next)
);

router.post(
  '/:screenId/seats',
  authenticate,
  requireAdmin,
  validate(bulkConfigureSeatsSchema),
  (req, res, next) => seatController.bulkConfigureSeats(req, res, next)
);

router.put(
  '/:screenId/seats',
  authenticate,
  requireAdmin,
  validate(bulkUpdateSeatsSchema),
  (req, res, next) => seatController.bulkUpdateSeats(req, res, next)
);

export default router;

