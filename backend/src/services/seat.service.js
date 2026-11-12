import prisma from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

export class SeatService {
  /**
   * Get physical seats for a screen with layout structure
   */
  static async getSeatsByScreen(screenId, user = null) {
    const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');

    const screen = await prisma.screen.findUnique({
      where: { id: screenId },
      include: {
        theatre: {
          select: {
            id: true,
            name: true,
            city: true,
            isActive: true,
          },
        },
      },
    });

    if (!screen) {
      throw new NotFoundError('Screen not found');
    }

    if ((!screen.isActive || !screen.theatre.isActive) && !isStaffOrAdmin) {
      throw new NotFoundError('Screen not found');
    }

    const seats = await prisma.seat.findMany({
      where: { screenId },
      orderBy: [
        { row: 'asc' },
        { seatNumber: 'asc' },
      ],
    });

    // Compute category counts
    const categoryCounts = seats.reduce((acc, seat) => {
      acc[seat.category] = (acc[seat.category] || 0) + 1;
      return acc;
    }, {});

    // Group seats by row for layout rendering
    const rowsMap = {};
    for (const seat of seats) {
      if (!rowsMap[seat.row]) {
        rowsMap[seat.row] = [];
      }
      rowsMap[seat.row].push(seat);
    }

    const rows = Object.keys(rowsMap)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((rowName) => ({
        row: rowName,
        seats: rowsMap[rowName],
      }));

    return {
      screen: {
        id: screen.id,
        name: screen.name,
        screenType: screen.screenType,
        supportedFormats: screen.supportedFormats,
        capacity: screen.capacity,
        isActive: screen.isActive,
        theatre: screen.theatre,
      },
      totalSeats: seats.length,
      activeSeats: seats.filter((s) => s.isActive).length,
      categoryCounts,
      rows,
      seats,
    };
  }

  /**
   * Bulk configure physical seat layout for a screen
   * Enforces referential integrity: cannot remove seats referenced in active/historical shows
   */
  static async bulkConfigureSeats(screenId, seatList) {
    return prisma.$transaction(async (tx) => {
      const screen = await tx.screen.findUnique({
        where: { id: screenId },
      });

      if (!screen) {
        throw new NotFoundError('Screen not found');
      }

      // 1. Fetch all existing seats for this screen
      const existingSeats = await tx.seat.findMany({
        where: { screenId },
        include: {
          _count: {
            select: { showSeats: true },
          },
        },
      });

      const existingSeatMap = new Map();
      const referencedSeatIds = new Set();

      for (const seat of existingSeats) {
        const key = `${seat.row}-${seat.seatNumber}`;
        existingSeatMap.set(key, seat);
        if (seat._count.showSeats > 0) {
          referencedSeatIds.add(seat.id);
        }
      }

      // 2. Validate that no referenced seat is missing from the new configuration
      const newKeys = new Set(seatList.map((s) => `${s.row}-${s.seatNumber}`));
      for (const seat of existingSeats) {
        if (seat._count.showSeats > 0) {
          const key = `${seat.row}-${seat.seatNumber}`;
          if (!newKeys.has(key)) {
            throw new BadRequestError(
              `Cannot remove seat ${seat.row}${seat.seatNumber} because it is referenced in existing show seat allocations`,
              'SEAT_REFERENCED_IN_SHOWS'
            );
          }
        }
      }

      // 3. Process deletions (only unreferenced seats that are not in new layout)
      const seatsToDelete = existingSeats.filter(
        (seat) => !newKeys.has(`${seat.row}-${seat.seatNumber}`) && seat._count.showSeats === 0
      );

      if (seatsToDelete.length > 0) {
        await tx.seat.deleteMany({
          where: {
            id: { in: seatsToDelete.map((s) => s.id) },
          },
        });
      }

      // 4. Process upserts/updates
      for (const seatItem of seatList) {
        const key = `${seatItem.row}-${seatItem.seatNumber}`;
        const existing = existingSeatMap.get(key);

        if (existing) {
          // Update category and isActive if changed
          if (
            existing.category !== seatItem.category ||
            existing.isActive !== (seatItem.isActive ?? true)
          ) {
            await tx.seat.update({
              where: { id: existing.id },
              data: {
                category: seatItem.category,
                isActive: seatItem.isActive !== undefined ? seatItem.isActive : true,
              },
            });
          }
        } else {
          // Insert new seat
          await tx.seat.create({
            data: {
              screenId,
              row: seatItem.row,
              seatNumber: seatItem.seatNumber,
              category: seatItem.category,
              isActive: seatItem.isActive !== undefined ? seatItem.isActive : true,
            },
          });
        }
      }

      // 5. Update screen capacity
      const updatedScreen = await tx.screen.update({
        where: { id: screenId },
        data: {
          capacity: seatList.length,
        },
      });

      // 6. Fetch final seat list
      const finalSeats = await tx.seat.findMany({
        where: { screenId },
        orderBy: [{ row: 'asc' }, { seatNumber: 'asc' }],
      });

      return {
        screen: updatedScreen,
        totalSeats: finalSeats.length,
        activeSeats: finalSeats.filter((s) => s.isActive).length,
        seats: finalSeats,
      };
    });
  }

  /**
   * Bulk update individual seat attributes (e.g. toggle isActive, change category)
   */
  static async bulkUpdateSeats(screenId, updates) {
    return prisma.$transaction(async (tx) => {
      const screen = await tx.screen.findUnique({
        where: { id: screenId },
      });

      if (!screen) {
        throw new NotFoundError('Screen not found');
      }

      for (const update of updates) {
        let seatId = update.id;

        if (!seatId && update.row && update.seatNumber) {
          const seat = await tx.seat.findUnique({
            where: {
              screenId_row_seatNumber: {
                screenId,
                row: update.row,
                seatNumber: update.seatNumber,
              },
            },
          });
          if (seat) {
            seatId = seat.id;
          }
        }

        if (seatId) {
          await tx.seat.update({
            where: { id: seatId },
            data: {
              ...(update.category && { category: update.category }),
              ...(update.isActive !== undefined && { isActive: update.isActive }),
            },
          });
        }
      }

      const finalSeats = await tx.seat.findMany({
        where: { screenId },
        orderBy: [{ row: 'asc' }, { seatNumber: 'asc' }],
      });

      return {
        screenId,
        totalSeats: finalSeats.length,
        activeSeats: finalSeats.filter((s) => s.isActive).length,
        seats: finalSeats,
      };
    });
  }
}

