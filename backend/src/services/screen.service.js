import prisma from '../config/database.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';

export class ScreenService {
  /**
   * List screens for a theatre
   */
  static async getScreensByTheatre(theatreId, user = null) {
    const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');

    const theatre = await prisma.theatre.findUnique({ where: { id: theatreId } });
    if (!theatre) {
      throw new NotFoundError('Theatre not found');
    }
    if (!theatre.isActive && !isStaffOrAdmin) {
      throw new NotFoundError('Theatre not found');
    }

    const where = { theatreId };
    if (!isStaffOrAdmin) {
      where.isActive = true;
    }

    const screens = await prisma.screen.findMany({
      where,
      include: {
        _count: {
          select: {
            seats: true,
            shows: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return screens.map((s) => ({
      ...s,
      totalSeats: s._count.seats,
      totalShows: s._count.shows,
    }));
  }

  /**
   * Get single screen by ID with details
   */
  static async getScreenById(id, user = null) {
    const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');

    const screen = await prisma.screen.findUnique({
      where: { id },
      include: {
        theatre: {
          select: {
            id: true,
            name: true,
            location: true,
            city: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            seats: true,
            shows: true,
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

    // Get breakdown of seats by category
    const categoryCounts = await prisma.seat.groupBy({
      by: ['category'],
      where: { screenId: id, isActive: true },
      _count: { id: true },
    });

    return {
      ...screen,
      totalSeats: screen._count.seats,
      totalShows: screen._count.shows,
      categoryBreakdown: categoryCounts.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
    };
  }

  /**
   * Admin creates a screen for a theatre
   */
  static async createScreen(theatreId, data) {
    const theatre = await prisma.theatre.findUnique({ where: { id: theatreId } });
    if (!theatre) {
      throw new NotFoundError('Theatre not found');
    }

    // Check for duplicate name in theatre
    const existing = await prisma.screen.findUnique({
      where: {
        theatreId_name: {
          theatreId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new ConflictError(
        `Screen with name "${data.name}" already exists in this theatre`
      );
    }

    return prisma.screen.create({
      data: {
        theatreId,
        name: data.name,
        screenType: data.screenType || 'STANDARD',
        supportedFormats: data.supportedFormats || ['2D', '3D'],
        capacity: data.capacity !== undefined ? data.capacity : 0,
        isActive: true,
      },
    });
  }

  /**
   * Admin updates a screen
   */
  static async updateScreen(id, data) {
    const screen = await prisma.screen.findUnique({ where: { id } });
    if (!screen) {
      throw new NotFoundError('Screen not found');
    }

    // If changing name, ensure uniqueness in theatre
    if (data.name && data.name !== screen.name) {
      const duplicate = await prisma.screen.findUnique({
        where: {
          theatreId_name: {
            theatreId: screen.theatreId,
            name: data.name,
          },
        },
      });

      if (duplicate) {
        throw new ConflictError(
          `Screen with name "${data.name}" already exists in this theatre`
        );
      }
    }

    return prisma.screen.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.screenType !== undefined && { screenType: data.screenType }),
        ...(data.supportedFormats !== undefined && { supportedFormats: data.supportedFormats }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
      },
    });
  }

  /**
   * Admin activates or deactivates a screen
   */
  static async updateScreenStatus(id, isActive) {
    const screen = await prisma.screen.findUnique({ where: { id } });
    if (!screen) {
      throw new NotFoundError('Screen not found');
    }

    return prisma.screen.update({
      where: { id },
      data: { isActive },
    });
  }
}

