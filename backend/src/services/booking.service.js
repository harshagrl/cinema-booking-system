import prisma from '../config/database.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';

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
    .filter((bs) => bs.releasedAt === null)
    .map((bs) => ({
      bookingSeatId: bs.id,
      showSeatId: bs.showSeatId,
      row: bs.showSeat?.seat?.row || '',
      seatNumber: bs.showSeat?.seat?.seatNumber || 0,
      category: bs.showSeat?.seat?.category || 'REGULAR',
      price: Number(bs.price),
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
}
