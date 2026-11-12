import { ScreenService } from '../services/screen.service.js';

class ScreenController {
  /**
   * GET /api/theatres/:theatreId/screens
   * Public: List screens for a theatre
   */
  async getScreensByTheatre(req, res, next) {
    try {
      const { theatreId } = req.params;
      const screens = await ScreenService.getScreensByTheatre(theatreId, req.user);
      res.status(200).json({
        success: true,
        data: { screens },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/screens/:id
   * Public: Get single screen details
   */
  async getScreenById(req, res, next) {
    try {
      const { id } = req.params;
      const screen = await ScreenService.getScreenById(id, req.user);
      res.status(200).json({
        success: true,
        data: { screen },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/theatres/:theatreId/screens
   * Admin only: Create a screen for a theatre
   */
  async createScreen(req, res, next) {
    try {
      const { theatreId } = req.params;
      const screen = await ScreenService.createScreen(theatreId, req.body);
      res.status(201).json({
        success: true,
        message: 'Screen created successfully',
        data: { screen },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/screens/:id
   * Admin only: Update a screen
   */
  async updateScreen(req, res, next) {
    try {
      const { id } = req.params;
      const screen = await ScreenService.updateScreen(id, req.body);
      res.status(200).json({
        success: true,
        message: 'Screen updated successfully',
        data: { screen },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/screens/:id/status
   * Admin only: Toggle screen active status
   */
  async updateScreenStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const screen = await ScreenService.updateScreenStatus(id, isActive);
      res.status(200).json({
        success: true,
        message: `Screen ${screen.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { screen },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ScreenController();

