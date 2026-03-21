"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const Notification_1 = require("../models/Notification");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const sequelize_1 = require("sequelize");
const fcm_service_1 = require("./fcm.service");
const notification_repository_1 = require("../repositories/notification.repository");
const twilio_service_1 = require("./twilio.service");
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
     * Build personalized greeting based on sender role and language
     */
    async buildGreeting(senderId, patientName, language = "en") {
        const sender = await Appuser_1.AppUser.findByPk(senderId, {
            attributes: ["id", "fullName", "role", "parentId"],
        });
        if (!sender)
            return "";
        let greeting = "";
        if (sender.role === "ASSISTANT") {
            // Look up parent doctor name
            let doctorName = "your Doctor";
            if (sender.parentId) {
                const doctor = await Appuser_1.AppUser.findByPk(sender.parentId, {
                    attributes: ["id", "fullName"],
                });
                if (doctor?.fullName)
                    doctorName = `Dr. ${doctor.fullName}`;
            }
            greeting = `Hello ${patientName}, this is ${sender.fullName}, assistant to ${doctorName}.`;
        }
        else {
            greeting = `Hello ${patientName}, this is Dr. ${sender.fullName}.`;
        }
        // Translate greeting to Hindi if needed
        if (language === "hi") {
            try {
                const { default: translate } = await Function('return import("google-translate-api-x")')();
                const result = await translate(greeting, { to: "hi" });
                greeting = result.text;
            }
            catch (err) {
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
    async createNotification(data) {
        // Verify recipient exists and get FCM token
        let fcmToken = null;
        let patientName = "";
        let patientPhone = null;
        if (data.recipientType === "patient") {
            const patient = await Patient_1.Patient.findByPk(data.recipientId);
            if (!patient) {
                throw new Error("Patient not found");
            }
            fcmToken = patient.fcmToken || null;
            patientName = patient.fullName || "";
            patientPhone = patient.phone || null;
        }
        else {
            const staff = await Appuser_1.AppUser.findByPk(data.recipientId);
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
        const notification = await Notification_1.Notification.create({
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
            fcm_service_1.fcmService.sendPushNotification(fcmToken, data.title, finalMessage, {
                notificationId: notification.id,
                type: data.type,
                severity: data.severity || "low",
            }).catch((err) => console.error("FCM push error:", err));
        }
        // Send SMS individually to the patient via Twilio
        if (data.recipientType === "patient" && patientPhone) {
            const smsContent = `OneHeal Alert: ${data.title}\n${finalMessage}`;
            twilio_service_1.twilioService.sendSMS(patientPhone, smsContent).catch((err) => console.error(`SMS error for patient ${data.recipientId}:`, err));
        }
        return notification;
    }
    /**
     * Create bulk notifications — sends per-patient individually.
     * Each patient gets their own notification record, personalized greeting,
     * individual FCM push, and individual SMS. No broadcast/bulk blast.
     */
    async createBulkNotifications(data) {
        const filters = data.filters || {};
        // Build patient query based on filters
        const whereClause = {};
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
        const patients = await Patient_1.Patient.findAll({
            where: whereClause,
            attributes: ["id", "fullName", "fcmToken", "phone"],
        });
        if (patients.length === 0) {
            throw new Error("No patients found matching the filters");
        }
        // Process each patient individually — personalized greeting, notification, FCM, SMS
        const notifications = [];
        const errors = [];
        for (const patient of patients) {
            try {
                // Build personalized greeting for this specific patient
                let finalMessage = data.message;
                const patientName = patient.fullName || "";
                if (patientName) {
                    const greeting = await this.buildGreeting(data.senderId, patientName, data.language || "en");
                    if (greeting) {
                        finalMessage = `${greeting}\n\n${data.message}`;
                    }
                }
                // Create individual notification record
                const notification = await Notification_1.Notification.create({
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
                    fcm_service_1.fcmService.sendPushNotification(patient.fcmToken, data.title, finalMessage, {
                        notificationId: notification.id,
                        type: data.type,
                        severity: data.severity || "low",
                    }).catch((err) => console.error(`FCM push error for patient ${patient.id}:`, err));
                }
                // Send individual SMS via Twilio
                if (patient.phone) {
                    const smsContent = `OneHeal Alert: ${data.title}\n${finalMessage}`;
                    twilio_service_1.twilioService.sendSMS(patient.phone, smsContent).catch((err) => console.error(`SMS error for patient ${patient.id}:`, err));
                }
            }
            catch (err) {
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
    /**
     * Patient responds to a notification.
     * Sends response back to the staff member individually.
     */
    async respondToNotification(notificationId, patientId, message) {
        const notification = await Notification_1.Notification.findOne({
            where: {
                id: notificationId,
                recipientId: patientId,
                recipientType: "patient",
            },
        });
        if (!notification) {
            throw new Error("Notification not found");
        }
        const patient = await Patient_1.Patient.findByPk(patientId);
        if (!patient) {
            throw new Error("Patient not found");
        }
        const staff = await Appuser_1.AppUser.findByPk(notification.senderId);
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
            senderId: patientId,
            recipientId: notification.senderId,
            recipientType: "staff",
            type: "info",
            severity: "low",
            title: "Patient Response",
            message: responseText,
        });
        // Send SMS to the specific staff member via Twilio
        if (staff.phone) {
            twilio_service_1.twilioService
                .sendSMS(staff.phone, `OneHeal Alert: ${responseText}`)
                .catch((err) => console.error("SMS error:", err));
        }
        return {
            message: "Response sent successfully",
        };
    }
}
exports.notificationService = new NotificationService();
