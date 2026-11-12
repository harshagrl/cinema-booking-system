import { TheatreService } from '../services/theatre.service.js';

class TheatreController {
  /**
   * GET /api/theatres
   * Public: List theatres (filtered by city/search; customers see only active)
   */
  async getTheatres(req, res, next) {
    try {
      const theatres = await TheatreService.getAllTheatres(req.query, req.user);
      res.status(200).json({
        success: true,
        data: { theatres },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/theatres/:id
   * Public: Get theatre details with screens
   */
  async getTheatreById(req, res, next) {
    try {
      const { id } = req.params;
      const theatre = await TheatreService.getTheatreById(id, req.user);
      res.status(200).json({
        success: true,
        data: { theatre },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/theatres
   * Admin only: Create a theatre
   */
  async createTheatre(req, res, next) {
    try {
      const theatre = await TheatreService.createTheatre(req.body);
      res.status(201).json({
        success: true,
        message: 'Theatre created successfully',
        data: { theatre },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/theatres/:id
   * Admin only: Update theatre details
   */
  async updateTheatre(req, res, next) {
    try {
      const { id } = req.params;
      const theatre = await TheatreService.updateTheatre(id, req.body);
      res.status(200).json({
        success: true,
        message: 'Theatre updated successfully',
        data: { theatre },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/theatres/:id/status
   * Admin only: Toggle theatre active status
   */
  async updateTheatreStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const theatre = await TheatreService.updateTheatreStatus(id, isActive);
      res.status(200).json({
        success: true,
        message: `Theatre ${theatre.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { theatre },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new TheatreController();

