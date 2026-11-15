import prisma from '../config/database.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';
import { TicketService } from './ticket.service.js';
import {
  CANCELLATION_CONFIG,
  generateRefundReference,
} from '../config/cancellation.config.js';
import { AuditService } from './audit.service.js';

const bookingIncludeQuery = {
  show: {
    include: {
      movie: {
        include: {
          genres: { include: { genre: true } },
        },
      },
      screen: {
        include: {
          theatre: true,
        },
      },
    },
  },
  seats: {
    include: {
      showSeat: {
        include: {
          seat: true,
        },
      },
    },
  },
  payments: {
    orderBy: { createdAt: 'desc' },
  },
  refunds: {
    orderBy: { createdAt: 'desc' },
  },
  tickets: {
    include: {
      bookingSeat: {
        include: {
          showSeat: { include: { seat: true } },
        },
      },
      validatedBy: {
        select: { id: true, name: true, role: true },
      },
    },
  },
  user: {
    select: { id: true, name: true, email: true },
  },
};

/**
 * Format database booking record into clean API representation
 */
export const formatBookingResponse = (b) => {
  if (!b) return null;

  const seats = (b.seats || [])
    .filter((bs) => bs.releasedAt === null || b.status === 'CANCELLED')
    .map((bs) => ({
      bookingSeatId: bs.id,
      showSeatId: bs.showSeatId,
      row: bs.showSeat?.seat?.row || '',
      seatNumber: bs.showSeat?.seat?.seatNumber || 0,
      category: bs.showSeat?.seat?.category || 'REGULAR',
      price: Number(bs.price),
      releasedAt: bs.releasedAt,
    }))
    .sort((a, b) => {
      if (a.row !== b.row) return a.row.localeCompare(b.row);
      return a.seatNumber - b.seatNumber;
    });

  const payments = (b.payments || []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    paymentMethod: p.paymentMethod || 'CARD',
    transactionReference: p.transactionReference,
    failureReason: p.failureReason,
    createdAt: p.createdAt,
  }));

  const refunds = (b.refunds || []).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    status: r.status,
    refundReference: r.refundReference,
    reason: r.reason,
    processedAt: r.processedAt,
    createdAt: r.createdAt,
  }));

  return {
    id: b.id,
    bookingReference: b.bookingReference,
    userId: b.userId,
    user: b.user,
    status: b.status,
    totalAmount: Number(b.totalAmount),
    holdId: b.holdId,
    idempotencyKey: b.idempotencyKey,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    movie: b.show?.movie
      ? {
          id: b.show.movie.id,
          title: b.show.movie.title,
          posterUrl: b.show.movie.posterUrl,
          duration: b.show.movie.duration,
          language: b.show.movie.language,
          rating: b.show.movie.rating || 'UA',
          genres: (b.show.movie.genres || []).map((g) => g.genre?.name || g.name),
        }
      : null,
    theatre: b.show?.screen?.theatre
      ? {
          id: b.show.screen.theatre.id,
          name: b.show.screen.theatre.name,
          location: b.show.screen.theatre.location,
          city: b.show.screen.theatre.city,
        }
      : null,
    screen: b.show?.screen
      ? {
          id: b.show.screen.id,
          name: b.show.screen.name,
          format: b.show.screen.format,
        }
      : null,
    show: b.show
      ? {
          id: b.show.id,
          startTime: b.show.startTime,
          endTime: b.show.endTime,
          format: b.show.format,
        }
      : null,
    seats,
    seatSummary: seats.map((s) => `${s.row}${s.seatNumber}`).join(', '),
    payments,
    latestPayment: payments[0] || null,
    refunds,
    latestRefund: refunds[0] || null,
    tickets: (b.tickets || []).map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.status,
      issuedAt: t.issuedAt,
      validatedAt: t.validatedAt,
      validatedBy: t.validatedBy ? { name: t.validatedBy.name, role: t.validatedBy.role } : null,
      seatRow: t.bookingSeat?.showSeat?.seat?.row,
      seatNumber: t.bookingSeat?.showSeat?.seat?.seatNumber,
      seatCategory: t.bookingSeat?.showSeat?.seat?.category,
    })),
  };
};

/**
 * Generate human-friendly, cryptographically distinct booking reference
 * Format: BK-YYYYMMDD-XXXX (e.g. BK-20261115-8M2Q)
 */
const generateBookingReference = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${dateStr}-${randomSuffix}`;
};

export class BookingService {
  /**
   * Create a booking from an active temporary seat hold
   */
  static async createBooking(userId, { holdId, idempotencyKey }) {
    // 1. Idempotency & Duplicate Check:
    // If a booking already exists for this holdId or idempotencyKey:
    const existingBooking = await prisma.booking.findFirst({
      where: {
        OR: [
          ...(idempotencyKey ? [{ idempotencyKey }] : []),
          { holdId },
        ],
      },
      include: bookingIncludeQuery,
    });

    if (existingBooking) {
      if (existingBooking.userId !== userId) {
        throw new ConflictError('This hold has already been booked by another user', 'HOLD_ALREADY_BOOKED');
      }
      return {
        isIdempotent: true,
        booking: formatBookingResponse(existingBooking),
      };
    }

    // 2. Perform atomic creation in transaction with lock
    return await prisma.$transaction(async (tx) => {
      // Query SeatHold records for this holdId
      const holds = await tx.seatHold.findMany({
        where: { holdId },
        include: {
          showSeat: {
            include: {
              seat: true,
              show: {
                include: {
                  movie: true,
                  screen: { include: { theatre: true } },
                },
              },
            },
          },
        },
      });

      if (!holds || holds.length === 0) {
        throw new NotFoundError('Seat hold not found or invalid hold identifier', 'HOLD_NOT_FOUND');
      }

      // Check ownership
      const notOwned = holds.find((h) => h.userId !== userId);
      if (notOwned) {
        throw new ForbiddenError(
          'You are not authorized to create a booking from another customer’s hold',
          'FORBIDDEN_HOLD_ACCESS'
        );
      }

      // Check hold status
      const hasConsumed = holds.some((h) => h.status === 'CONSUMED' || h.status === 'CONFIRMED');
      if (hasConsumed) {
        throw new ConflictError(
          'This seat hold has already been converted into a booking',
          'HOLD_ALREADY_CONSUMED'
        );
      }

      const hasReleased = holds.some((h) => h.status === 'RELEASED');
      if (hasReleased) {
        throw new BadRequestError(
          'This seat hold was released and is no longer valid',
          'HOLD_RELEASED'
        );
      }

      const now = new Date();
      const hasExpired = holds.some((h) => h.status === 'EXPIRED' || now > new Date(h.expiresAt));
      if (hasExpired) {
        // Lazily expire hold & revert seats
        await tx.seatHold.updateMany({
          where: { holdId },
          data: { status: 'EXPIRED' },
        });
        await tx.showSeat.updateMany({
          where: { id: { in: holds.map((h) => h.showSeatId) }, status: 'HELD' },
          data: { status: 'AVAILABLE', heldById: null, holdExpiresAt: null },
        });
        throw new BadRequestError('Your seat hold has expired. Please select seats again.', 'HOLD_EXPIRED');
      }

      // Verify all seats belong to same show and show is eligible
      const show = holds[0].showSeat.show;
      if (!show || !show.isActive) {
        throw new BadRequestError('The show for this booking is no longer active', 'INACTIVE_SHOW');
      }

      const showMismatch = holds.some((h) => h.showSeat.showId !== show.id);
      if (showMismatch) {
        throw new BadRequestError('Seat hold contains seats from multiple shows', 'SEAT_SHOW_MISMATCH');
      }

      // Check ShowSeat statuses
      const invalidSeat = holds.find(
        (h) => h.showSeat.status !== 'HELD' || h.showSeat.heldById !== userId
      );
      if (invalidSeat) {
        throw new ConflictError(
          'One or more seats are no longer reserved for your account',
          'SEAT_NOT_HELD'
        );
      }

      // Authoritative pricing calculation (sum of ShowSeat decimal prices)
      const totalAmount = holds.reduce((acc, h) => acc + Number(h.showSeat.price), 0);

      // Generate unique booking reference
      let bookingReference = generateBookingReference();
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 5) {
        const conflict = await tx.booking.findUnique({ where: { bookingReference } });
        if (!conflict) {
          isUnique = true;
        } else {
          bookingReference = generateBookingReference();
          attempts++;
        }
      }

      // Create Booking record
      const booking = await tx.booking.create({
        data: {
          userId,
          showId: show.id,
          holdId,
          bookingReference,
          idempotencyKey: idempotencyKey || null,
          totalAmount,
          status: 'PENDING_PAYMENT',
        },
      });

      // Create BookingSeat allocation records
      const bookingSeatsData = holds.map((h) => ({
        bookingId: booking.id,
        showSeatId: h.showSeatId,
        price: h.showSeat.price,
        releasedAt: null,
      }));

      await tx.bookingSeat.createMany({
        data: bookingSeatsData,
      });

      // Retrieve full created booking record
      const fullBooking = await tx.booking.findUnique({
        where: { id: booking.id },
        include: bookingIncludeQuery,
      });

      return {
        isIdempotent: false,
        booking: formatBookingResponse(fullBooking),
      };
    });
  }

  /**
   * Process simulated payment for a pending booking
   */
  static async processSimulatedPayment(userId, bookingId, { paymentMethod = 'CARD', simulateResult = 'SUCCESS', idempotencyKey }) {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock the booking row for update
      const [lockedBooking] = await tx.$queryRaw`
        SELECT id, "userId", "showId", "holdId", "totalAmount", status, "bookingReference"
        FROM "Booking"
        WHERE id = ${bookingId}
        FOR UPDATE
      `;

      if (!lockedBooking) {
        throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // 2. Validate ownership
      if (lockedBooking.userId !== userId) {
        throw new ForbiddenError(
          'You are not authorized to pay for another customer’s booking',
          'FORBIDDEN_BOOKING_ACCESS'
        );
      }

      // 3. Check booking status
      if (lockedBooking.status === 'CONFIRMED') {
        const fullBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: bookingIncludeQuery,
        });
        return {
          isAlreadyConfirmed: true,
          booking: formatBookingResponse(fullBooking),
          payment: fullBooking.payments[0] || null,
          message: 'Booking is already confirmed',
        };
      }

      if (lockedBooking.status === 'CANCELLED') {
        throw new BadRequestError('Cannot process payment for a cancelled booking', 'BOOKING_CANCELLED');
      }

      if (lockedBooking.status === 'EXPIRED') {
        throw new BadRequestError('This booking has expired because payment was not completed in time', 'BOOKING_EXPIRED');
      }

      if (lockedBooking.status !== 'PENDING_PAYMENT' && lockedBooking.status !== 'PENDING') {
        throw new BadRequestError(`Booking cannot be paid in current status: ${lockedBooking.status}`, 'INVALID_BOOKING_STATUS');
      }

      // 4. Check if underlying hold has expired
      if (lockedBooking.holdId) {
        const holds = await tx.seatHold.findMany({
          where: { holdId: lockedBooking.holdId },
        });

        const now = new Date();
        const holdExpired = holds.some((h) => h.status === 'EXPIRED' || now > new Date(h.expiresAt));

        if (holdExpired) {
          // Mark booking and holds as expired, release showSeats
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'EXPIRED' },
          });
          await tx.seatHold.updateMany({
            where: { holdId: lockedBooking.holdId },
            data: { status: 'EXPIRED' },
          });
          await tx.showSeat.updateMany({
            where: { id: { in: holds.map((h) => h.showSeatId) }, status: 'HELD' },
            data: { status: 'AVAILABLE', heldById: null, holdExpiresAt: null },
          });
          await tx.bookingSeat.updateMany({
            where: { bookingId },
            data: { releasedAt: new Date() },
          });

          throw new BadRequestError('Your 5-minute seat hold has expired. The seats have been released.', 'HOLD_EXPIRED');
        }
      }

      // 5. Idempotency check on payment key
      if (idempotencyKey) {
        const existingPayment = await tx.payment.findUnique({
          where: { idempotencyKey },
        });
        if (existingPayment) {
          const fullBooking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: bookingIncludeQuery,
          });
          return {
            isIdempotent: true,
            payment: {
              id: existingPayment.id,
              amount: Number(existingPayment.amount),
              status: existingPayment.status,
              paymentMethod: existingPayment.paymentMethod,
              transactionReference: existingPayment.transactionReference,
              createdAt: existingPayment.createdAt,
            },
            booking: formatBookingResponse(fullBooking),
            message: 'Idempotent payment request returned previous result',
          };
        }
      }

      // 6. Generate distinct transaction reference
      const txnRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // 7. Handle simulated payment result
      if (simulateResult === 'SUCCESS') {
        // Create successful Payment record
        const payment = await tx.payment.create({
          data: {
            bookingId,
            amount: lockedBooking.totalAmount,
            status: 'SUCCESS',
            paymentMethod,
            idempotencyKey: idempotencyKey || null,
            transactionReference: txnRef,
          },
        });

        // Transition Booking to CONFIRMED
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'CONFIRMED' },
        });

        // Retrieve allocated seat IDs
        const bookingSeats = await tx.bookingSeat.findMany({
          where: { bookingId, releasedAt: null },
        });
        const showSeatIds = bookingSeats.map((bs) => bs.showSeatId);

        // Transition ShowSeat records to BOOKED & clear temporary hold metadata
        await tx.showSeat.updateMany({
          where: { id: { in: showSeatIds } },
          data: {
            status: 'BOOKED',
            heldById: null,
            holdExpiresAt: null,
          },
        });

        // Transition SeatHold records to CONSUMED
        if (lockedBooking.holdId) {
          await tx.seatHold.updateMany({
            where: { holdId: lockedBooking.holdId },
            data: { status: 'CONSUMED' },
          });
        }

        // Atomically generate individual tickets for each booked seat
        await TicketService.generateTicketsForBooking(tx, bookingId);

        const fullBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: bookingIncludeQuery,
        });

        return {
          success: true,
          payment: {
            id: payment.id,
            amount: Number(payment.amount),
            status: payment.status,
            paymentMethod: payment.paymentMethod,
            transactionReference: payment.transactionReference,
            createdAt: payment.createdAt,
          },
          booking: formatBookingResponse(fullBooking),
          message: 'Payment simulation succeeded. Booking confirmed!',
        };
      } else {
        // Payment Failure simulation
        const payment = await tx.payment.create({
          data: {
            bookingId,
            amount: lockedBooking.totalAmount,
            status: 'FAILED',
            paymentMethod,
            idempotencyKey: idempotencyKey || null,
            transactionReference: txnRef,
            failureReason: 'Payment simulation declined by test scenario',
          },
        });

        // Failed payment policy:
        // Booking remains in PENDING_PAYMENT, ShowSeat records remain HELD until hold expiration.
        // Customer can retry payment within their remaining hold window.
        const fullBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: bookingIncludeQuery,
        });

        return {
          success: false,
          payment: {
            id: payment.id,
            amount: Number(payment.amount),
            status: payment.status,
            paymentMethod: payment.paymentMethod,
            transactionReference: payment.transactionReference,
            failureReason: payment.failureReason,
            createdAt: payment.createdAt,
          },
          booking: formatBookingResponse(fullBooking),
          message: 'Payment simulation failed. Seats remain held; you may retry payment before hold expires.',
        };
      }
    });
  }

  /**
   * List authenticated customer's bookings with pagination and optional status filter
   */
  static async listCustomerBookings(userId, { page = 1, limit = 10, status = null } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      userId,
      ...(status ? { status } : {}),
    };

    const [total, records] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: bookingIncludeQuery,
      }),
    ]);

    return {
      bookings: records.map(formatBookingResponse),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        hasMore: skip + records.length < total,
      },
    };
  }

  /**
   * Retrieve single booking details by ID (verified ownership or admin/staff role)
   */
  static async getBookingById(userId, userRole, bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingIncludeQuery,
    });

    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (userRole !== 'ADMIN' && userRole !== 'STAFF' && booking.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view this booking', 'FORBIDDEN_BOOKING_ACCESS');
    }

    return formatBookingResponse(booking);
  }

  /**
   * Retrieve payment history for a booking
   */
  static async getBookingPayments(userId, userRole, bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (userRole !== 'ADMIN' && userRole !== 'STAFF' && booking.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view payments for this booking', 'FORBIDDEN_BOOKING_ACCESS');
    }

    const payments = await prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      paymentMethod: p.paymentMethod || 'CARD',
      transactionReference: p.transactionReference,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Cancel an eligible confirmed booking, release seats, invalidate tickets,
   * issue a simulated full refund, and persist audit logs in an atomic transaction.
   */
  static async cancelBooking(actingUser, bookingId, { reason } = {}) {
    if (!actingUser) {
      throw new ForbiddenError('Authentication required to cancel bookings');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Lock the booking row with row-level lock
      const [lockedBooking] = await tx.$queryRaw`
        SELECT b.id, b.status, b."userId", b."showId", b."totalAmount", b."holdId", b."bookingReference"
        FROM "Booking" b
        WHERE b.id = ${bookingId}
        FOR UPDATE
      `;

      if (!lockedBooking) {
        throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // 2. Authorization check:
      // Customers can only cancel their own bookings.
      // Staff and Admin must not be able to cancel customer bookings through customer endpoints.
      if (lockedBooking.userId !== actingUser.id) {
        throw new ForbiddenError(
          'You are not authorized to cancel this booking. Customers may only cancel their own reservations.',
          'FORBIDDEN'
        );
      }

      // 3. State eligibility checks
      if (lockedBooking.status === 'CANCELLED') {
        throw new BadRequestError('This booking has already been cancelled', 'ALREADY_CANCELLED');
      }

      if (lockedBooking.status !== 'CONFIRMED') {
        throw new BadRequestError(
          `Only CONFIRMED bookings with successful payment can be cancelled (current status: ${lockedBooking.status})`,
          'BOOKING_NOT_ELIGIBLE'
        );
      }

      // 4. Fetch full relations inside transaction
      const booking = await tx.booking.findUnique({
        where: { id: lockedBooking.id },
        include: {
          show: true,
          payments: {
            where: { status: 'SUCCESS' },
            orderBy: { createdAt: 'desc' },
          },
          seats: {
            where: { releasedAt: null },
            include: { showSeat: true },
          },
          tickets: true,
          refunds: true,
        },
      });

      const now = new Date();
      const showStartTime = new Date(booking.show.startTime);

      // 5. Verify no tickets have already been scanned/used
      const usedTicket = booking.tickets.find((t) => t.status === 'USED');
      if (usedTicket) {
        throw new BadRequestError(
          `Cannot cancel booking because ticket ${usedTicket.ticketNumber} has already been scanned and used for admission`,
          'TICKET_ALREADY_USED'
        );
      }

      // 6. Prevent cancellation after showtime begins
      if (now >= showStartTime) {
        throw new BadRequestError(
          'Cannot cancel booking because the scheduled showtime has already commenced or passed',
          'SHOW_ALREADY_STARTED'
        );
      }

      // 7. Configurable cancellation cutoff check
      const cutoffMs = CANCELLATION_CONFIG.CUTOFF_HOURS * 60 * 60 * 1000;
      if (showStartTime.getTime() - now.getTime() < cutoffMs) {
        throw new BadRequestError(
          `Cancellations must be requested at least ${CANCELLATION_CONFIG.CUTOFF_HOURS} hours prior to showtime. Cutoff window has passed.`,
          'PAST_CANCELLATION_CUTOFF'
        );
      }

      // 8. Payment & Refund eligibility
      const successPayment = booking.payments[0];
      if (!successPayment) {
        throw new BadRequestError(
          'No successful payment record found to process refund',
          'NO_SUCCESSFUL_PAYMENT'
        );
      }

      // Prevent duplicate refunds on repeated cancellation
      const existingProcessedRefund = booking.refunds.find((r) => r.status === 'PROCESSED');
      if (existingProcessedRefund) {
        throw new ConflictError(
          'A refund has already been processed for this booking',
          'REFUND_ALREADY_PROCESSED'
        );
      }

      // 9. Authoritative refund calculation (never client-supplied)
      const refundAmount = successPayment.amount;
      if (Number(refundAmount) > Number(successPayment.amount)) {
        throw new BadRequestError('Refund amount cannot exceed original payment amount', 'INVALID_REFUND_AMOUNT');
      }

      const refundReference = generateRefundReference();

      // 10. Create Refund record (CRITICAL: preserve Payment status as SUCCESS)
      const refund = await tx.refund.create({
        data: {
          bookingId: lockedBooking.id,
          paymentId: successPayment.id,
          refundReference,
          amount: refundAmount,
          status: 'PROCESSED',
          reason: reason || 'Customer requested full booking cancellation',
          processedAt: now,
        },
      });

      // 11. Transition Booking to CANCELLED
      await tx.booking.update({
        where: { id: lockedBooking.id },
        data: { status: 'CANCELLED' },
      });

      // 12. Release BookingSeat allocations by setting releasedAt timestamp
      const showSeatIds = booking.seats.map((s) => s.showSeatId);
      await tx.bookingSeat.updateMany({
        where: { bookingId: lockedBooking.id, releasedAt: null },
        data: { releasedAt: now },
      });

      // 13. Transition ShowSeat rows back to AVAILABLE and clear hold/booking metadata
      if (showSeatIds.length > 0) {
        await tx.showSeat.updateMany({
          where: { id: { in: showSeatIds } },
          data: {
            status: 'AVAILABLE',
            heldById: null,
            holdExpiresAt: null,
          },
        });
      }

      // 14. Transition associated Tickets to CANCELLED
      await tx.ticket.updateMany({
        where: { bookingId: lockedBooking.id },
        data: { status: 'CANCELLED' },
      });

      // 15. Create Audit Log entries in the same transaction
      await AuditService.log(tx, {
        actorId: actingUser.id,
        action: 'BOOKING_CANCELLED',
        entityType: 'BOOKING',
        entityId: lockedBooking.id,
        metadata: {
          bookingReference: lockedBooking.bookingReference,
          showId: booking.showId,
          seatsReleased: showSeatIds.length,
          refundReference: refund.refundReference,
          refundAmount: Number(refund.amount),
          reason: refund.reason,
        },
      });

      await AuditService.log(tx, {
        actorId: actingUser.id,
        action: 'REFUND_PROCESSED',
        entityType: 'REFUND',
        entityId: refund.id,
        metadata: {
          bookingId: lockedBooking.id,
          paymentId: successPayment.id,
          amount: Number(refund.amount),
          refundReference: refund.refundReference,
          status: refund.status,
        },
      });

      // Fetch complete updated booking for API response
      const updatedBooking = await tx.booking.findUnique({
        where: { id: lockedBooking.id },
        include: bookingIncludeQuery,
      });

      return {
        success: true,
        message: 'Booking cancelled successfully. Simulated refund processed.',
        booking: formatBookingResponse(updatedBooking),
        refund: {
          id: refund.id,
          refundReference: refund.refundReference,
          amount: Number(refund.amount),
          status: refund.status,
          reason: refund.reason,
          processedAt: refund.processedAt,
        },
      };
    });
  }

  /**
   * Retrieve refund history for a booking
   */
  static async getBookingRefunds(actingUser, bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (actingUser.role === 'CUSTOMER' && booking.userId !== actingUser.id) {
      throw new ForbiddenError('You are not authorized to view refunds for this booking');
    }

    const refunds = await prisma.refund.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      include: {
        payment: {
          select: { id: true, amount: true, paymentMethod: true, transactionReference: true },
        },
      },
    });

    return refunds.map((r) => ({
      id: r.id,
      bookingId: r.bookingId,
      paymentId: r.paymentId,
      refundReference: r.refundReference,
      amount: Number(r.amount),
      status: r.status,
      reason: r.reason,
      processedAt: r.processedAt,
      createdAt: r.createdAt,
      payment: r.payment
        ? {
            id: r.payment.id,
            amount: Number(r.payment.amount),
            paymentMethod: r.payment.paymentMethod,
            transactionReference: r.payment.transactionReference,
          }
        : null,
    }));
  }
}
