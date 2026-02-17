import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

/**
 * Notification Routes
 * Doctor/Assistant can send notifications to patients
 * All users can view their own notifications
 */

// Get notification statistics
router.get(
  "/stats",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  notificationController.getNotificationStats
);

// Get all notifications for logged-in user
router.get(
  "/",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  notificationController.getAllNotifications
);

// Update staff FCM token for push notifications
router.put(
  "/fcm-token",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  notificationController.updateStaffFcmToken
);

// Get notification by ID
router.get(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  notificationController.getNotificationById
);

// Send single notification (Doctor/Assistant only)
router.post(
  "/",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
  notificationController.createNotification
);

// Send bulk notifications (Doctor/Assistant only)
router.post(
  "/bulk",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
  notificationController.createBulkNotifications
);

// Mark notification as read
router.put(
  "/:id/read",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  notificationController.markAsRead
);

// Mark multiple notifications as read
router.put(
  "/bulk-read",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  notificationController.markBulkAsRead
);

// Mark all notifications as read
router.put(
  "/mark-all-read",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  notificationController.markAllAsRead
);

// Delete notification
router.delete(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  notificationController.deleteNotification
);

export default router;
