import { Router } from 'express';
import holdController from '../controllers/hold.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Current active hold for logged-in user
router.get('/current', authenticate, (req, res, next) =>
  holdController.getCurrentUserHold(req, res, next)
);

// Release hold by holdId
router.delete('/:holdId', authenticate, (req, res, next) =>
  holdController.releaseHold(req, res, next)
);

export default router;
