import { Router } from 'express';
import movieController from '../controllers/movie.controller.js';
import { validate } from '../validators/auth.validator.js';
import {
  createMovieSchema,
  updateMovieSchema,
  movieStatusSchema,
} from '../validators/movie.validator.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

// Public routes (with optional auth to detect admin status for viewing inactive movies)
router.get('/', optionalAuthenticate, (req, res, next) =>
  movieController.getMovies(req, res, next)
);

router.get('/:id', optionalAuthenticate, (req, res, next) =>
  movieController.getMovieById(req, res, next)
);

// Admin-protected mutation routes
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createMovieSchema),
  (req, res, next) => movieController.createMovie(req, res, next)
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateMovieSchema),
  (req, res, next) => movieController.updateMovie(req, res, next)
);

router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  validate(movieStatusSchema),
  (req, res, next) => movieController.updateMovieStatus(req, res, next)
);

export default router;

