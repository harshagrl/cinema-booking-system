import movieService from '../services/movie.service.js';

class MovieController {
  /**
   * GET /api/movies
   * Public: Query movies with search, genre/language filter, pagination.
   */
  async getMovies(req, res, next) {
    try {
      const result = await movieService.getMovies(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/movies/:id
   * Public: Retrieve movie details by ID.
   */
  async getMovieById(req, res, next) {
    try {
      const { id } = req.params;
      const movie = await movieService.getMovieById(id, req.user);
      res.status(200).json({
        success: true,
        data: { movie },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/movies
   * Admin only: Create a new movie with genre associations.
   */
  async createMovie(req, res, next) {
    try {
      const movie = await movieService.createMovie(req.body);
      res.status(201).json({
        success: true,
        message: 'Movie created successfully',
        data: { movie },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/movies/:id
   * Admin only: Update movie details and synchronize genre associations.
   */
  async updateMovie(req, res, next) {
    try {
      const { id } = req.params;
      const movie = await movieService.updateMovie(id, req.body);
      res.status(200).json({
        success: true,
        message: 'Movie updated successfully',
        data: { movie },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/movies/:id/status
   * Admin only: Toggle or set movie active/inactive status.
   */
  async updateMovieStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const movie = await movieService.updateMovieStatus(id, isActive);
      res.status(200).json({
        success: true,
        message: `Movie '${movie.title}' has been ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: { movie },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new MovieController();

