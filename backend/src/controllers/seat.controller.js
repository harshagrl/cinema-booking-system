import { SeatService } from '../services/seat.service.js';

class SeatController {
  /**
   * GET /api/screens/:screenId/seats
   * Public: List physical seats for a screen
   */
  async getSeatsByScreen(req, res, next) {
    try {
      const { screenId } = req.params;
      const layout = await SeatService.getSeatsByScreen(screenId, req.user);
      res.status(200).json({
        success: true,
        data: layout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/screens/:screenId/seats
   * Admin only: Bulk configure physical seat layout for a screen
   */
  async bulkConfigureSeats(req, res, next) {
    try {
      const { screenId } = req.params;
      const { seats } = req.body;
      const result = await SeatService.bulkConfigureSeats(screenId, seats);
      res.status(201).json({
        success: true,
        message: 'Seat layout configured successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/screens/:screenId/seats
   * Admin only: Bulk update physical seats
   */
  async bulkUpdateSeats(req, res, next) {
    try {
      const { screenId } = req.params;
      const { seats } = req.body;
      const result = await SeatService.bulkUpdateSeats(screenId, seats);
      res.status(200).json({
        success: true,
        message: 'Seats updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new SeatController();

