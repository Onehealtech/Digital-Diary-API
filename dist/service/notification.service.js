"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const Notification_1 = require("../models/Notification");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const sequelize_1 = require("sequelize");
const fcm_service_1 = require("./fcm.service");
const notification_repository_1 = require("../repositories/notification.repository");
class NotificationService {
    /**
     * Get all notifications for a user
     * Returns notifications + unread count
     */
    async getAllNotifications(userId, recipientType, filters = {}) {
        const { page = 1, limit = 20, type, read, severity, } = filters;
        const offset = (page - 1) * limit;
        const whereClause = {
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
        const { rows: notifications, count: total } = await Notification_1.Notification.findAndCountAll({
            where: whereClause,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        // Get unread count
        const unreadCount = await Notification_1.Notification.count({
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
    async getNotificationById(notificationId, userId) {
        const notification = await Notification_1.Notification.findOne({
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
    async createNotification(data) {
        // Verify recipient exists and get FCM token
        let fcmToken = null;
        if (data.recipientType === "patient") {
            const patient = await Patient_1.Patient.findByPk(data.recipientId);
            if (!patient) {
                throw new Error("Patient not found");
            }
            fcmToken = patient.fcmToken || null;
        }
        else {
            const staff = await Appuser_1.AppUser.findByPk(data.recipientId);
            if (!staff) {
                throw new Error("Staff member not found");
            }
            fcmToken = staff.fcmToken || null;
        }
        const notification = await Notification_1.Notification.create({
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
            fcm_service_1.fcmService.sendPushNotification(fcmToken, data.title, data.message, {
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
    async createBulkNotifications(data) {
        const filters = data.filters || {};
        // Build patient query based on filters
        const whereClause = {};
        if (filters.diaryType) {
            // Map frontend format (e.g. "peri-operative") → DB enum (e.g. "PERI_OPERATIVE")
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
        // Get all matching patients (include fcmToken for push)
        const patients = await Patient_1.Patient.findAll({
            where: whereClause,
            attributes: ["id", "fullName", "fcmToken"],
        });
        if (patients.length === 0) {
            throw new Error("No patients found matching the filters");
        }
        // Create notifications for all patients
        const notifications = await Promise.all(patients.map((patient) => Notification_1.Notification.create({
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
        })));
        // Send FCM push to all patients with tokens
        const fcmTokens = patients
            .map((p) => p.fcmToken)
            .filter((token) => !!token);
        if (fcmTokens.length > 0) {
            fcm_service_1.fcmService.sendMulticastPush(fcmTokens, data.title, data.message, {
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
    async markAsRead(notificationId, userId) {
        const notification = await Notification_1.Notification.findOne({
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
    async markBulkAsRead(notificationIds, userId) {
        const updated = await Notification_1.Notification.update({
            read: true,
            readAt: new Date(),
        }, {
            where: {
                id: {
                    [sequelize_1.Op.in]: notificationIds,
                },
                recipientId: userId,
            },
        });
        return {
            message: `${updated[0]} notifications marked as read`,
            count: updated[0],
        };
    }
    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId, recipientType) {
        const updated = await Notification_1.Notification.update({
            read: true,
            readAt: new Date(),
        }, {
            where: {
                recipientId: userId,
                recipientType,
                read: false,
            },
        });
        return {
            message: `${updated[0]} notifications marked as read`,
            count: updated[0],
        };
    }
    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        const notification = await Notification_1.Notification.findOne({
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
    async getNotificationStats(userId, recipientType) {
        const total = await Notification_1.Notification.count({
            where: {
                recipientId: userId,
                recipientType,
            },
        });
        const unread = await Notification_1.Notification.count({
            where: {
                recipientId: userId,
                recipientType,
                read: false,
            },
        });
        const bySeverity = await Notification_1.Notification.findAll({
            where: {
                recipientId: userId,
                recipientType,
                read: false,
            },
            attributes: [
                "severity",
                [Notification_1.Notification.sequelize.fn("COUNT", "*"), "count"],
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
    async getPatientNotificationHistory(patientId, filters = {}) {
        const { rows: notifications, count: total } = await notification_repository_1.notificationRepository.findByPatientId(patientId, filters);
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
}
exports.notificationService = new NotificationService();
