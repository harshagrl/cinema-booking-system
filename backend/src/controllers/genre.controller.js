import genreService from '../services/genre.service.js';

class GenreController {
  /**
   * GET /api/genres
   * Public: Retrieve all genres with movie counts.
   */
  async getAllGenres(req, res, next) {
    try {
      const genres = await genreService.getAllGenres();
      res.status(200).json({
        success: true,
        data: { genres },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/genres
   * Admin only: Create a new genre.
   */
  async createGenre(req, res, next) {
    try {
      const genre = await genreService.createGenre(req.body);
      res.status(201).json({
        success: true,
        message: 'Genre created successfully',
        data: { genre },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/genres/:id
   * Admin only: Update existing genre name.
   */
  async updateGenre(req, res, next) {
    try {
      const { id } = req.params;
      const genre = await genreService.updateGenre(id, req.body);
      res.status(200).json({
        success: true,
        message: 'Genre updated successfully',
        data: { genre },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/genres/:id
   * Admin only: Delete genre if not associated with movies.
   */
  async deleteGenre(req, res, next) {
    try {
      const { id } = req.params;
      const result = await genreService.deleteGenre(id);
      res.status(200).json({
        success: true,
        message: `Genre '${result.name}' deleted successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new GenreController();

