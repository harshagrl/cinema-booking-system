import prisma from '../config/database.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { AuditService } from './audit.service.js';

export const DEFAULT_CATEGORY_PRICES = {
  REGULAR: 200,
  SILVER: 180,
  GOLD: 250,
  PREMIUM: 350,
  RECLINER: 500,
};

export class ShowService {
  /**
   * List shows with filters (movie, theatre, screen, date, city, format)
   * Customers view only active shows on active screens/theatres/movies
   */
  static async getShows(filters = {}, user = null) {
    const { movieId, theatreId, screenId, date, city, format, includeInactive } = filters;
    const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');

    const where = {};

    // Customer/public can only view active shows
    if (!isStaffOrAdmin || !includeInactive) {
      where.isActive = true;
      where.movie = { isActive: true };
      where.screen = {
        isActive: true,
        theatre: { isActive: true },
      };
    }

    if (movieId) {
      where.movieId = movieId;
    }

    if (screenId) {
      where.screenId = screenId;
    }

    if (theatreId) {
      where.screen = {
        ...(where.screen || {}),
        theatreId,
      };
    }

    if (city) {
      where.screen = {
        ...(where.screen || {}),
        theatre: {
          ...(where.screen?.theatre || {}),
          city: { contains: city, mode: 'insensitive' },
        },
      };
    }

    if (format) {
      where.format = { equals: format, mode: 'insensitive' };
    }

    if (date) {
      // Filter by calendar date (UTC window covering 24-hr day)
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const shows = await prisma.show.findMany({
      where,
      include: {
        movie: {
          select: {
            id: true,
            title: true,
            description: true,
            duration: true,
            language: true,
            posterUrl: true,
            rating: true,
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
        showSeats: {
          select: {
            price: true,
            status: true,
            seat: {
              select: {
                category: true,
              },
            },
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return shows.map((show) => {
      const totalSeats = show.showSeats.length;
      const availableSeats = show.showSeats.filter((s) => s.status === 'AVAILABLE').length;

      // Extract pricing summary
      const prices = show.showSeats.map((s) => Number(s.price));
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      const categoryPricing = {};
      for (const s of show.showSeats) {
        if (!categoryPricing[s.seat.category]) {
          categoryPricing[s.seat.category] = Number(s.price);
        }
      }

      // Exclude full showSeats array from listing to keep payload concise
      const { showSeats, ...rest } = show;
      return {
        ...rest,
        totalSeats,
        availableSeats,
        pricing: {
          minPrice,
          maxPrice,
          categories: categoryPricing,
        },
      };
    });
  }

  /**
   * Get show by ID with details and pricing breakdown
   */
  static async getShowById(id, user = null) {
    const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');

    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        movie: {
          include: {
            genres: {
              include: { genre: true },
            },
          },
        },
        screen: {
          include: {
            theatre: true,
          },
        },
        showSeats: {
          select: {
            price: true,
            status: true,
            seat: {
              select: {
                category: true,
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
      throw new NotFoundError('Show not found');
    }

    const totalSeats = show.showSeats.length;
    const availableSeats = show.showSeats.filter((s) => s.status === 'AVAILABLE').length;
    const prices = show.showSeats.map((s) => Number(s.price));
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const categoryPricing = {};
    for (const s of show.showSeats) {
      if (!categoryPricing[s.seat.category]) {
        categoryPricing[s.seat.category] = Number(s.price);
      }
    }

    const { showSeats, ...rest } = show;
    return {
      ...rest,
      totalSeats,
      availableSeats,
      pricing: {
        minPrice,
        maxPrice,
        categories: categoryPricing,
      },
    };
  }

  /**
   * Customer discovery: Showtimes for a specific movie grouped by theatre
   */
  static async getMovieShows(movieId, filters = {}) {
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
    });

    if (!movie || !movie.isActive) {
      throw new NotFoundError('Movie not found or inactive');
    }

    const shows = await this.getShows({ ...filters, movieId }, null);

    // Group shows by Theatre for friendly customer discovery UI
    const theatreMap = new Map();

    for (const show of shows) {
      const theatre = show.screen.theatre;
      if (!theatreMap.has(theatre.id)) {
        theatreMap.set(theatre.id, {
          theatre: {
            id: theatre.id,
            name: theatre.name,
            location: theatre.location,
            city: theatre.city,
            address: theatre.address,
          },
          shows: [],
        });
      }

      theatreMap.get(theatre.id).shows.push({
        id: show.id,
        screenId: show.screen.id,
        screenName: show.screen.name,
        screenType: show.screen.screenType,
        startTime: show.startTime,
        endTime: show.endTime,
        format: show.format,
        availableSeats: show.availableSeats,
        totalSeats: show.totalSeats,
        pricing: show.pricing,
      });
    }

    return {
      movie: {
        id: movie.id,
        title: movie.title,
        duration: movie.duration,
        language: movie.language,
        rating: movie.rating,
        posterUrl: movie.posterUrl,
      },
      theatres: Array.from(theatreMap.values()),
      totalShows: shows.length,
    };
  }

  /**
   * Customer discovery: Shows at a specific theatre grouped by movie
   */
  static async getTheatreShows(theatreId, filters = {}) {
    const theatre = await prisma.theatre.findUnique({
      where: { id: theatreId },
    });

    if (!theatre || !theatre.isActive) {
      throw new NotFoundError('Theatre not found or inactive');
    }

    const shows = await this.getShows({ ...filters, theatreId }, null);

    // Group shows by Movie
    const movieMap = new Map();

    for (const show of shows) {
      const movie = show.movie;
      if (!movieMap.has(movie.id)) {
        movieMap.set(movie.id, {
          movie,
          shows: [],
        });
      }

      movieMap.get(movie.id).shows.push({
        id: show.id,
        screenId: show.screen.id,
        screenName: show.screen.name,
        screenType: show.screen.screenType,
        startTime: show.startTime,
        endTime: show.endTime,
        format: show.format,
        availableSeats: show.availableSeats,
        totalSeats: show.totalSeats,
        pricing: show.pricing,
      });
    }

    return {
      theatre: {
        id: theatre.id,
        name: theatre.name,
        location: theatre.location,
        city: theatre.city,
        address: theatre.address,
      },
      movies: Array.from(movieMap.values()),
      totalShows: shows.length,
    };
  }

  /**
   * Admin schedules a new show
   * Implements robust PostgreSQL row-level concurrency protection:
   * Locks Screen row with SELECT ... FOR UPDATE within a transaction to prevent concurrent overlaps
   */
  static async createShow(data, user = null) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify Movie
      const movie = await tx.movie.findUnique({
        where: { id: data.movieId },
      });

      if (!movie) {
        throw new NotFoundError('Movie not found');
      }
      if (!movie.isActive) {
        throw new BadRequestError(
          'Cannot schedule a show for an inactive movie',
          'INACTIVE_MOVIE'
        );
      }

      // 2. Concurrency Lock: Lock Screen row exclusively for this transaction
      const screenRows = await tx.$queryRaw`
        SELECT "id", "name", "theatreId", "screenType", "supportedFormats", "isActive"
        FROM "Screen"
        WHERE "id" = ${data.screenId}
        FOR UPDATE
      `;

      if (!screenRows || screenRows.length === 0) {
        throw new NotFoundError('Screen not found');
      }
      const screen = screenRows[0];

      if (!screen.isActive) {
        throw new BadRequestError(
          'Cannot schedule a show for an inactive screen',
          'INACTIVE_SCREEN'
        );
      }

      // 3. Verify Theatre
      const theatre = await tx.theatre.findUnique({
        where: { id: screen.theatreId },
      });
      if (!theatre || !theatre.isActive) {
        throw new BadRequestError(
          'Cannot schedule a show for an inactive theatre',
          'INACTIVE_THEATRE'
        );
      }

      // 4. Validate Format
      const requestedFormat = data.format.toUpperCase();
      const supported = (screen.supportedFormats || []).map((f) => f.toUpperCase());
      if (!supported.includes(requestedFormat)) {
        throw new BadRequestError(
          `Format "${data.format}" is not supported by screen "${screen.name}". Supported formats: ${screen.supportedFormats.join(', ')}`,
          'UNSUPPORTED_FORMAT'
        );
      }

      // 5. Calculate & Validate Timing
      const startTime = new Date(data.startTime);
      const bufferMinutes = data.bufferMinutes !== undefined ? data.bufferMinutes : 15;
      const minDurationMs = movie.duration * 60 * 1000;
      const bufferMs = bufferMinutes * 60 * 1000;
      let endTime;

      if (data.endTime) {
        endTime = new Date(data.endTime);
        if (endTime <= startTime) {
          throw new BadRequestError(
            'Show end time must be after start time',
            'INVALID_SHOW_TIME'
          );
        }
        if (endTime.getTime() < startTime.getTime() + minDurationMs) {
          throw new BadRequestError(
            `Show end time must allow for movie duration of ${movie.duration} minutes`,
            'SHOW_DURATION_TOO_SHORT'
          );
        }
      } else {
        endTime = new Date(startTime.getTime() + minDurationMs + bufferMs);
      }

      // 6. Overlap Detection with Screen Row Exclusively Locked
      // Two intervals [A_start, A_end] and [B_start, B_end] overlap iff A_start < B_end AND A_end > B_start
      const conflictingShow = await tx.show.findFirst({
        where: {
          screenId: data.screenId,
          isActive: true,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        include: {
          movie: { select: { title: true } },
        },
      });

      if (conflictingShow) {
        throw new ConflictError(
          `Scheduling conflict: Screen "${screen.name}" already has an active show for "${conflictingShow.movie.title}" from ${conflictingShow.startTime.toISOString()} to ${conflictingShow.endTime.toISOString()}`,
          'SHOWTIME_OVERLAP'
        );
      }

      // 7. Physical Seats Check
      const physicalSeats = await tx.seat.findMany({
        where: {
          screenId: data.screenId,
          isActive: true,
        },
        orderBy: [{ row: 'asc' }, { seatNumber: 'asc' }],
      });

      if (physicalSeats.length === 0) {
        throw new BadRequestError(
          `Cannot schedule show: Screen "${screen.name}" has no configured active physical seats`,
          'NO_ACTIVE_SEATS'
        );
      }

      // 8. Create Show
      const show = await tx.show.create({
        data: {
          movieId: data.movieId,
          screenId: data.screenId,
          startTime,
          endTime,
          format: data.format,
          isActive: true,
        },
      });

      // 9. Initialize ShowSeat records with Category-based Pricing
      const mergedPricing = {
        ...DEFAULT_CATEGORY_PRICES,
        ...(data.pricing || {}),
      };

      const showSeatsData = physicalSeats.map((seat) => ({
        showId: show.id,
        seatId: seat.id,
        price: Number(mergedPricing[seat.category] || DEFAULT_CATEGORY_PRICES[seat.category] || 200),
        status: 'AVAILABLE',
      }));

      await tx.showSeat.createMany({
        data: showSeatsData,
      });

      // Audit log show creation
      await AuditService.log(tx, {
        actorId: user?.id,
        action: 'SHOW_CREATED',
        entityType: 'SHOW',
        entityId: show.id,
        metadata: {
          movieId: show.movieId,
          screenId: show.screenId,
          format: show.format,
          startTime: show.startTime,
        },
      });

      return {
        ...show,
        movie: {
          id: movie.id,
          title: movie.title,
          duration: movie.duration,
          language: movie.language,
          rating: movie.rating,
          posterUrl: movie.posterUrl,
        },
        screen: {
          id: screen.id,
          name: screen.name,
          screenType: screen.screenType,
          theatre: {
            id: theatre.id,
            name: theatre.name,
            location: theatre.location,
            city: theatre.city,
          },
        },
        totalSeats: physicalSeats.length,
        availableSeats: physicalSeats.length,
        pricing: {
          categories: mergedPricing,
        },
      };
    });
  }

  /**
   * Admin updates an existing show
   */
  static async updateShow(id, data, user = null) {
    return prisma.$transaction(async (tx) => {
      const show = await tx.show.findUnique({
        where: { id },
        include: {
          movie: true,
          screen: true,
          _count: { select: { bookings: true } },
        },
      });

      if (!show) {
        throw new NotFoundError('Show not found');
      }

      // Lock Screen row
      await tx.$queryRaw`
        SELECT "id" FROM "Screen" WHERE "id" = ${show.screenId} FOR UPDATE
      `;

      let startTime = show.startTime;
      let endTime = show.endTime;

      if (data.startTime) {
        startTime = new Date(data.startTime);
      }

      if (data.endTime) {
        endTime = new Date(data.endTime);
        if (endTime <= startTime) {
          throw new BadRequestError(
            'Show end time must be after start time',
            'INVALID_SHOW_TIME'
          );
        }
      } else if (data.startTime) {
        const bufferMinutes = data.bufferMinutes !== undefined ? data.bufferMinutes : 15;
        const minDurationMs = show.movie.duration * 60 * 1000;
        const bufferMs = bufferMinutes * 60 * 1000;
        endTime = new Date(startTime.getTime() + minDurationMs + bufferMs);
      }

      // Validate Format if updating
      if (data.format && data.format !== show.format) {
        const supported = (show.screen.supportedFormats || []).map((f) => f.toUpperCase());
        if (!supported.includes(data.format.toUpperCase())) {
          throw new BadRequestError(
            `Format "${data.format}" is not supported by screen "${show.screen.name}"`,
            'UNSUPPORTED_FORMAT'
          );
        }
      }

      // Overlap Detection excluding current show
      const conflictingShow = await tx.show.findFirst({
        where: {
          screenId: show.screenId,
          isActive: true,
          id: { not: id },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        include: {
          movie: { select: { title: true } },
        },
      });

      if (conflictingShow) {
        throw new ConflictError(
          `Scheduling conflict: Screen "${show.screen.name}" already has an active show for "${conflictingShow.movie.title}" from ${conflictingShow.startTime.toISOString()} to ${conflictingShow.endTime.toISOString()}`,
          'SHOWTIME_OVERLAP'
        );
      }

      // Update Show
      const updatedShow = await tx.show.update({
        where: { id },
        data: {
          ...(data.startTime && { startTime }),
          ...(data.endTime && { endTime }),
          ...(data.format && { format: data.format }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      // Update pricing on AVAILABLE seats if pricing specified
      if (data.pricing) {
        for (const [category, price] of Object.entries(data.pricing)) {
          if (price !== undefined) {
            // Find all seat IDs with this category on this screen
            const categorySeats = await tx.seat.findMany({
              where: { screenId: show.screenId, category },
              select: { id: true },
            });
            const seatIds = categorySeats.map((s) => s.id);

            await tx.showSeat.updateMany({
              where: {
                showId: id,
                seatId: { in: seatIds },
                status: 'AVAILABLE',
              },
              data: {
                price: Number(price),
              },
            });
          }
        }
      }

      // Audit log show update
      await AuditService.log(tx, {
        actorId: user?.id,
        action: 'SHOW_UPDATED',
        entityType: 'SHOW',
        entityId: updatedShow.id,
        metadata: {
          screenId: updatedShow.screenId,
          startTime: updatedShow.startTime,
          format: updatedShow.format,
          isActive: updatedShow.isActive,
        },
      });

      return updatedShow;
    });
  }

  /**
   * Admin toggles show active status (soft toggle)
   */
  static async updateShowStatus(id, isActive, user = null) {
    const show = await prisma.show.findUnique({ where: { id } });
    if (!show) {
      throw new NotFoundError('Show not found');
    }

    const updated = await prisma.show.update({
      where: { id },
      data: { isActive },
    });

    await AuditService.log(prisma, {
      actorId: user?.id,
      action: 'SHOW_STATUS_CHANGED',
      entityType: 'SHOW',
      entityId: id,
      metadata: { isActive },
    });

    return updated;
  }
}
