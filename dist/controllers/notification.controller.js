"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = void 0;
const notification_service_1 = require("../service/notification.service");
const response_1 = require("../utils/response");
const Appuser_1 = require("../models/Appuser");
const notification_schemas_1 = require("../schemas/notification.schemas");
class NotificationController {
    /**
     * GET /api/v1/notifications
     * Get all notifications for the logged-in user
     */
    async getAllNotifications(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            // Determine recipient type based on role
            const recipientType = role === "PATIENT" ? "patient" : "staff";
            const { page = 1, limit = 20, type, read, severity } = req.query;
            const result = await notification_service_1.notificationService.getAllNotifications(userId, recipientType, {
                page: Number(page),
                limit: Number(limit),
                type: type,
                read: read === "true" ? true : read === "false" ? false : undefined,
                severity: severity,
            });
            return (0, response_1.sendResponse)(res, result, "Notifications fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/notifications/stats
     * Get notification statistics for the logged-in user
     */
    async getNotificationStats(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const recipientType = role === "PATIENT" ? "patient" : "staff";
            const stats = await notification_service_1.notificationService.getNotificationStats(userId, recipientType);
            return (0, response_1.sendResponse)(res, stats, "Notification stats fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/notifications/:id
     * Get notification by ID
     */
    async getNotificationById(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const notification = await notification_service_1.notificationService.getNotificationById(id, userId);
            return (0, response_1.sendResponse)(res, notification, "Notification fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * POST /api/v1/notifications
     * Create single notification (Doctor/Assistant to patient)
     */
    async createNotification(req, res) {
        try {
            const senderId = req.user?.id;
            const role = req.user?.role;
            if (!senderId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only doctors and assistants can send notifications", 403);
            }
            const { recipientId, recipientType = "patient", type, severity, title, message, language, relatedTaskId, relatedTestName, actionUrl, deliveryMethod, } = req.body;
            // Validation
            if (!recipientId || !type || !title || !message) {
                return (0, response_1.sendError)(res, "recipientId, type, title, and message are required", 400);
            }
            const attachmentUrl = req.file
                ? `/uploads/notification_attachments/${req.file.filename}`
                : req.body.attachmentUrl || undefined;
            const notification = await notification_service_1.notificationService.createNotification({
                senderId,
                recipientId,
                recipientType,
                type,
                severity,
                title,
                message,
                language,
                relatedTaskId,
                relatedTestName,
                actionUrl,
                deliveryMethod,
                attachmentUrl,
            });
            return (0, response_1.sendResponse)(res, notification, "Notification sent successfully", 201);
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * POST /api/v1/notifications/bulk
     * Send bulk notifications to multiple patients
     */
    async createBulkNotifications(req, res) {
        try {
            const senderId = req.user?.id;
            const role = req.user?.role;
            if (!senderId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only doctors and assistants can send bulk notifications", 403);
            }
            const { type, severity, title, message, language, actionUrl, deliveryMethod, filters, } = req.body;
            // Validation
            if (!type || !title || !message) {
                return (0, response_1.sendError)(res, "type, title, and message are required", 400);
            }
            const result = await notification_service_1.notificationService.createBulkNotifications({
                senderId,
                type,
                severity,
                title,
                message,
                language,
                actionUrl,
                deliveryMethod,
                filters,
            });
            return (0, response_1.sendResponse)(res, result, "Bulk notifications sent successfully", 201);
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * PUT /api/v1/notifications/:id/read
     * Mark notification as read
     */
    async markAsRead(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const notification = await notification_service_1.notificationService.markAsRead(id, userId);
            return (0, response_1.sendResponse)(res, notification, "Notification marked as read");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * PUT /api/v1/notifications/bulk-read
     * Mark multiple notifications as read
     */
    async markBulkAsRead(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { notificationIds } = req.body;
            if (!notificationIds || !Array.isArray(notificationIds)) {
                return (0, response_1.sendError)(res, "notificationIds array is required", 400);
            }
            const result = await notification_service_1.notificationService.markBulkAsRead(notificationIds, userId);
            return (0, response_1.sendResponse)(res, result, "Notifications marked as read");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * PUT /api/v1/notifications/mark-all-read
     * Mark all notifications as read for the user
     */
    async markAllAsRead(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const recipientType = role === "PATIENT" ? "patient" : "staff";
            const result = await notification_service_1.notificationService.markAllAsRead(userId, recipientType);
            return (0, response_1.sendResponse)(res, result, "All notifications marked as read");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * DELETE /api/v1/notifications/:id
     * Delete notification
     */
    async deleteNotification(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const result = await notification_service_1.notificationService.deleteNotification(id, userId);
            return (0, response_1.sendResponse)(res, result, "Notification deleted successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * PUT /api/v1/notifications/fcm-token
     * Save/update staff FCM token for push notifications
     */
    async updateStaffFcmToken(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { fcmToken } = req.body;
            if (!fcmToken) {
                return (0, response_1.sendError)(res, "fcmToken is required", 400);
            }
            await Appuser_1.AppUser.update({ fcmToken }, { where: { id: userId } });
            return (0, response_1.sendResponse)(res, { success: true }, "FCM token updated successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/notifications/patient/:patientId/history
     * Get notification history sent to a specific patient (for Doctor/Assistant)
     */
    async getPatientNotificationHistory(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            // Validate params with Zod
            const paramsParsed = notification_schemas_1.patientNotificationHistoryParamsSchema.safeParse(req.params);
            if (!paramsParsed.success) {
                return (0, response_1.sendError)(res, paramsParsed.error.issues[0].message, 400);
            }
            const queryParsed = notification_schemas_1.patientNotificationHistoryQuerySchema.safeParse(req.query);
            if (!queryParsed.success) {
                return (0, response_1.sendError)(res, queryParsed.error.issues[0].message, 400);
            }
            const { patientId } = paramsParsed.data;
            const { page, limit } = queryParsed.data;
            const result = await notification_service_1.notificationService.getPatientNotificationHistory(patientId, { page, limit });
            return (0, response_1.sendResponse)(res, result, "Patient notification history fetched successfully");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return (0, response_1.sendError)(res, message);
        }
    }
    /**
     * POST /api/v1/notifications/translate
     * Translate notification title and message to target language (Hindi by default)
     */
    async translateText(req, res) {
        try {
            const { title, message, targetLanguage = "hi" } = req.body;
            if (!title && !message) {
                return (0, response_1.sendError)(res, "At least one of title or message is required", 400);
            }
            // Dynamic import because google-translate-api-x is ESM-only
            const { default: translate } = await Function('return import("google-translate-api-x")')();
            const results = {};
            if (title) {
                const titleResult = await translate(title, { to: targetLanguage });
                results.translatedTitle = titleResult.text;
            }
            if (message) {
                const messageResult = await translate(message, { to: targetLanguage });
                results.translatedMessage = messageResult.text;
            }
            return (0, response_1.sendResponse)(res, results, "Translation successful");
        }
        catch (error) {
            console.error("Translation error:", error);
            return (0, response_1.sendError)(res, error.message || "Translation failed");
        }
    }
    /**
     * POST /api/v1/notifications/transliterate
     * Transliterate English text to Hindi script (phonetic conversion)
     * Uses Google Input Tools API for accurate transliteration
     */
    async transliterateText(req, res) {
        try {
            const { text } = req.body;
            if (!text || typeof text !== "string" || !text.trim()) {
                return (0, response_1.sendError)(res, "text is required", 400);
            }
            const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text.trim())}&itc=hi-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8`;
            const response = await fetch(url);
            const data = await response.json();
            // Google Input Tools returns [status, [[input, suggestions, ...]]]
            if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.length > 0) {
                return (0, response_1.sendResponse)(res, {
                    input: text.trim(),
                    suggestions: data[1][0][1],
                }, "Transliteration successful");
            }
            // Fallback: return the original text if no suggestions
            return (0, response_1.sendResponse)(res, {
                input: text.trim(),
                suggestions: [text.trim()],
            }, "No transliteration available");
        }
        catch (error) {
            console.error("Transliteration error:", error);
            return (0, response_1.sendError)(res, error.message || "Transliteration failed");
        }
    }
    /**
   * POST /api/v1/notifications/:id/respond
   * Patient responds to a notification
   */
    async respondToNotification(req, res) {
        try {
            const notificationId = req.params.id;
            const patientId = req.user?.id;
            if (!patientId) {
                return (0, response_1.sendError)(res, "Only patients can respond to notifications", 403);
            }
            const { message } = req.body;
            if (!message) {
                return (0, response_1.sendError)(res, "Response message is required", 400);
            }
            const result = await notification_service_1.notificationService.respondToNotification(notificationId, patientId, message);
            return (0, response_1.sendResponse)(res, result, "Response sent successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
}
exports.notificationController = new NotificationController();
