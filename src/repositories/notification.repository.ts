import { Notification } from "../models/Notification";
import { AppUser } from "../models/Appuser";

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
    ): Promise<{ rows: Notification[]; count: number }> {
        const { page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        return Notification.findAndCountAll({
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
    }
}

export const notificationRepository = new NotificationRepository();
