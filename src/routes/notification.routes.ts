import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();

/**
 * Notification Routes
 * Doctor/Assistant can send notifications to patients
 * All users can view their own notifications
 */

// Get notification statistics
router.get(
  "/stats",
  authCheck(["SUPER_ADMIN", "DOCTOR", "ASSISTANT", "VENDOR", "PATIENT"]),
  notificationController.getNotificationStats
);

// Get all notifications for logged-in user
router.get(
  "/",
  authCheck(["SUPER_ADMIN", "DOCTOR", "ASSISTANT", "VENDOR", "PATIENT"]),
  notificationController.getAllNotifications
);

// Get notification by ID
router.get(
  "/:id",
  authCheck(["SUPER_ADMIN", "DOCTOR", "ASSISTANT", "VENDOR", "PATIENT"]),
  notificationController.getNotificationById
);

// Send single notification (Doctor/Assistant only)
router.post(
  "/",
  authCheck(["DOCTOR", "ASSISTANT"]),
  notificationController.createNotification
);

// Send bulk notifications (Doctor/Assistant only)
router.post(
  "/bulk",
  authCheck(["DOCTOR", "ASSISTANT"]),
  notificationController.createBulkNotifications
);

// Mark notification as read
router.put(
  "/:id/read",
  authCheck(["SUPER_ADMIN", "DOCTOR", "ASSISTANT", "VENDOR", "PATIENT"]),
  notificationController.markAsRead
);

// Mark multiple notifications as read
router.put(
  "/bulk-read",
  authCheck(["SUPER_ADMIN", "DOCTOR", "ASSISTANT", "VENDOR", "PATIENT"]),
  notificationController.markBulkAsRead
);

// Mark all notifications as read
router.put(
  "/mark-all-read",
  authCheck(["SUPER_ADMIN", "DOCTOR", "ASSISTANT", "VENDOR", "PATIENT"]),
  notificationController.markAllAsRead
);

// Delete notification
router.delete(
  "/:id",
  authCheck(["SUPER_ADMIN", "DOCTOR", "ASSISTANT", "VENDOR", "PATIENT"]),
  notificationController.deleteNotification
);

export default router;
