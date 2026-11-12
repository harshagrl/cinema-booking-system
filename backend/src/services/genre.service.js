import prisma from '../config/database.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';

class GenreService {
  /**
   * Normalize genre name (trimmed, capitalized).
   */
  normalizeName(name) {
    const trimmed = name.trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  /**
   * Retrieve all genres ordered alphabetically with movie association count.
   */
  async getAllGenres() {
    const genres = await prisma.genre.findMany({
      include: {
        _count: {
          select: { movies: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return genres.map((g) => ({
      id: g.id,
      name: g.name,
      movieCount: g._count.movies,
    }));
  }

  /**
   * Create a new genre (Admin only).
   * Enforces uniqueness (case-insensitive check).
   */
  async createGenre({ name }) {
    const normalized = this.normalizeName(name);

    // Case-insensitive duplicate check
    const existing = await prisma.genre.findFirst({
      where: {
        name: { equals: normalized, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictError(
        `Genre '${normalized}' already exists.`,
        'GENRE_ALREADY_EXISTS'
      );
    }

    const genre = await prisma.genre.create({
      data: { name: normalized },
    });

    return {
      id: genre.id,
      name: genre.name,
      movieCount: 0,
    };
  }

  /**
   * Update an existing genre name (Admin only).
   */
  async updateGenre(id, { name }) {
    const normalized = this.normalizeName(name);

    // 1. Verify genre exists
    const genre = await prisma.genre.findUnique({
      where: { id },
    });

    if (!genre) {
      throw new NotFoundError('Genre not found.', 'GENRE_NOT_FOUND');
    }

    // 2. Check for name collision with another genre
    const duplicate = await prisma.genre.findFirst({
      where: {
        name: { equals: normalized, mode: 'insensitive' },
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new ConflictError(
        `Another genre named '${normalized}' already exists.`,
        'GENRE_ALREADY_EXISTS'
      );
    }

    const updated = await prisma.genre.update({
      where: { id },
      data: { name: normalized },
      include: {
        _count: {
          select: { movies: true },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      movieCount: updated._count.movies,
    };
  }

  /**
   * Delete an existing genre safely (Admin only).
   * Prevents deletion if movies are actively associated with this genre.
   */
  async deleteGenre(id) {
    const genre = await prisma.genre.findUnique({
      where: { id },
      include: {
        _count: {
          select: { movies: true },
        },
      },
    });

    if (!genre) {
      throw new NotFoundError('Genre not found.', 'GENRE_NOT_FOUND');
    }

    // Unsafe deletion check: Reject if associated with existing movies
    if (genre._count.movies > 0) {
      throw new BadRequestError(
        `Cannot delete genre '${genre.name}'. It is currently associated with ${genre._count.movies} movie(s). Remove these associations first.`,
        'GENRE_IN_USE'
      );
    }

    await prisma.genre.delete({
      where: { id },
    });

    return {
      id: genre.id,
      name: genre.name,
      deleted: true,
    };
  }
}

export default new GenreService();

