import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import movieRoutes from './movie.routes.js';
import genreRoutes from './genre.routes.js';
import theatreRoutes from './theatre.routes.js';
import screenRoutes from './screen.routes.js';

const router = Router();

// Mount sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/movies', movieRoutes);
router.use('/genres', genreRoutes);
router.use('/theatres', theatreRoutes);
router.use('/screens', screenRoutes);

export default router;
