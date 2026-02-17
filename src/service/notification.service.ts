import { Notification } from "../models/Notification";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { Op } from "sequelize";
import { fcmService } from "./fcm.service";

interface NotificationFilters {
  page?: number;
  limit?: number;
  type?: string;
  read?: boolean;
  severity?: string;
}

interface CreateNotificationData {
  senderId: string;
  recipientId: string;
  recipientType: "patient" | "staff";
  type: "alert" | "info" | "reminder" | "task-assigned" | "test-result";
  severity?: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  relatedTaskId?: string;
  relatedTestName?: string;
  actionUrl?: string;
  deliveryMethod?: "in-app" | "sms" | "email";
}

interface BulkNotificationData {
  senderId: string;
  type: "alert" | "info" | "reminder" | "test-result";
  severity?: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  actionUrl?: string;
  deliveryMethod?: "in-app" | "sms" | "email";
  filters?: {
    diaryType?: string;
    stage?: string;
    doctorId?: string;
    status?: string;
    allPatients?: boolean;
  };
}

class NotificationService {
  /**
   * Get all notifications for a user
   * Returns notifications + unread count
   */
  async getAllNotifications(
    userId: string,
    recipientType: "patient" | "staff",
    filters: NotificationFilters = {}
  ) {
    const {
      page = 1,
      limit = 20,
      type,
      read,
      severity,
    } = filters;

    const offset = (page - 1) * limit;

    const whereClause: any = {
      recipientId: userId,
      recipientType,
    };

    if (type) {
      whereClause.type = type;
    }

    if (read !== undefined) {
      whereClause.read = read;
    }

    if (severity) {
      whereClause.severity = severity;
    }

    const { rows: notifications, count: total } = await Notification.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Get unread count
    const unreadCount = await Notification.count({
      where: {
        recipientId: userId,
        recipientType,
        read: false,
      },
    });

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(notificationId: string, userId: string) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification;
  }

  /**
   * Create single notification
   * Used by Doctor/Assistant to send to individual patient or staff
   */
  async createNotification(data: CreateNotificationData) {
    // Verify recipient exists and get FCM token
    let fcmToken: string | null = null;

    if (data.recipientType === "patient") {
      const patient = await Patient.findByPk(data.recipientId);
      if (!patient) {
        throw new Error("Patient not found");
      }
      fcmToken = patient.fcmToken || null;
    } else {
      const staff = await AppUser.findByPk(data.recipientId);
      if (!staff) {
        throw new Error("Staff member not found");
      }
      fcmToken = staff.fcmToken || null;
    }

    const notification = await Notification.create({
      senderId: data.senderId,
      recipientId: data.recipientId,
      recipientType: data.recipientType,
      type: data.type,
      severity: data.severity || "low",
      title: data.title,
      message: data.message,
      relatedTaskId: data.relatedTaskId,
      relatedTestName: data.relatedTestName,
      actionUrl: data.actionUrl,
      deliveryMethod: data.deliveryMethod || "in-app",
      delivered: true,
    });

    // Send FCM push notification if token exists
    if (fcmToken) {
      fcmService.sendPushNotification(fcmToken, data.title, data.message, {
        notificationId: notification.id,
        type: data.type,
        severity: data.severity || "low",
      }).catch((err) => console.error("FCM push error:", err));
    }

    return notification;
  }

  /**
   * Create bulk notifications
   * Used by Doctor/Assistant to send to multiple patients
   */
  async createBulkNotifications(data: BulkNotificationData) {
    const filters = data.filters || {};

    // Build patient query based on filters
    const whereClause: any = {};

    if (filters.diaryType) {
      whereClause.diaryType = filters.diaryType;
    }

    if (filters.stage) {
      whereClause.stage = filters.stage;
    }

    if (filters.doctorId) {
      whereClause.doctorId = filters.doctorId;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    // Get all matching patients (include fcmToken for push)
    const patients = await Patient.findAll({
      where: whereClause,
      attributes: ["id", "fullName", "fcmToken"],
    });

    if (patients.length === 0) {
      throw new Error("No patients found matching the filters");
    }

    // Create notifications for all patients
    const notifications = await Promise.all(
      patients.map((patient) =>
        Notification.create({
          senderId: data.senderId,
          recipientId: patient.id,
          recipientType: "patient",
          type: data.type,
          severity: data.severity || "low",
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl,
          deliveryMethod: data.deliveryMethod || "in-app",
          delivered: true,
        })
      )
    );

    // Send FCM push to all patients with tokens
    const fcmTokens = patients
      .map((p) => p.fcmToken)
      .filter((token): token is string => !!token);

    if (fcmTokens.length > 0) {
      fcmService.sendMulticastPush(fcmTokens, data.title, data.message, {
        type: data.type,
        severity: data.severity || "low",
      }).catch((err) => console.error("FCM multicast error:", err));
    }

    return {
      message: `Notifications sent to ${notifications.length} patients`,
      count: notifications.length,
      patientIds: patients.map((p) => p.id),
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.read) {
      return notification; // Already read
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    return notification;
  }

  /**
   * Mark multiple notifications as read
   */
  async markBulkAsRead(notificationIds: string[], userId: string) {
    const updated = await Notification.update(
      {
        read: true,
        readAt: new Date(),
      },
      {
        where: {
          id: {
            [Op.in]: notificationIds,
          },
          recipientId: userId,
        },
      }
    );

    return {
      message: `${updated[0]} notifications marked as read`,
      count: updated[0],
    };
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, recipientType: "patient" | "staff") {
    const updated = await Notification.update(
      {
        read: true,
        readAt: new Date(),
      },
      {
        where: {
          recipientId: userId,
          recipientType,
          read: false,
        },
      }
    );

    return {
      message: `${updated[0]} notifications marked as read`,
      count: updated[0],
    };
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    await notification.destroy();

    return {
      message: "Notification deleted successfully",
    };
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string, recipientType: "patient" | "staff") {
    const total = await Notification.count({
      where: {
        recipientId: userId,
        recipientType,
      },
    });

    const unread = await Notification.count({
      where: {
        recipientId: userId,
        recipientType,
        read: false,
      },
    });

    const bySeverity = await Notification.findAll({
      where: {
        recipientId: userId,
        recipientType,
        read: false,
      },
      attributes: [
        "severity",
        [Notification.sequelize!.fn("COUNT", "*"), "count"],
      ],
      group: ["severity"],
      raw: true,
    });

    return {
      total,
      unread,
      read: total - unread,
      bySeverity,
    };
  }
}

export const notificationService = new NotificationService();
