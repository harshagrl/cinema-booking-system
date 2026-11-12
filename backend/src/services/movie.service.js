import prisma from '../config/database.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

class MovieService {
  /**
   * Helper to format Prisma movie records with clean flattened genres.
   */
  formatMovie(movie) {
    if (!movie) return null;
    const { genres, ...movieData } = movie;
    return {
      ...movieData,
      genres: genres ? genres.map((mg) => mg.genre || mg) : [],
    };
  }

  /**
   * Query movies with search, filter, pagination, and role-based visibility.
   * Public users only see active movies. Admins can optionally request inactive movies.
   */
  async getMovies(query = {}, user = null) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const isAdmin = user?.role === 'ADMIN';
    const where = {};

    // 1. Visibility rule
    if (isAdmin && query.includeInactive === 'true') {
      // Admin requested all movies (active and inactive)
    } else {
      where.isActive = true;
    }

    // 2. Title search
    if (query.search && query.search.trim()) {
      where.title = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    // 3. Language filter
    if (query.language && query.language.trim()) {
      where.language = {
        equals: query.language.trim(),
        mode: 'insensitive',
      };
    }

    // 4. Genre filter (accepts either genre ID or genre name)
    if (query.genre && query.genre.trim()) {
      const genreVal = query.genre.trim();
      where.genres = {
        some: {
          OR: [
            { genreId: genreVal },
            { genre: { name: { equals: genreVal, mode: 'insensitive' } } },
          ],
        },
      };
    }

    // Execute count and data fetch in parallel transaction
    const [total, rawMovies] = await prisma.$transaction([
      prisma.movie.count({ where }),
      prisma.movie.findMany({
        where,
        skip,
        take: limit,
        include: {
          genres: {
            include: {
              genre: true,
            },
          },
        },
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const movies = rawMovies.map((m) => this.formatMovie(m));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      movies,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Retrieve a single movie by ID with complete genre information.
   */
  async getMovieById(id, user = null) {
    const rawMovie = await prisma.movie.findUnique({
      where: { id },
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });

    if (!rawMovie) {
      throw new NotFoundError('Movie not found.', 'MOVIE_NOT_FOUND');
    }

    // Inactive movies are hidden from non-admin users
    if (!rawMovie.isActive && user?.role !== 'ADMIN') {
      throw new NotFoundError(
        'The requested movie is currently inactive or unavailable.',
        'MOVIE_INACTIVE'
      );
    }

    return this.formatMovie(rawMovie);
  }

  /**
   * Create a new movie with genre associations (Admin only).
   */
  async createMovie(data) {
    const { genreIds, releaseDate, ...rest } = data;

    // 1. Validate that all requested genres exist in database
    const existingGenres = await prisma.genre.findMany({
      where: { id: { in: genreIds } },
    });

    if (existingGenres.length !== genreIds.length) {
      throw new BadRequestError(
        'One or more selected genres are invalid or do not exist in the database.',
        'INVALID_GENRE_SELECTION'
      );
    }

    // 2. Insert movie and join records inside a transaction
    const createdMovie = await prisma.movie.create({
      data: {
        ...rest,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        genres: {
          create: genreIds.map((genreId) => ({
            genre: { connect: { id: genreId } },
          })),
        },
      },
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });

    return this.formatMovie(createdMovie);
  }

  /**
   * Update movie details and synchronize genre associations (Admin only).
   */
  async updateMovie(id, data) {
    // 1. Verify movie exists
    const movie = await prisma.movie.findUnique({
      where: { id },
    });

    if (!movie) {
      throw new NotFoundError('Movie not found.', 'MOVIE_NOT_FOUND');
    }

    const { genreIds, releaseDate, ...rest } = data;

    // If genreIds provided, validate them
    if (genreIds) {
      const existingGenres = await prisma.genre.findMany({
        where: { id: { in: genreIds } },
      });

      if (existingGenres.length !== genreIds.length) {
        throw new BadRequestError(
          'One or more selected genres are invalid or do not exist in the database.',
          'INVALID_GENRE_SELECTION'
        );
      }
    }

    // 2. Update movie and sync genres inside a transaction
    const updatedMovie = await prisma.$transaction(async (tx) => {
      // If genres are provided, re-synchronize junction records
      if (genreIds) {
        await tx.movieGenre.deleteMany({
          where: { movieId: id },
        });

        await tx.movieGenre.createMany({
          data: genreIds.map((genreId) => ({
            movieId: id,
            genreId,
          })),
        });
      }

      const updatePayload = { ...rest };
      if (releaseDate !== undefined) {
        updatePayload.releaseDate = releaseDate ? new Date(releaseDate) : null;
      }

      return tx.movie.update({
        where: { id },
        data: updatePayload,
        include: {
          genres: {
            include: {
              genre: true,
            },
          },
        },
      });
    });

    return this.formatMovie(updatedMovie);
  }

  /**
   * Soft activation or deactivation of a movie (Admin only).
   * Preserves all shows, bookings, and audit records.
   */
  async updateMovieStatus(id, isActive) {
    const movie = await prisma.movie.findUnique({
      where: { id },
    });

    if (!movie) {
      throw new NotFoundError('Movie not found.', 'MOVIE_NOT_FOUND');
    }

    const updated = await prisma.movie.update({
      where: { id },
      data: { isActive },
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });

    return this.formatMovie(updated);
  }
}

export default new MovieService();

