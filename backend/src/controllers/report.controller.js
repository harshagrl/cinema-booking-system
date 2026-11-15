import { ReportService } from '../services/report.service.js';

class ReportController {
  async getOverview(req, res, next) {
    try {
      const data = await ReportService.getOverviewReport();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getShows(req, res, next) {
    try {
      const result = await ReportService.getShowsReport(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRevenue(req, res, next) {
    try {
      const data = await ReportService.getRevenueReport(req.query);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBookings(req, res, next) {
    try {
      const result = await ReportService.getBookingsReport(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        statusDistribution: result.statusDistribution,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
