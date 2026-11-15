import { AuditService } from '../services/audit.service.js';

class AuditController {
  async getAuditLogs(req, res, next) {
    try {
      const result = await AuditService.getAuditLogs(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
