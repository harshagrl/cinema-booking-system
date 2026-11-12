import { Router } from 'express';
import theatreController from '../controllers/theatre.controller.js';
import screenController from '../controllers/screen.controller.js';
import { validate } from '../validators/auth.validator.js';
import {
  createTheatreSchema,
  updateTheatreSchema,
  theatreStatusSchema,
} from '../validators/theatre.validator.js';
import { createScreenSchema } from '../validators/screen.validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

// Public / discovery endpoints
router.get('/', optionalAuthenticate, (req, res, next) =>
  theatreController.getTheatres(req, res, next)
);

router.get('/:id', optionalAuthenticate, (req, res, next) =>
  theatreController.getTheatreById(req, res, next)
);

// Admin-only theatre operations
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createTheatreSchema),
  (req, res, next) => theatreController.createTheatre(req, res, next)
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateTheatreSchema),
  (req, res, next) => theatreController.updateTheatre(req, res, next)
);

router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  validate(theatreStatusSchema),
  (req, res, next) => theatreController.updateTheatreStatus(req, res, next)
);

// Nested screen routes under theatre
router.get('/:theatreId/screens', optionalAuthenticate, (req, res, next) =>
  screenController.getScreensByTheatre(req, res, next)
);

router.post(
  '/:theatreId/screens',
  authenticate,
  requireAdmin,
  validate(createScreenSchema),
  (req, res, next) => screenController.createScreen(req, res, next)
);

export default router;

