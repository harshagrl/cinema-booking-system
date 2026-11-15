import { ShowService } from '../services/show.service.js';

class ShowController {
  /**
   * GET /api/shows
   * Public: List shows with filters
   */
  async getShows(req, res, next) {
    try {
      const shows = await ShowService.getShows(req.query, req.user);
      res.status(200).json({
        success: true,
        data: { shows },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/shows/:id
   * Public: Retrieve show details by ID
   */
  async getShowById(req, res, next) {
    try {
      const { id } = req.params;
      const show = await ShowService.getShowById(id, req.user);
      res.status(200).json({
        success: true,
        data: { show },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/movies/:movieId/shows
   * Public: Customer discovery of shows for a movie grouped by theatre
   */
  async getMovieShows(req, res, next) {
    try {
      const { movieId } = req.params;
      const result = await ShowService.getMovieShows(movieId, req.query);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/theatres/:theatreId/shows
   * Public: Customer discovery of shows at a theatre grouped by movie
   */
  async getTheatreShows(req, res, next) {
    try {
      const { theatreId } = req.params;
      const result = await ShowService.getTheatreShows(theatreId, req.query);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/shows
   * Admin only: Schedule a new show
   */
  async createShow(req, res, next) {
    try {
      const show = await ShowService.createShow(req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Show scheduled successfully',
        data: { show },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/shows/:id
   * Admin only: Update show details and pricing
   */
  async updateShow(req, res, next) {
    try {
      const { id } = req.params;
      const show = await ShowService.updateShow(id, req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Show updated successfully',
        data: { show },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/shows/:id/status
   * Admin only: Soft toggle show active status
   */
  async updateShowStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const show = await ShowService.updateShowStatus(id, isActive, req.user);
      res.status(200).json({
        success: true,
        message: `Show ${show.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { show },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ShowController();
