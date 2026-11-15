import crypto from 'crypto';
import prisma from '../config/database.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';
import {
  generateOpaqueToken,
  hashQrToken,
  generateQrDataUrl,
} from '../utils/qr.js';

const ticketIncludeQuery = {
  booking: {
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      show: {
        include: {
          movie: true,
          screen: {
            include: { theatre: true },
          },
        },
      },
      payments: {
        where: { status: 'SUCCESS' },
      },
    },
  },
  bookingSeat: {
    include: {
      showSeat: {
        include: { seat: true },
      },
    },
  },
  validatedBy: {
    select: { id: true, name: true, role: true },
  },
};

/**
 * Format database ticket into customer-facing digital ticket (excluding qrTokenHash)
 */
export const formatTicketResponse = async (t, includeQr = false) => {
  if (!t) return null;

  const qrToken = generateOpaqueToken(t.id, t.ticketNumber);
  const qrCode = includeQr ? await generateQrDataUrl(qrToken) : undefined;

  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    bookingId: t.bookingId,
    bookingReference: t.booking?.bookingReference,
    status: t.status,
    issuedAt: t.issuedAt,
    validatedAt: t.validatedAt,
    validatedBy: t.validatedBy ? { name: t.validatedBy.name, role: t.validatedBy.role } : null,
    seat: {
      row: t.bookingSeat?.showSeat?.seat?.row,
      seatNumber: t.bookingSeat?.showSeat?.seat?.seatNumber,
      category: t.bookingSeat?.showSeat?.seat?.category,
      price: Number(t.bookingSeat?.price || 0),
    },
    movie: t.booking?.show?.movie
      ? {
          id: t.booking.show.movie.id,
          title: t.booking.show.movie.title,
          posterUrl: t.booking.show.movie.posterUrl,
          duration: t.booking.show.movie.duration,
          language: t.booking.show.movie.language,
          rating: t.booking.show.movie.rating || 'UA',
        }
      : null,
    theatre: t.booking?.show?.screen?.theatre
      ? {
          id: t.booking.show.screen.theatre.id,
          name: t.booking.show.screen.theatre.name,
          location: t.booking.show.screen.theatre.location,
          city: t.booking.show.screen.theatre.city,
        }
      : null,
    screen: t.booking?.show?.screen
      ? {
          id: t.booking.show.screen.id,
          name: t.booking.show.screen.name,
          format: t.booking.show.screen.format,
        }
      : null,
    show: t.booking?.show
      ? {
          id: t.booking.show.id,
          startTime: t.booking.show.startTime,
          endTime: t.booking.show.endTime,
          format: t.booking.show.format,
        }
      : null,
    qrToken,
    qrCode,
  };
};

/**
 * Generate human-friendly, cryptographically distinct ticket number
 * Format: TKT-YYYYMMDD-XXXX (e.g. TKT-20261115-A7B9C2)
 */
export const generateTicketNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TKT-${dateStr}-${randomSuffix}`;
};

export class TicketService {
  /**
   * Internal transactional generator: creates individual tickets for each confirmed BookingSeat
   */
  static async generateTicketsForBooking(tx, bookingId) {
    const bookingSeats = await tx.bookingSeat.findMany({
      where: { bookingId, releasedAt: null },
      include: { ticket: true },
    });

    const generatedTickets = [];

    for (const bs of bookingSeats) {
      // Idempotency: skip if ticket already issued for this BookingSeat
      if (bs.ticket) {
        generatedTickets.push(bs.ticket);
        continue;
      }

      const ticketId = crypto.randomUUID();
      let ticketNumber = generateTicketNumber();

      // Ensure uniqueness of ticketNumber
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 5) {
        const conflict = await tx.ticket.findUnique({ where: { ticketNumber } });
        if (!conflict) {
          isUnique = true;
        } else {
          ticketNumber = generateTicketNumber();
          attempts++;
        }
      }

      const opaqueToken = generateOpaqueToken(ticketId, ticketNumber);
      const qrTokenHash = hashQrToken(opaqueToken);

      const ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          ticketNumber,
          bookingId,
          bookingSeatId: bs.id,
          qrTokenHash,
          status: 'VALID',
        },
      });

      generatedTickets.push(ticket);
    }

    return generatedTickets;
  }

  /**
   * List authenticated customer's tickets
   */
  static async getCustomerTickets(userId, { status = null, page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      booking: { userId },
      ...(status ? { status } : {}),
    };

    const [total, records] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { issuedAt: 'desc' },
        include: ticketIncludeQuery,
      }),
    ]);

    const formatted = await Promise.all(
      records.map((t) => formatTicketResponse(t, true))
    );

    return {
      tickets: formatted,
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
   * Retrieve ticket by ID with full authorization check
   */
  static async getTicketById(userId, userRole, ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: ticketIncludeQuery,
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
    }

    if (userRole !== 'ADMIN' && userRole !== 'STAFF' && ticket.booking.userId !== userId) {
      throw new ForbiddenError('You are not authorized to access this ticket', 'FORBIDDEN_TICKET_ACCESS');
    }

    return await formatTicketResponse(ticket, true);
  }

  /**
   * Retrieve QR code verification image and opaque token for ticket owner
   */
  static async getTicketQr(userId, userRole, ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        booking: {
          select: { userId: true, bookingReference: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
    }

    if (userRole !== 'ADMIN' && userRole !== 'STAFF' && ticket.booking.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view QR code for this ticket', 'FORBIDDEN_TICKET_ACCESS');
    }

    const qrToken = generateOpaqueToken(ticket.id, ticket.ticketNumber);
    const qrCode = await generateQrDataUrl(qrToken);

    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      bookingReference: ticket.booking.bookingReference,
      status: ticket.status,
      qrToken,
      qrCode,
    };
  }

  /**
   * Retrieve live ticket status
   */
  static async getTicketStatus(userId, userRole, ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        booking: { select: { userId: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
    }

    if (userRole !== 'ADMIN' && userRole !== 'STAFF' && ticket.booking.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view status for this ticket', 'FORBIDDEN_TICKET_ACCESS');
    }

    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      validatedAt: ticket.validatedAt,
    };
  }

  /**
   * One-time QR ticket validation engine (STAFF / ADMIN access)
   * Row-locked via SELECT FOR UPDATE, atomic validation, strict idempotency
   */
  static async validateTicket(staffUser, qrToken) {
    const tokenHash = hashQrToken(qrToken);

    return await prisma.$transaction(async (tx) => {
      // 1. Lock the ticket row using raw query to prevent race conditions
      const [lockedTicket] = await tx.$queryRaw`
        SELECT t.id, t."ticketNumber", t."bookingId", t."bookingSeatId", t.status, t."issuedAt", t."validatedAt", t."validatedById"
        FROM "Ticket" t
        WHERE t."qrTokenHash" = ${tokenHash}
        FOR UPDATE
      `;

      if (!lockedTicket) {
        throw new NotFoundError('Ticket token does not exist or is invalid', 'INVALID_TICKET');
      }

      // Query full relations within transaction
      const fullTicket = await tx.ticket.findUnique({
        where: { id: lockedTicket.id },
        include: ticketIncludeQuery,
      });

      // 2. Verify ticket has not already been used
      if (lockedTicket.status === 'USED') {
        throw new ConflictError(
          `Ticket ${lockedTicket.ticketNumber} was already scanned and used on ${lockedTicket.validatedAt?.toISOString() || 'earlier date'}.`,
          'ALREADY_USED'
        );
      }

      // 3. Verify ticket is not cancelled
      if (lockedTicket.status === 'CANCELLED') {
        throw new BadRequestError('This ticket has been cancelled and is invalid for entry', 'CANCELLED');
      }

      // 4. Verify ticket is not expired
      if (lockedTicket.status === 'EXPIRED') {
        throw new BadRequestError('This ticket has expired', 'EXPIRED');
      }

      // 5. Verify booking is confirmed
      const booking = fullTicket.booking;
      if (!booking || booking.status !== 'CONFIRMED') {
        throw new BadRequestError('Associated booking is not in CONFIRMED state', 'PAYMENT_NOT_CONFIRMED');
      }

      // 6. Verify successful payment exists
      const hasSuccessPayment = (booking.payments || []).length > 0;
      if (!hasSuccessPayment) {
        throw new BadRequestError('No successful payment found for this ticket reservation', 'PAYMENT_NOT_CONFIRMED');
      }

      // 7. Verify show entry window
      const show = booking.show;
      if (!show || !show.isActive) {
        throw new BadRequestError('The scheduled show for this ticket is inactive or cancelled', 'INACTIVE_SHOW');
      }

      const now = new Date();
      // Entry window opens 4 hours before show and closes 1 hour after show ends
      const entryOpenTime = new Date(new Date(show.startTime).getTime() - 4 * 60 * 60 * 1000);
      const entryCloseTime = new Date(new Date(show.endTime).getTime() + 60 * 60 * 1000);

      if (now < entryOpenTime) {
        throw new BadRequestError(
          `Show entry is not yet open. Entry opens 4 hours prior to screening at ${entryOpenTime.toLocaleTimeString()}.`,
          'NOT_YET_VALID'
        );
      }

      if (now > entryCloseTime) {
        // Expire the ticket in DB
        await tx.ticket.update({
          where: { id: lockedTicket.id },
          data: { status: 'EXPIRED' },
        });
        throw new BadRequestError('The entry window for this show has closed. Ticket expired.', 'EXPIRED');
      }

      // 8. Atomically transition ticket from VALID to USED
      const validatedTicket = await tx.ticket.update({
        where: { id: lockedTicket.id },
        data: {
          status: 'USED',
          validatedAt: now,
          validatedById: staffUser.id,
        },
        include: ticketIncludeQuery,
      });

      const formatted = await formatTicketResponse(validatedTicket, false);

      return {
        code: 'VALIDATED',
        message: `Ticket ${validatedTicket.ticketNumber} successfully validated. Entry granted!`,
        ticket: formatted,
        validatedBy: {
          id: staffUser.id,
          name: staffUser.name,
          role: staffUser.role,
        },
        validatedAt: now,
      };
    });
  }
}
