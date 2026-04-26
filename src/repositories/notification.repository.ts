import { Notification } from "../models/Notification";
import { AppUser } from "../models/Appuser";
import { Reminder } from "../models/Reminder";

interface PatientNotificationFilters {
    page?: number;
    limit?: number;
}

class NotificationRepository {
    /**
     * Find all notifications sent to a specific patient, with sender info.
     * Ordered by createdAt DESC (newest first).
     */
    async findByPatientId(
        patientId: string,
        filters: PatientNotificationFilters = {}
    ): Promise<{ rows: (Notification & { reminderDate?: Date | null })[]; count: number }> {
        const { page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        const result = await Notification.findAndCountAll({
            where: {
                recipientId: patientId,
                recipientType: "patient",
            },
            include: [
                {
                    model: AppUser,
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
            .map((n) => n.relatedTaskId as string);

        if (reminderIds.length > 0) {
            const reminders = await Reminder.findAll({
                where: { id: reminderIds },
                attributes: ["id", "reminderDate"],
            });
            const rdMap = new Map(reminders.map((r) => [r.id, r.reminderDate]));
            result.rows.forEach((n) => {
                if (n.relatedTaskId && rdMap.has(n.relatedTaskId)) {
                    (n as any).reminderDate = rdMap.get(n.relatedTaskId);
                }
            });
        }

        return result;
    }
}

export const notificationRepository = new NotificationRepository();
