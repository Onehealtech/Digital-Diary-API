import { Notification } from "../models/Notification";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { Op } from "sequelize";
import { fcmService } from "./fcm.service";
import { notificationRepository } from "../repositories/notification.repository";
import { twilioService } from "./twilio.service";

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
  language?: "en" | "hi";
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
  language?: "en" | "hi";
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
   * Build personalized greeting based on sender role and language
   */
  private async buildGreeting(
    senderId: string,
    patientName: string,
    language: "en" | "hi" = "en"
  ): Promise<string> {
    const sender = await AppUser.findByPk(senderId, {
      attributes: ["id", "fullName", "role", "parentId"],
    });

    if (!sender) return "";

    let greeting = "";
    if (sender.role === "ASSISTANT") {
      // Look up parent doctor name
      let doctorName = "your Doctor";
      if (sender.parentId) {
        const doctor = await AppUser.findByPk(sender.parentId, {
          attributes: ["id", "fullName"],
        });
        if (doctor?.fullName) doctorName = `Dr. ${doctor.fullName}`;
      }
      greeting = `Hello ${patientName}, this is ${sender.fullName}, assistant to ${doctorName}.`;
    } else {
      greeting = `Hello ${patientName}, this is Dr. ${sender.fullName}.`;
    }

    // Translate greeting to Hindi if needed
    if (language === "hi") {
      try {
        const { default: translate } = await (Function('return import("google-translate-api-x")')() as Promise<any>);
        const result = await translate(greeting, { to: "hi" });
        greeting = result.text;
      } catch (err) {
        console.error("Greeting translation error:", err);
        // Fall back to English greeting
      }
    }

    return greeting;
  }

  /**
   * Create single notification for an individual patient or staff member.
   * Sends in-app notification + FCM push + SMS (for patients) individually.
   */
  async createNotification(data: CreateNotificationData) {
    // Verify recipient exists and get FCM token
    let fcmToken: string | null = null;
    let patientName = "";
    let patientPhone: string | null = null;

    if (data.recipientType === "patient") {
      const patient = await Patient.findByPk(data.recipientId);
      if (!patient) {
        throw new Error("Patient not found");
      }
      fcmToken = patient.fcmToken || null;
      patientName = patient.fullName || "";
      patientPhone = patient.phone || null;
      // Auto-use patient's language preference if not explicitly set
      if (!data.language) {
        data.language = (patient.language as "en" | "hi") || "en";
      }
    } else {
      const staff = await AppUser.findByPk(data.recipientId);
      if (!staff) {
        throw new Error("Staff member not found");
      }
      fcmToken = staff.fcmToken || null;
    }

    // Build personalized greeting and prepend to message
    let finalMessage = data.message;
    if (data.recipientType === "patient" && patientName) {
      const greeting = await this.buildGreeting(data.senderId, patientName, data.language || "en");
      if (greeting) {
        finalMessage = `${greeting}\n\n${data.message}`;
      }
    }

    const notification = await Notification.create({
      senderId: data.senderId,
      recipientId: data.recipientId,
      recipientType: data.recipientType,
      type: data.type,
      severity: data.severity || "low",
      title: data.title,
      message: finalMessage,
      relatedTaskId: data.relatedTaskId,
      relatedTestName: data.relatedTestName,
      actionUrl: data.actionUrl,
      deliveryMethod: data.deliveryMethod || "in-app",
      delivered: true,
    });

    // Send FCM push notification if token exists
    if (fcmToken) {
      fcmService.sendPushNotification(fcmToken, data.title, finalMessage, {
        notificationId: notification.id,
        type: data.type,
        severity: data.severity || "low",
      }).catch((err) => console.error("FCM push error:", err));
    }

    // Send SMS individually to the patient via Twilio
    if (data.recipientType === "patient" && patientPhone) {
      const smsContent = `OneHeal Alert: ${data.title}\n${finalMessage}`;
      twilioService.sendSMS(patientPhone, smsContent).catch((err) =>
        console.error(`SMS error for patient ${data.recipientId}:`, err)
      );
    }

    return notification;
  }

  /**
   * Create bulk notifications — sends per-patient individually.
   * Each patient gets their own notification record, personalized greeting,
   * individual FCM push, and individual SMS. No broadcast/bulk blast.
   */
  async createBulkNotifications(data: BulkNotificationData) {
    const filters = data.filters || {};

    // Build patient query based on filters
    const whereClause: any = {};

    if (filters.diaryType) {
      whereClause.caseType = filters.diaryType.toUpperCase().replace(/-/g, "_");
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

    // Get all matching patients with all needed attributes in a single query
    const patients = await Patient.findAll({
      where: whereClause,
      attributes: ["id", "fullName", "fcmToken", "phone", "language"],
    });

    if (patients.length === 0) {
      throw new Error("No patients found matching the filters");
    }

    // Process each patient individually — personalized greeting, notification, FCM, SMS
    const notifications = [];
    const errors: { patientId: string; error: string }[] = [];

    for (const patient of patients) {
      try {
        // Build personalized greeting for this specific patient
        let finalMessage = data.message;
        const patientName = patient.fullName || "";
        const patientLang = ((patient as any).language || data.language || "en") as "en" | "hi";
        if (patientName) {
          const greeting = await this.buildGreeting(data.senderId, patientName, patientLang);
          if (greeting) {
            finalMessage = `${greeting}\n\n${data.message}`;
          }
        }

        // Create individual notification record
        const notification = await Notification.create({
          senderId: data.senderId,
          recipientId: patient.id,
          recipientType: "patient",
          type: data.type,
          severity: data.severity || "low",
          title: data.title,
          message: finalMessage,
          actionUrl: data.actionUrl,
          deliveryMethod: data.deliveryMethod || "in-app",
          delivered: true,
        });

        notifications.push(notification);

        // Send individual FCM push notification
        if (patient.fcmToken) {
          fcmService.sendPushNotification(
            patient.fcmToken,
            data.title,
            finalMessage,
            {
              notificationId: notification.id,
              type: data.type,
              severity: data.severity || "low",
            }
          ).catch((err) =>
            console.error(`FCM push error for patient ${patient.id}:`, err)
          );
        }

        // Send individual SMS via Twilio
        if (patient.phone) {
          const smsContent = `OneHeal Alert: ${data.title}\n${finalMessage}`;
          twilioService.sendSMS(patient.phone, smsContent).catch((err) =>
            console.error(`SMS error for patient ${patient.id}:`, err)
          );
        }
      } catch (err: any) {
        console.error(`Failed to create notification for patient ${patient.id}:`, err);
        errors.push({ patientId: patient.id, error: err.message });
      }
    }

    return {
      message: `Notifications sent to ${notifications.length} patients individually`,
      count: notifications.length,
      patientIds: notifications.map((n) => n.recipientId),
      ...(errors.length > 0 && { errors }),
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

  /**
   * Get notification history for a specific patient.
   * Used by Doctor/Assistant to see what notifications were sent to a patient.
   */
  async getPatientNotificationHistory(
    patientId: string,
    filters: { page?: number; limit?: number } = {}
  ) {
    const { rows: notifications, count: total } =
      await notificationRepository.findByPatientId(patientId, filters);

    const { page = 1, limit = 20 } = filters;

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Patient responds to a notification.
   * Sends response back to the staff member individually.
   */
  async respondToNotification(
    notificationId: any,
    patientId: string,
    message: string
  ) {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipientId: patientId,
        recipientType: "patient",
      },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    const patient = await Patient.findByPk(patientId);

    if (!patient) {
      throw new Error("Patient not found");
    }

    const staff = await AppUser.findByPk(notification.senderId);

    if (!staff) {
      throw new Error("Staff not found");
    }

    // Save response
    notification.responseMessage = message;
    notification.respondedAt = new Date();
    notification.responseId = patientId;
    notification.isResponded = true;

    await notification.save();

    const responseText = `Patient ${patient.fullName} responded: ${message}`;

    // In-app notification to the specific staff member
    await this.createNotification({
      senderId: notification.senderId,  // staff member's AppUser ID (valid FK)
      recipientId: notification.senderId,
      recipientType: "staff",
      type: "info",
      severity: "low",
      title: "Patient Response",
      message: responseText,
    });

    // Send SMS to the specific staff member via Twilio
    if (staff.phone) {
      twilioService
        .sendSMS(staff.phone, `OneHeal Alert: ${responseText}`)
        .catch((err: unknown) => console.error("SMS error:", err));
    }

    return {
      message: "Response sent successfully",
    };
  }
}

export const notificationService = new NotificationService();
