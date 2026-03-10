"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = void 0;
const AuditLog_1 = require("../models/AuditLog");
const sequelize_1 = require("sequelize");
class AuditService {
    /**
     * Create audit log entry
     */
    async createAuditLog(data) {
        const auditLog = await AuditLog_1.AuditLog.create({
            userId: data.userId,
            userRole: data.userRole,
            action: data.action,
            details: data.details,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            timestamp: new Date(),
        });
        return auditLog;
    }
    /**
     * Get all audit logs with filters
     */
    async getAllAuditLogs(filters = {}) {
        const { page = 1, limit = 50, userRole, action, startDate, endDate, userId, } = filters;
        const offset = (page - 1) * limit;
        const whereClause = {};
        if (userRole) {
            whereClause.userRole = userRole;
        }
        if (action) {
            whereClause.action = { [sequelize_1.Op.iLike]: `%${action}%` };
        }
        if (userId) {
            whereClause.userId = userId;
        }
        if (startDate || endDate) {
            whereClause.timestamp = {};
            if (startDate) {
                whereClause.timestamp[sequelize_1.Op.gte] = startDate;
            }
            if (endDate) {
                whereClause.timestamp[sequelize_1.Op.lte] = endDate;
            }
        }
        const { rows: logs, count: total } = await AuditLog_1.AuditLog.findAndCountAll({
            where: whereClause,
            order: [["timestamp", "DESC"]],
            limit,
            offset,
        });
        return {
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get audit logs for a specific user
     */
    async getUserAuditLogs(userId, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { rows: logs, count: total } = await AuditLog_1.AuditLog.findAndCountAll({
            where: { userId },
            order: [["timestamp", "DESC"]],
            limit,
            offset,
        });
        return {
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get audit log statistics
     */
    async getAuditStats(startDate, endDate) {
        const whereClause = {};
        if (startDate || endDate) {
            whereClause.timestamp = {};
            if (startDate) {
                whereClause.timestamp[sequelize_1.Op.gte] = startDate;
            }
            if (endDate) {
                whereClause.timestamp[sequelize_1.Op.lte] = endDate;
            }
        }
        const total = await AuditLog_1.AuditLog.count({ where: whereClause });
        // Logs by user role
        const byUserRole = await AuditLog_1.AuditLog.findAll({
            where: whereClause,
            attributes: [
                "userRole",
                [AuditLog_1.AuditLog.sequelize.fn("COUNT", "*"), "count"],
            ],
            group: ["userRole"],
            raw: true,
        });
        // Top actions
        const topActions = await AuditLog_1.AuditLog.findAll({
            where: whereClause,
            attributes: [
                "action",
                [AuditLog_1.AuditLog.sequelize.fn("COUNT", "*"), "count"],
            ],
            group: ["action"],
            order: [[AuditLog_1.AuditLog.sequelize.literal("count"), "DESC"]],
            limit: 10,
            raw: true,
        });
        // Activity timeline (logs per day for last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentActivity = await AuditLog_1.AuditLog.findAll({
            where: {
                timestamp: { [sequelize_1.Op.gte]: thirtyDaysAgo },
            },
            attributes: [
                [AuditLog_1.AuditLog.sequelize.fn("DATE", AuditLog_1.AuditLog.sequelize.col("timestamp")), "date"],
                [AuditLog_1.AuditLog.sequelize.fn("COUNT", "*"), "count"],
            ],
            group: [AuditLog_1.AuditLog.sequelize.fn("DATE", AuditLog_1.AuditLog.sequelize.col("timestamp"))],
            order: [[AuditLog_1.AuditLog.sequelize.fn("DATE", AuditLog_1.AuditLog.sequelize.col("timestamp")), "ASC"]],
            raw: true,
        });
        return {
            total,
            byUserRole,
            topActions,
            recentActivity,
        };
    }
    /**
     * Search audit logs
     */
    async searchAuditLogs(searchTerm, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { rows: logs, count: total } = await AuditLog_1.AuditLog.findAndCountAll({
            where: {
                [sequelize_1.Op.or]: [
                    { action: { [sequelize_1.Op.iLike]: `%${searchTerm}%` } },
                    { userId: { [sequelize_1.Op.iLike]: `%${searchTerm}%` } },
                    { ipAddress: { [sequelize_1.Op.iLike]: `%${searchTerm}%` } },
                ],
            },
            order: [["timestamp", "DESC"]],
            limit,
            offset,
        });
        return {
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
exports.auditService = new AuditService();
