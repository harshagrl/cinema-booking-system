import crypto from 'crypto';
import prisma from '../config/database.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';
import { MAX_SEATS_PER_HOLD } from '../validators/hold.validator.js';

export const DEFAULT_HOLD_DURATION_SECONDS = 300; // 5 minutes

export class HoldService {
  /**
   * Expire stale holds on-demand for a show or globally
   * Idempotent and transaction-safe
   */
  static async cleanupExpiredHolds(showId = null) {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const holdWhere = {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      };

      if (showId) {
        holdWhere.showSeat = { showId };
      }

      const expiredHolds = await tx.seatHold.findMany({
        where: holdWhere,
        select: {
          id: true,
          showSeatId: true,
          userId: true,
          holdId: true,
        },
      });

      if (expiredHolds.length === 0) {
        return { expiredCount: 0 };
      }

      const holdRecordIds = expiredHolds.map((h) => h.id);
      const showSeatIds = expiredHolds.map((h) => h.showSeatId);

      // 1. Mark SeatHold records as EXPIRED
      await tx.seatHold.updateMany({
        where: { id: { in: holdRecordIds } },
        data: { status: 'EXPIRED' },
      });

      // 2. Revert ShowSeat records to AVAILABLE only if still linked to this expired hold
      for (const hold of expiredHolds) {
        await tx.showSeat.updateMany({
          where: {
            id: hold.showSeatId,
            status: 'HELD',
            heldById: hold.userId,
            holdExpiresAt: { lte: now },
          },
          data: {
            status: 'AVAILABLE',
            heldById: null,
            holdExpiresAt: null,
          },
        });
      }

      return { expiredCount: expiredHolds.length };
    });
  }

  /**
   * GET /api/shows/:showId/seats
   * Retrieves seat layout with current availability status for each seat
   */
  static async getShowSeatLayout(showId, user = null) {
    const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');
    const now = new Date();

    // 1. Run on-demand expiration check for this show
    await this.cleanupExpiredHolds(showId);

    // 2. Fetch Show details
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        movie: {
          select: {
            id: true,
            title: true,
            duration: true,
            language: true,
            rating: true,
            posterUrl: true,
            isActive: true,
          },
        },
        screen: {
          select: {
            id: true,
            name: true,
            screenType: true,
            supportedFormats: true,
            capacity: true,
            isActive: true,
            theatre: {
              select: {
                id: true,
                name: true,
                location: true,
                city: true,
                address: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!show) {
      throw new NotFoundError('Show not found');
    }

    if (
      (!show.isActive ||
        !show.movie.isActive ||
        !show.screen.isActive ||
        !show.screen.theatre.isActive) &&
      !isStaffOrAdmin
    ) {
      throw new NotFoundError('Show not found or unavailable');
    }

    // 3. Fetch all ShowSeats for this show ordered by row and seat number
    const showSeats = await prisma.showSeat.findMany({
      where: { showId },
      include: {
        seat: {
          select: {
            id: true,
            row: true,
            seatNumber: true,
            category: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { seat: { row: 'asc' } },
        { seat: { seatNumber: 'asc' } },
      ],
    });

    // 4. Map seat availability status without exposing private customer data
    const rowsMap = {};
    let totalSeats = 0;
    let availableSeats = 0;
    let heldSeats = 0;
    let bookedSeats = 0;

    const categoryPricing = {};

    for (const ss of showSeats) {
      totalSeats++;
      const price = Number(ss.price);
      if (!categoryPricing[ss.seat.category]) {
        categoryPricing[ss.seat.category] = price;
      }

      let clientStatus = 'AVAILABLE';
      let isMyHold = false;

      if (!ss.seat.isActive) {
        clientStatus = 'UNAVAILABLE';
      } else if (ss.status === 'BOOKED') {
        clientStatus = 'BOOKED';
        bookedSeats++;
      } else if (ss.status === 'HELD') {
        if (ss.holdExpiresAt && ss.holdExpiresAt <= now) {
          clientStatus = 'AVAILABLE';
          availableSeats++;
        } else {
          clientStatus = 'HELD';
          heldSeats++;
          if (user && ss.heldById === user.id) {
            isMyHold = true;
          }
        }
      } else {
        clientStatus = 'AVAILABLE';
        availableSeats++;
      }

      const rowName = ss.seat.row;
      if (!rowsMap[rowName]) {
        rowsMap[rowName] = [];
      }

      rowsMap[rowName].push({
        id: ss.id, // ShowSeat ID for booking/holds
        seatId: ss.seat.id,
        row: ss.seat.row,
        seatNumber: ss.seat.seatNumber,
        category: ss.seat.category,
        price,
        status: clientStatus,
        isMyHold,
      });
    }

    const rows = Object.keys(rowsMap)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((rowName) => ({
        row: rowName,
        seats: rowsMap[rowName].sort((a, b) => a.seatNumber - b.seatNumber),
      }));

    return {
      show: {
        id: show.id,
        startTime: show.startTime,
        endTime: show.endTime,
        format: show.format,
        isActive: show.isActive,
        movie: show.movie,
        theatre: show.screen.theatre,
        screen: {
          id: show.screen.id,
          name: show.screen.name,
          screenType: show.screen.screenType,
          capacity: show.screen.capacity,
        },
      },
      stats: {
        totalSeats,
        availableSeats,
        heldSeats,
        bookedSeats,
      },
      categoryPricing,
      rows,
    };
  }

  /**
   * POST /api/shows/:showId/holds
   * Concurrently safe, transaction-based temporary seat hold engine
   * Locks ShowSeat rows using PostgreSQL SELECT ... FOR UPDATE in sorted order
   */
  static async createHold(showId, showSeatIds, user) {
    if (!user) {
      throw new BadRequestError('User authentication required to hold seats');
    }

    if (!Array.isArray(showSeatIds) || showSeatIds.length === 0) {
      throw new BadRequestError('At least one seat must be selected to hold');
    }

    if (showSeatIds.length > MAX_SEATS_PER_HOLD) {
      throw new BadRequestError(
        `Cannot hold more than ${MAX_SEATS_PER_HOLD} seats in a single reservation`
      );
    }

    // Sort seat IDs deterministically to eliminate deadlocks
    const sortedIds = [...new Set(showSeatIds)].sort();
    if (sortedIds.length !== showSeatIds.length) {
      throw new BadRequestError('Duplicate seat IDs detected in hold request');
    }

    return prisma.$transaction(
      async (tx) => {
        const now = new Date();

        // 1. Validate Show
        const show = await tx.show.findUnique({
          where: { id: showId },
          include: {
            movie: true,
            screen: { include: { theatre: true } },
          },
        });

        if (!show || !show.isActive) {
          throw new NotFoundError('Show not found or inactive');
        }

        if (
          !show.movie.isActive ||
          !show.screen.isActive ||
          !show.screen.theatre.isActive
        ) {
          throw new BadRequestError(
            'Cannot hold seats: Show movie, screen or theatre is inactive'
          );
        }

        // 2. Concurrency Lock: Lock requested ShowSeat rows in ascending ID order
        // In PostgreSQL, SELECT ... FOR UPDATE halts competing transactions on the same rows
        const lockedRows = await tx.$queryRaw`
          SELECT ss.id, ss."showId", ss."seatId", ss.price, ss.status, ss."heldById", ss."holdExpiresAt",
                 s."isActive" as "seatIsActive", s.row, s."seatNumber", s.category
          FROM "ShowSeat" ss
          JOIN "Seat" s ON ss."seatId" = s.id
          WHERE ss.id = ANY(${sortedIds}::text[])
          ORDER BY ss.id ASC
          FOR UPDATE OF ss
        `;

        if (!lockedRows || lockedRows.length !== sortedIds.length) {
          throw new NotFoundError('One or more requested seats do not exist');
        }

        // 3. Verify all locked seats belong to this show
        for (const seat of lockedRows) {
          if (seat.showId !== showId) {
            throw new BadRequestError(
              `Seat ${seat.row}${seat.seatNumber} does not belong to this show`,
              'SEAT_SHOW_MISMATCH'
            );
          }
        }

        // 4. On-demand expiration transition for locked seats
        for (const seat of lockedRows) {
          if (seat.status === 'HELD' && seat.holdExpiresAt && new Date(seat.holdExpiresAt) <= now) {
            // Expire stale hold records for this seat
            await tx.seatHold.updateMany({
              where: {
                showSeatId: seat.id,
                status: 'ACTIVE',
              },
              data: { status: 'EXPIRED' },
            });

            // Revert seat to AVAILABLE
            await tx.showSeat.update({
              where: { id: seat.id },
              data: {
                status: 'AVAILABLE',
                heldById: null,
                holdExpiresAt: null,
              },
            });

            seat.status = 'AVAILABLE';
            seat.heldById = null;
            seat.holdExpiresAt = null;
          }
        }

        // 5. Availability Verification (All-or-Nothing)
        for (const seat of lockedRows) {
          if (!seat.seatIsActive) {
            throw new BadRequestError(
              `Seat ${seat.row}${seat.seatNumber} is currently unavailable for booking`,
              'SEAT_UNAVAILABLE'
            );
          }

          if (seat.status === 'BOOKED') {
            throw new ConflictError(
              `Seat ${seat.row}${seat.seatNumber} is already booked`,
              'SEAT_ALREADY_BOOKED'
            );
          }

          if (seat.status === 'HELD') {
            if (seat.heldById !== user.id) {
              throw new ConflictError(
                `Seat ${seat.row}${seat.seatNumber} is currently held by another customer`,
                'SEAT_ALREADY_HELD'
              );
            }
          }
        }

        // 6. Generate Hold ID and Expiration Timestamp using authoritative server time
        const holdId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + DEFAULT_HOLD_DURATION_SECONDS * 1000);

        // 7. Insert SeatHold records (protected by unique_active_seat_hold partial index)
        for (const seat of lockedRows) {
          await tx.seatHold.create({
            data: {
              holdId,
              showSeatId: seat.id,
              userId: user.id,
              expiresAt,
              status: 'ACTIVE',
            },
          });
        }

        // 8. Update ShowSeat status atomically
        await tx.showSeat.updateMany({
          where: { id: { in: sortedIds } },
          data: {
            status: 'HELD',
            heldById: user.id,
            holdExpiresAt: expiresAt,
          },
        });

        const totalAmount = lockedRows.reduce((sum, s) => sum + Number(s.price), 0);

        return {
          holdId,
          showId,
          userId: user.id,
          expiresAt: expiresAt.toISOString(),
          expiresInSeconds: DEFAULT_HOLD_DURATION_SECONDS,
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          seats: lockedRows.map((s) => ({
            showSeatId: s.id,
            seatId: s.seatId,
            row: s.row,
            seatNumber: s.seatNumber,
            category: s.category,
            price: Number(s.price),
          })),
        };
      },
      {
        timeout: 10000,
      }
    );
  }

  /**
   * GET /api/holds/current
   * Retrieves authenticated customer's current active hold
   */
  static async getCurrentUserHold(userId) {
    const now = new Date();

    // 1. Clean up any expired holds for this user
    await this.cleanupExpiredHolds();

    // 2. Find active holds for this user
    const activeSeatHolds = await prisma.seatHold.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      include: {
        showSeat: {
          include: {
            seat: true,
            show: {
              include: {
                movie: { select: { title: true, posterUrl: true, duration: true } },
                screen: {
                  include: {
                    theatre: { select: { name: true, city: true, location: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSeatHolds.length === 0) {
      return { hold: null };
    }

    // Group by latest holdId
    const latestHoldId = activeSeatHolds[0].holdId || activeSeatHolds[0].id;
    const holdSeats = activeSeatHolds.filter(
      (h) => (h.holdId || h.id) === latestHoldId
    );

    const firstItem = holdSeats[0];
    const expiresAt = firstItem.expiresAt;
    const expiresInSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    );

    const seats = holdSeats.map((h) => ({
      showSeatId: h.showSeat.id,
      row: h.showSeat.seat.row,
      seatNumber: h.showSeat.seat.seatNumber,
      category: h.showSeat.seat.category,
      price: Number(h.showSeat.price),
    }));

    const totalAmount = seats.reduce((sum, s) => sum + s.price, 0);

    return {
      hold: {
        holdId: latestHoldId,
        showId: firstItem.showSeat.showId,
        movieTitle: firstItem.showSeat.show.movie.title,
        moviePoster: firstItem.showSeat.show.movie.posterUrl,
        theatreName: firstItem.showSeat.show.screen.theatre.name,
        screenName: firstItem.showSeat.show.screen.name,
        startTime: firstItem.showSeat.show.startTime,
        format: firstItem.showSeat.show.format,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        seats,
      },
    };
  }

  /**
   * DELETE /api/holds/:holdId
   * Releases an active hold belonging to the authenticated customer
   */
  static async releaseHold(holdId, user) {
    if (!user) {
      throw new BadRequestError('User authentication required');
    }

    return prisma.$transaction(async (tx) => {
      // Find holds by holdId or record ID
      const holds = await tx.seatHold.findMany({
        where: {
          OR: [{ holdId }, { id: holdId }],
        },
      });

      if (holds.length === 0) {
        throw new NotFoundError('Hold not found');
      }

      // Verify ownership: customer can release only their own hold
      if (holds.some((h) => h.userId !== user.id)) {
        throw new ForbiddenError(
          'You can release only your own temporary holds',
          'FORBIDDEN'
        );
      }

      const activeHolds = holds.filter((h) => h.status === 'ACTIVE');

      // If already expired or released, handle gracefully and return safe confirmation
      if (activeHolds.length === 0) {
        return {
          released: false,
          message: 'Hold is already expired or released',
        };
      }

      const holdRecordIds = activeHolds.map((h) => h.id);
      const showSeatIds = activeHolds.map((h) => h.showSeatId);

      // 1. Mark SeatHold records as RELEASED (preserving historical audit)
      await tx.seatHold.updateMany({
        where: { id: { in: holdRecordIds } },
        data: { status: 'RELEASED' },
      });

      // 2. Revert ShowSeat records to AVAILABLE
      await tx.showSeat.updateMany({
        where: {
          id: { in: showSeatIds },
          heldById: user.id,
        },
        data: {
          status: 'AVAILABLE',
          heldById: null,
          holdExpiresAt: null,
        },
      });

      return {
        released: true,
        releasedSeatsCount: showSeatIds.length,
        message: 'Temporary seat hold released successfully',
      };
    });
  }
}

