"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const Notification_1 = require("../models/Notification");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const sequelize_1 = require("sequelize");
const fcm_service_1 = require("./fcm.service");
const notification_repository_1 = require("../repositories/notification.repository");
const twilioService_1 = require("./twilioService");
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
     * Create single notification
     * Used by Doctor/Assistant to send to individual patient or staff
     */
    async createNotification(data) {
        // Verify recipient exists and get FCM token
        let fcmToken = null;
        let patientName = "";
        if (data.recipientType === "patient") {
            const patient = await Patient_1.Patient.findByPk(data.recipientId);
            if (!patient) {
                throw new Error("Patient not found");
            }
            fcmToken = patient.fcmToken || null;
            patientName = patient.fullName || "";
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
        // Send Twilio SMS if it's a patient and they have a phone number
        if (data.recipientType === "patient") {
            const patient = await Patient_1.Patient.findByPk(data.recipientId);
            if (patient && patient.phone) {
                // Strip out the long body or just send title + short body
                const smsContent = `OneHeal Alert: ${data.title}\n${finalMessage}`;
                twilioService_1.twilioService.sendSMS(patient.phone, smsContent).catch((err) => console.error("Twilio SMS err:", err));
            }
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
        // Get all matching patients (include fcmToken and fullName for greeting)
        const patients = await Patient_1.Patient.findAll({
            where: whereClause,
            attributes: ["id", "fullName", "fcmToken"],
        });
        if (patients.length === 0) {
            throw new Error("No patients found matching the filters");
        }
        // Create notifications for all patients with personalized greeting
        const notifications = await Promise.all(patients.map(async (patient) => {
            let finalMessage = data.message;
            const patientName = patient.fullName || "";
            if (patientName) {
                const greeting = await this.buildGreeting(data.senderId, patientName, data.language || "en");
                if (greeting) {
                    finalMessage = `${greeting}\n\n${data.message}`;
                }
            }
            return Notification_1.Notification.create({
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
        }));
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
        // Send Twilio SMS to all patients with phone numbers
        const patientsWithPhones = await Patient_1.Patient.findAll({
            where: whereClause,
            attributes: ["id", "fullName", "phone"]
        });
        patientsWithPhones.forEach(async (patient) => {
            if (patient.phone) {
                let finalMessage = data.message;
                const patientName = patient.fullName || "";
                if (patientName) {
                    const greeting = await this.buildGreeting(data.senderId, patientName, data.language || "en");
                    if (greeting) {
                        finalMessage = `${greeting}\n\n${data.message}`;
                    }
                }
                const smsContent = `OneHeal Alert: ${data.title}\n${finalMessage}`;
                twilioService_1.twilioService.sendSMS(patient.phone, smsContent).catch((err) => console.error("Twilio SMS bulk err:", err));
            }
        });
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
        // Save responsez
        notification.responseMessage = message;
        notification.respondedAt = new Date();
        notification.responseId = patientId; // ✅ correct field
        notification.isResponded = true;
        await notification.save();
        const responseText = `Patient ${patient.fullName} responded: ${message}`;
        // In-app notification
        await this.createNotification({
            senderId: patientId,
            recipientId: notification.senderId,
            recipientType: "staff",
            type: "info",
            severity: "low",
            title: "Patient Response",
            message: responseText,
        });
        // Send SMS
        if (staff.phone) {
            twilioService_1.twilioService
                .sendSMS(staff.phone, `OneHeal Alert: ${responseText}`)
                .catch((err) => console.error("Twilio SMS error:", err));
        }
        return {
            message: "Response sent successfully",
        };
    }
}
exports.notificationService = new NotificationService();
