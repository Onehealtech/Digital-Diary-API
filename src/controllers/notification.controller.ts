import { Request, Response } from "express";
import { notificationService } from "../service/notification.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";

class NotificationController {
  /**
   * GET /api/v1/notifications
   * Get all notifications for the logged-in user
   */
  async getAllNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !role) {
        return sendError(res, "Unauthorized", 401);
      }

      // Determine recipient type based on role
      const recipientType = role === "PATIENT" ? "patient" : "staff";

      const { page = 1, limit = 20, type, read, severity } = req.query;

      const result = await notificationService.getAllNotifications(
        userId,
        recipientType as "patient" | "staff",
        {
          page: Number(page),
          limit: Number(limit),
          type: type as string,
          read: read === "true" ? true : read === "false" ? false : undefined,
          severity: severity as string,
        }
      );

      return sendResponse(res, result, "Notifications fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/notifications/stats
   * Get notification statistics for the logged-in user
   */
  async getNotificationStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !role) {
        return sendError(res, "Unauthorized", 401);
      }

      const recipientType = role === "PATIENT" ? "patient" : "staff";

      const stats = await notificationService.getNotificationStats(
        userId,
        recipientType as "patient" | "staff"
      );

      return sendResponse(res, stats, "Notification stats fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/notifications/:id
   * Get notification by ID
   */
  async getNotificationById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const notification = await notificationService.getNotificationById(id, userId);

      return sendResponse(res, notification, "Notification fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * POST /api/v1/notifications
   * Create single notification (Doctor/Assistant to patient)
   */
  async createNotification(req: AuthRequest, res: Response) {
    try {
      const senderId = req.user?.id;
      const role = req.user?.role;

      if (!senderId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
        return sendError(res, "Only doctors and assistants can send notifications", 403);
      }

      const {
        recipientId,
        recipientType = "patient",
        type,
        severity,
        title,
        message,
        relatedTaskId,
        relatedTestName,
        actionUrl,
        deliveryMethod,
      } = req.body;

      // Validation
      if (!recipientId || !type || !title || !message) {
        return sendError(res, "recipientId, type, title, and message are required", 400);
      }

      const notification = await notificationService.createNotification({
        senderId,
        recipientId,
        recipientType,
        type,
        severity,
        title,
        message,
        relatedTaskId,
        relatedTestName,
        actionUrl,
        deliveryMethod,
      });

      return sendResponse(res, notification, "Notification sent successfully", 201);
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/notifications/bulk
   * Send bulk notifications to multiple patients
   */
  async createBulkNotifications(req: AuthRequest, res: Response) {
    try {
      const senderId = req.user?.id;
      const role = req.user?.role;

      if (!senderId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
        return sendError(res, "Only doctors and assistants can send bulk notifications", 403);
      }

      const {
        type,
        severity,
        title,
        message,
        actionUrl,
        deliveryMethod,
        filters,
      } = req.body;

      // Validation
      if (!type || !title || !message) {
        return sendError(res, "type, title, and message are required", 400);
      }

      const result = await notificationService.createBulkNotifications({
        senderId,
        type,
        severity,
        title,
        message,
        actionUrl,
        deliveryMethod,
        filters,
      });

      return sendResponse(res, result, "Bulk notifications sent successfully", 201);
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * PUT /api/v1/notifications/:id/read
   * Mark notification as read
   */
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const notification = await notificationService.markAsRead(id, userId);

      return sendResponse(res, notification, "Notification marked as read");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * PUT /api/v1/notifications/bulk-read
   * Mark multiple notifications as read
   */
  async markBulkAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const { notificationIds } = req.body;

      if (!notificationIds || !Array.isArray(notificationIds)) {
        return sendError(res, "notificationIds array is required", 400);
      }

      const result = await notificationService.markBulkAsRead(notificationIds, userId);

      return sendResponse(res, result, "Notifications marked as read");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * PUT /api/v1/notifications/mark-all-read
   * Mark all notifications as read for the user
   */
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !role) {
        return sendError(res, "Unauthorized", 401);
      }

      const recipientType = role === "PATIENT" ? "patient" : "staff";

      const result = await notificationService.markAllAsRead(
        userId,
        recipientType as "patient" | "staff"
      );

      return sendResponse(res, result, "All notifications marked as read");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * DELETE /api/v1/notifications/:id
   * Delete notification
   */
  async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const result = await notificationService.deleteNotification(id, userId);

      return sendResponse(res, result, "Notification deleted successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }
}

export const notificationController = new NotificationController();
