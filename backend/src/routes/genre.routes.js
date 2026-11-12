import { Router } from 'express';
import genreController from '../controllers/genre.controller.js';
import { validate } from '../validators/auth.validator.js';
import { createGenreSchema, updateGenreSchema } from '../validators/genre.validator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

// Public route
router.get('/', (req, res, next) => genreController.getAllGenres(req, res, next));

// Admin-protected routes
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createGenreSchema),
  (req, res, next) => genreController.createGenre(req, res, next)
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateGenreSchema),
  (req, res, next) => genreController.updateGenre(req, res, next)
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  (req, res, next) => genreController.deleteGenre(req, res, next)
);

export default router;

