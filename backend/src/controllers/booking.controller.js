import { BookingService } from '../services/booking.service.js';

class BookingController {
  /**
   * POST /api/bookings
   * Customer: Create a booking from an active temporary seat hold
   */
  async createBooking(req, res, next) {
    try {
      const { holdId } = req.body;
      const idempotencyKey =
        req.body.idempotencyKey ||
        req.headers['idempotency-key'] ||
        req.headers['x-idempotency-key'];

      const result = await BookingService.createBooking(req.user.id, {
        holdId,
        idempotencyKey,
      });

      const statusCode = result.isIdempotent ? 200 : 201;

      res.status(statusCode).json({
        success: true,
        message: result.isIdempotent
          ? 'Existing booking returned (idempotent request)'
          : 'Booking created successfully. Pending payment.',
        data: result.booking,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings
   * Customer: List authenticated user's bookings with pagination
   */
  async listCustomerBookings(req, res, next) {
    try {
      const result = await BookingService.listCustomerBookings(req.user.id, req.query);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings/:id
   * Customer/Admin/Staff: Retrieve booking details
   */
  async getBookingById(req, res, next) {
    try {
      const { id } = req.params;
      const booking = await BookingService.getBookingById(req.user.id, req.user.role, id);
      res.status(200).json({
        success: true,
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/bookings/:id/pay
   * Customer: Process simulated payment
   */
  async processPayment(req, res, next) {
    try {
      const { id } = req.params;
      const { paymentMethod, simulateResult } = req.body;
      const idempotencyKey =
        req.body.idempotencyKey ||
        req.headers['idempotency-key'] ||
        req.headers['x-idempotency-key'];

      const result = await BookingService.processSimulatedPayment(req.user.id, id, {
        paymentMethod,
        simulateResult,
        idempotencyKey,
      });

      res.status(200).json({
        success: result.success !== false,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings/:id/payment
   * Customer/Admin/Staff: Retrieve payment history for a booking
   */
  async getBookingPayments(req, res, next) {
    try {
      const { id } = req.params;
      const payments = await BookingService.getBookingPayments(req.user.id, req.user.role, id);
      res.status(200).json({
        success: true,
        data: {
          bookingId: id,
          payments,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/bookings/:id/cancel
   * Customer: Cancel an eligible confirmed booking and receive simulated refund
   */
  async cancelBooking(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const result = await BookingService.cancelBooking(req.user, id, { reason });

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings/:id/refunds
   * Customer/Admin/Staff: Retrieve refund history for a booking
   */
  async getBookingRefunds(req, res, next) {
    try {
      const { id } = req.params;
      const refunds = await BookingService.getBookingRefunds(req.user, id);
      res.status(200).json({
        success: true,
        data: {
          bookingId: id,
          refunds,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const bookingController = new BookingController();
