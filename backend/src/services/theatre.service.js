import prisma from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class TheatreService {
  /**
   * List theatres with optional filtering and screen count summary
   */
  static async getAllTheatres(filters = {}, user = null) {
    const { search, city, includeInactive } = filters;
    const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');

    const where = {};

    // Customer/public can only view active theatres
    if (!isStaffOrAdmin || !includeInactive) {
      where.isActive = true;
    }

    if (city) {
      where.city = {
        contains: city,
        mode: 'insensitive',
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const theatres = await prisma.theatre.findMany({
      where,
      include: {
        screens: {
          select: {
            id: true,
            name: true,
            screenType: true,
            supportedFormats: true,
            capacity: true,
            isActive: true,
            _count: {
              select: {
                seats: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return theatres.map((t) => ({
      ...t,
      screensCount: t.screens.length,
      activeScreensCount: t.screens.filter((s) => s.isActive).length,
      totalCapacity: t.screens.reduce((acc, s) => acc + (s.capacity || 0), 0),
    }));
  }

  /**
   * Get single theatre by ID with its screens
   */
  static async getTheatreById(id, user = null) {
    const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');

    const theatre = await prisma.theatre.findUnique({
      where: { id },
      include: {
        screens: {
          select: {
            id: true,
            name: true,
            screenType: true,
            supportedFormats: true,
            capacity: true,
            isActive: true,
            _count: {
              select: {
                seats: true,
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!theatre) {
      throw new NotFoundError('Theatre not found');
    }

    if (!theatre.isActive && !isStaffOrAdmin) {
      throw new NotFoundError('Theatre not found');
    }

    return {
      ...theatre,
      screensCount: theatre.screens.length,
      activeScreensCount: theatre.screens.filter((s) => s.isActive).length,
      totalCapacity: theatre.screens.reduce((acc, s) => acc + (s.capacity || 0), 0),
    };
  }

  /**
   * Admin creates a new theatre
   */
  static async createTheatre(data) {
    return prisma.theatre.create({
      data: {
        name: data.name,
        location: data.location,
        city: data.city,
        address: data.address || data.location,
        isActive: true,
      },
    });
  }

  /**
   * Admin updates theatre details
   */
  static async updateTheatre(id, data) {
    const existing = await prisma.theatre.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Theatre not found');
    }

    return prisma.theatre.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.address !== undefined && { address: data.address }),
      },
    });
  }

  /**
   * Admin activates or deactivates a theatre
   */
  static async updateTheatreStatus(id, isActive) {
    const existing = await prisma.theatre.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Theatre not found');
    }

    return prisma.theatre.update({
      where: { id },
      data: { isActive },
    });
  }
}

