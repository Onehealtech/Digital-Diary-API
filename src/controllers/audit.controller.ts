import { Response } from "express";
import { auditService } from "../service/audit.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";

class AuditController {
  /**
   * GET /api/v1/audit-logs
   * Get all audit logs with filters (Super Admin only)
   */
  async getAllAuditLogs(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can view audit logs", 403);
      }

      const {
        page,
        limit,
        userRole,
        action,
        startDate,
        endDate,
        userId,
      } = req.query;

      const result = await auditService.getAllAuditLogs({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        userRole: userRole as string,
        action: action as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId: userId as string,
      });

      return sendResponse(res, result, "Audit logs fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/audit-logs/user/:userId
   * Get audit logs for a specific user (Super Admin only)
   */
  async getUserAuditLogs(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can view user audit logs", 403);
      }

      const userId = req.params.userId as string;
      const { page, limit } = req.query;

      const result = await auditService.getUserAuditLogs(
        userId,
        page ? Number(page) : undefined,
        limit ? Number(limit) : undefined
      );

      return sendResponse(res, result, "User audit logs fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/audit-logs/stats
   * Get audit log statistics (Super Admin only)
   */
  async getAuditStats(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can view audit statistics", 403);
      }

      const { startDate, endDate } = req.query;

      const stats = await auditService.getAuditStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      return sendResponse(res, stats, "Audit statistics fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/audit-logs/search
   * Search audit logs (Super Admin only)
   */
  async searchAuditLogs(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can search audit logs", 403);
      }

      const { q, page, limit } = req.query;

      if (!q) {
        return sendError(res, "Search query (q) is required", 400);
      }

      const result = await auditService.searchAuditLogs(
        q as string,
        page ? Number(page) : undefined,
        limit ? Number(limit) : undefined
      );

      return sendResponse(res, result, "Audit logs search completed");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }
}

export const auditController = new AuditController();
