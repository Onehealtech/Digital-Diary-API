"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRepository = void 0;
const Notification_1 = require("../models/Notification");
const Appuser_1 = require("../models/Appuser");
class NotificationRepository {
    /**
     * Find all notifications sent to a specific patient, with sender info.
     * Ordered by createdAt DESC (newest first).
     */
    async findByPatientId(patientId, filters = {}) {
        const { page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;
        return Notification_1.Notification.findAndCountAll({
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
    }
}
exports.notificationRepository = new NotificationRepository();
