import { HoldService } from '../services/hold.service.js';

class HoldController {
  /**
   * GET /api/shows/:showId/seats
   * Public / Authenticated: Retrieve seat layout and real-time availability
   */
  async getShowSeatLayout(req, res, next) {
    try {
      const { showId } = req.params;
      const layout = await HoldService.getShowSeatLayout(showId, req.user);
      res.status(200).json({
        success: true,
        data: layout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/shows/:showId/holds
   * Customer: Concurrently safe temporary seat hold
   */
  async createHold(req, res, next) {
    try {
      const { showId } = req.params;
      const { showSeatIds } = req.body;
      const hold = await HoldService.createHold(showId, showSeatIds, req.user);
      res.status(201).json({
        success: true,
        message: 'Seats held successfully for 5 minutes',
        data: hold,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/holds/current
   * Customer: Retrieve active hold for logged-in user
   */
  async getCurrentUserHold(req, res, next) {
    try {
      const result = await HoldService.getCurrentUserHold(req.user.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/holds/:holdId
   * Customer: Release active hold
   */
  async releaseHold(req, res, next) {
    try {
      const { holdId } = req.params;
      const result = await HoldService.releaseHold(holdId, req.user);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new HoldController();
