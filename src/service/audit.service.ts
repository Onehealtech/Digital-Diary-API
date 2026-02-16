import { AuditLog } from "../models/AuditLog";
import { AppUser } from "../models/Appuser";
import { Op } from "sequelize";

interface AuditLogFilters {
  page?: number;
  limit?: number;
  userRole?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
}

interface CreateAuditLogData {
  userId: string;
  userRole: "super_admin" | "doctor" | "vendor" | "assistant" | "patient";
  action: string;
  details: object;
  ipAddress: string;
  userAgent?: string;
}

class AuditService {
  /**
   * Create audit log entry
   */
  async createAuditLog(data: CreateAuditLogData) {
    const auditLog = await AuditLog.create({
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
  async getAllAuditLogs(filters: AuditLogFilters = {}) {
    const {
      page = 1,
      limit = 50,
      userRole,
      action,
      startDate,
      endDate,
      userId,
    } = filters;

    const offset = (page - 1) * limit;

    const whereClause: any = {};

    if (userRole) {
      whereClause.userRole = userRole;
    }

    if (action) {
      whereClause.action = { [Op.iLike]: `%${action}%` };
    }

    if (userId) {
      whereClause.userId = userId;
    }

    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) {
        whereClause.timestamp[Op.gte] = startDate;
      }
      if (endDate) {
        whereClause.timestamp[Op.lte] = endDate;
      }
    }

    const { rows: logs, count: total } = await AuditLog.findAndCountAll({
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
  async getUserAuditLogs(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const { rows: logs, count: total } = await AuditLog.findAndCountAll({
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
  async getAuditStats(startDate?: Date, endDate?: Date) {
    const whereClause: any = {};

    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) {
        whereClause.timestamp[Op.gte] = startDate;
      }
      if (endDate) {
        whereClause.timestamp[Op.lte] = endDate;
      }
    }

    const total = await AuditLog.count({ where: whereClause });

    // Logs by user role
    const byUserRole = await AuditLog.findAll({
      where: whereClause,
      attributes: [
        "userRole",
        [AuditLog.sequelize!.fn("COUNT", "*"), "count"],
      ],
      group: ["userRole"],
      raw: true,
    });

    // Top actions
    const topActions = await AuditLog.findAll({
      where: whereClause,
      attributes: [
        "action",
        [AuditLog.sequelize!.fn("COUNT", "*"), "count"],
      ],
      group: ["action"],
      order: [[AuditLog.sequelize!.literal("count"), "DESC"]],
      limit: 10,
      raw: true,
    });

    // Activity timeline (logs per day for last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await AuditLog.findAll({
      where: {
        timestamp: { [Op.gte]: thirtyDaysAgo },
      },
      attributes: [
        [AuditLog.sequelize!.fn("DATE", AuditLog.sequelize!.col("timestamp")), "date"],
        [AuditLog.sequelize!.fn("COUNT", "*"), "count"],
      ],
      group: [AuditLog.sequelize!.fn("DATE", AuditLog.sequelize!.col("timestamp"))],
      order: [[AuditLog.sequelize!.fn("DATE", AuditLog.sequelize!.col("timestamp")), "ASC"]],
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
  async searchAuditLogs(searchTerm: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const { rows: logs, count: total } = await AuditLog.findAndCountAll({
      where: {
        [Op.or]: [
          { action: { [Op.iLike]: `%${searchTerm}%` } },
          { userId: { [Op.iLike]: `%${searchTerm}%` } },
          { ipAddress: { [Op.iLike]: `%${searchTerm}%` } },
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

export const auditService = new AuditService();
