import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { auditController } from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import {
  showReportQuerySchema,
  revenueReportQuerySchema,
  bookingReportQuerySchema,
  auditLogQuerySchema,
  validateQuery,
} from '../validators/report.validator.js';

const router = Router();

// Protect all admin routes with authentication and strict ADMIN role authorization
router.use(authenticate, requireAdmin);

// Dashboard overview report
router.get('/reports/overview', (req, res, next) =>
  reportController.getOverview(req, res, next)
);

// Show occupancy and scheduling report
router.get(
  '/reports/shows',
  validateQuery(showReportQuerySchema),
  (req, res, next) => reportController.getShows(req, res, next)
);

// Revenue and financial report
router.get(
  '/reports/revenue',
  validateQuery(revenueReportQuerySchema),
  (req, res, next) => reportController.getRevenue(req, res, next)
);

// Booking distribution and recent reservation report
router.get(
  '/reports/bookings',
  validateQuery(bookingReportQuerySchema),
  (req, res, next) => reportController.getBookings(req, res, next)
);

// Audit logging activity trail
router.get(
  '/audit-logs',
  validateQuery(auditLogQuerySchema),
  (req, res, next) => auditController.getAuditLogs(req, res, next)
);

export default router;
