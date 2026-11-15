import { TicketService } from '../services/ticket.service.js';

class TicketController {
  /**
   * GET /api/tickets
   * Customer: List authenticated user's tickets
   */
  async getCustomerTickets(req, res, next) {
    try {
      const result = await TicketService.getCustomerTickets(req.user.id, req.query);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tickets/:id
   * Customer/Staff/Admin: Retrieve ticket details with QR code payload
   */
  async getTicketById(req, res, next) {
    try {
      const { id } = req.params;
      const ticket = await TicketService.getTicketById(req.user.id, req.user.role, id);
      res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tickets/:id/qr
   * Customer: Retrieve high-resolution QR verification code
   */
  async getTicketQr(req, res, next) {
    try {
      const { id } = req.params;
      const qrData = await TicketService.getTicketQr(req.user.id, req.user.role, id);
      res.status(200).json({
        success: true,
        data: qrData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tickets/:id/status
   * Customer: Retrieve live verification status
   */
  async getTicketStatus(req, res, next) {
    try {
      const { id } = req.params;
      const statusData = await TicketService.getTicketStatus(req.user.id, req.user.role, id);
      res.status(200).json({
        success: true,
        data: statusData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/tickets/validate
   * Staff/Admin: Atomic entrance validation of ticket QR token
   */
  async validateTicket(req, res, next) {
    try {
      const { qrToken } = req.body;
      const result = await TicketService.validateTicket(req.user, qrToken);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const ticketController = new TicketController();
