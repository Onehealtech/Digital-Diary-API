"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRepository = void 0;
const Notification_1 = require("../models/Notification");
const Appuser_1 = require("../models/Appuser");
const Reminder_1 = require("../models/Reminder");
class NotificationRepository {
    /**
     * Find all notifications sent to a specific patient, with sender info.
     * Ordered by createdAt DESC (newest first).
     */
    async findByPatientId(patientId, filters = {}) {
        const { page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;
        const result = await Notification_1.Notification.findAndCountAll({
            where: {
                recipientId: patientId,
                recipientType: "patient",
            },
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "sender",
                    attributes: ["id", "fullName"],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        // Attach reminderDate from the linked Reminder (stored in relatedTaskId).
        // This allows the frontend to show the actual appointment date instead of
        // the notification creation date (createdAt = the date the doctor sent it).
        const reminderIds = result.rows
            .filter((n) => n.type === "reminder" && n.relatedTaskId)
            .map((n) => n.relatedTaskId);
        if (reminderIds.length > 0) {
            const reminders = await Reminder_1.Reminder.findAll({
                where: { id: reminderIds },
                attributes: ["id", "reminderDate"],
            });
            const rdMap = new Map(reminders.map((r) => [r.id, r.reminderDate]));
            result.rows.forEach((n) => {
                if (n.relatedTaskId && rdMap.has(n.relatedTaskId)) {
                    n.reminderDate = rdMap.get(n.relatedTaskId);
                }
            });
        }
        return result;
    }
}
exports.notificationRepository = new NotificationRepository();
