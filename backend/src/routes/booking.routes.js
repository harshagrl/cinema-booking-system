import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../validators/auth.validator.js';
import {
  createBookingSchema,
  simulatePaymentSchema,
} from '../validators/booking.validator.js';

const router = Router();

// Create booking from active hold
router.post(
  '/',
  authenticate,
  validate(createBookingSchema),
  (req, res, next) => bookingController.createBooking(req, res, next)
);

// List customer bookings
router.get(
  '/',
  authenticate,
  (req, res, next) => bookingController.listCustomerBookings(req, res, next)
);

// Get booking details
router.get(
  '/:id',
  authenticate,
  (req, res, next) => bookingController.getBookingById(req, res, next)
);

// Process simulated payment
router.post(
  '/:id/pay',
  authenticate,
  validate(simulatePaymentSchema),
  (req, res, next) => bookingController.processPayment(req, res, next)
);

// Get payment status/details for a booking
router.get(
  '/:id/payment',
  authenticate,
  (req, res, next) => bookingController.getBookingPayments(req, res, next)
);

export default router;
