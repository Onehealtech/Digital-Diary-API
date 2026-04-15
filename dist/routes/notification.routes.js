"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const permissionMiddleware_1 = require("../middleware/permissionMiddleware");
const constants_1 = require("../utils/constants");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = (0, express_1.Router)();
/**
 * Notification Routes
 * Doctor/Assistant can send notifications to patients
 * All users can view their own notifications
 */
// Get notification statistics
router.get("/stats", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), notification_controller_1.notificationController.getNotificationStats);
// Get all notifications for logged-in user
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), notification_controller_1.notificationController.getAllNotifications);
// Get notification history for a specific patient (Doctor/Assistant)
router.get("/patient/:patientId/history", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), notification_controller_1.notificationController.getPatientNotificationHistory);
// Update staff FCM token for push notifications
router.put("/fcm-token", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), notification_controller_1.notificationController.updateStaffFcmToken);
// Get notification by ID
router.get("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), notification_controller_1.notificationController.getNotificationById);
// Translate notification text (Doctor/Assistant only)
router.post("/translate", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), notification_controller_1.notificationController.translateText);
// Transliterate English to Hindi script (Doctor/Assistant only)
router.post("/transliterate", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), notification_controller_1.notificationController.transliterateText);
// Send single notification (Doctor/Assistant only)
router.post("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('sendNotifications'), upload_middleware_1.notificationAttachmentUpload.single("attachment"), notification_controller_1.notificationController.createNotification);
// Send bulk notifications (Doctor/Assistant only)
router.post("/bulk", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('sendNotifications'), notification_controller_1.notificationController.createBulkNotifications);
// Mark notification as read
router.put("/:id/read", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), notification_controller_1.notificationController.markAsRead);
// Mark multiple notifications as read
router.put("/bulk-read", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), notification_controller_1.notificationController.markBulkAsRead);
// Mark all notifications as read
router.put("/mark-all-read", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), notification_controller_1.notificationController.markAllAsRead);
// Delete notification
router.delete("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), notification_controller_1.notificationController.deleteNotification);
router.post("/:id/respond", authMiddleware_1.patientAuthCheck, notification_controller_1.notificationController.respondToNotification);
exports.default = router;
