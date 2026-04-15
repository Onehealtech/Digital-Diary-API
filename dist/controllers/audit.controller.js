"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditController = void 0;
const audit_service_1 = require("../service/audit.service");
const response_1 = require("../utils/response");
class AuditController {
    /**
     * GET /api/v1/audit-logs
     * Get all audit logs with filters (Super Admin only)
     */
    async getAllAuditLogs(req, res) {
        try {
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can view audit logs", 403);
            }
            const { page, limit, userRole, action, startDate, endDate, userId, } = req.query;
            const result = await audit_service_1.auditService.getAllAuditLogs({
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                userRole: userRole,
                action: action,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                userId: userId,
            });
            return (0, response_1.sendResponse)(res, result, "Audit logs fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/audit-logs/user/:userId
     * Get audit logs for a specific user (Super Admin only)
     */
    async getUserAuditLogs(req, res) {
        try {
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can view user audit logs", 403);
            }
            const userId = req.params.userId;
            const { page, limit } = req.query;
            const result = await audit_service_1.auditService.getUserAuditLogs(userId, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
            return (0, response_1.sendResponse)(res, result, "User audit logs fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/audit-logs/stats
     * Get audit log statistics (Super Admin only)
     */
    async getAuditStats(req, res) {
        try {
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can view audit statistics", 403);
            }
            const { startDate, endDate } = req.query;
            const stats = await audit_service_1.auditService.getAuditStats(startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            return (0, response_1.sendResponse)(res, stats, "Audit statistics fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/audit-logs/search
     * Search audit logs (Super Admin only)
     */
    async searchAuditLogs(req, res) {
        try {
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can search audit logs", 403);
            }
            const { q, page, limit } = req.query;
            if (!q) {
                return (0, response_1.sendError)(res, "Search query (q) is required", 400);
            }
            const result = await audit_service_1.auditService.searchAuditLogs(q, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
            return (0, response_1.sendResponse)(res, result, "Audit logs search completed");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
}
exports.auditController = new AuditController();
