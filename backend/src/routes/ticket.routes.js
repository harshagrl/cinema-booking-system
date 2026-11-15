import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireStaffOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../validators/auth.validator.js';
import { validateTicketSchema } from '../validators/ticket.validator.js';

const router = Router();

// Staff/Admin QR Validation Endpoint
router.post(
  '/validate',
  authenticate,
  requireStaffOrAdmin,
  validate(validateTicketSchema),
  (req, res, next) => ticketController.validateTicket(req, res, next)
);

// Customer list own tickets
router.get(
  '/',
  authenticate,
  (req, res, next) => ticketController.getCustomerTickets(req, res, next)
);

// Customer/Staff view ticket by ID
router.get(
  '/:id',
  authenticate,
  (req, res, next) => ticketController.getTicketById(req, res, next)
);

// Customer view ticket QR code payload
router.get(
  '/:id/qr',
  authenticate,
  (req, res, next) => ticketController.getTicketQr(req, res, next)
);

// Customer view live ticket status
router.get(
  '/:id/status',
  authenticate,
  (req, res, next) => ticketController.getTicketStatus(req, res, next)
);

export default router;
