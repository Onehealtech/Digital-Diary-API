"use strict";
// src/service/accountDeletion.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePatientAccount = void 0;
const Dbconnetion_1 = require("../config/Dbconnetion");
const Patient_1 = require("../models/Patient");
const UserSubscription_1 = require("../models/UserSubscription");
const Diary_1 = require("../models/Diary");
const DoctorAssignmentRequest_1 = require("../models/DoctorAssignmentRequest");
const Order_1 = require("../models/Order");
const BubbleScanResult_1 = require("../models/BubbleScanResult");
const ScanLog_1 = require("../models/ScanLog");
const Reminder_1 = require("../models/Reminder");
const Notification_1 = require("../models/Notification");
const Export_1 = require("../models/Export");
const ImageHistory_model_1 = __importDefault(require("../models/ImageHistory.model"));
const AuditLog_1 = require("../models/AuditLog");
const AppError_1 = require("../utils/AppError");
const ANONYMIZED_NAME = "Deleted User";
const ANONYMIZED_PHONE = "0000000000";
/**
 * Permanently delete/anonymize a patient account and all associated data.
 * Compliant with Google Play Store Data Deletion policy.
 *
 * Strategy:
 * - PII is anonymized (name, phone, address)
 * - Financial records (orders, subscriptions) are retained anonymized for legal compliance
 * - Scan data, reminders, notifications, and exports are hard-deleted
 * - Patient status is set to INACTIVE
 * - Audit log entry is created for compliance trail
 */
async function deletePatientAccount(patientId, reason) {
    const patient = await Patient_1.Patient.findByPk(patientId);
    if (!patient)
        throw new AppError_1.AppError(404, "Patient not found");
    if (patient.status === "INACTIVE") {
        throw new AppError_1.AppError(400, "Account is already deleted");
    }
    const deletedData = {};
    await Dbconnetion_1.sequelize.transaction(async (t) => {
        // 1. Cancel active subscriptions
        const [cancelledSubs] = await UserSubscription_1.UserSubscription.update({ status: "CANCELLED", cancelledAt: new Date() }, { where: { patientId, status: "ACTIVE" }, transaction: t });
        deletedData.subscriptionsCancelled = cancelledSubs;
        // 2. Deactivate diaries
        const [deactivatedDiaries] = await Diary_1.Diary.update({ status: "inactive" }, { where: { patientId }, transaction: t });
        deletedData.diariesDeactivated = deactivatedDiaries;
        // 3. Cancel pending doctor assignment requests
        const [cancelledRequests] = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.update({
            status: "REJECTED",
            rejectionReason: "Patient account deleted",
            respondedAt: new Date(),
        }, { where: { patientId, status: "PENDING" }, transaction: t });
        deletedData.requestsCancelled = cancelledRequests;
        // 4. Delete scan data (PII — medical data)
        const deletedScans = await BubbleScanResult_1.BubbleScanResult.destroy({
            where: { patientId },
            transaction: t,
        });
        deletedData.scansDeleted = deletedScans;
        const deletedScanLogs = await ScanLog_1.ScanLog.destroy({
            where: { patientId },
            transaction: t,
        });
        deletedData.scanLogsDeleted = deletedScanLogs;
        // 5. Delete image history
        const diaryId = patient.diaryId;
        if (diaryId) {
            const deletedImages = await ImageHistory_model_1.default.destroy({
                where: { diaryId },
                transaction: t,
            });
            deletedData.imagesDeleted = deletedImages;
        }
        // 6. Delete reminders
        const deletedReminders = await Reminder_1.Reminder.destroy({
            where: { patientId },
            transaction: t,
        });
        deletedData.remindersDeleted = deletedReminders;
        // 7. Delete notifications sent TO this patient
        const deletedNotifications = await Notification_1.Notification.destroy({
            where: { recipientId: patientId, recipientType: "patient" },
            transaction: t,
        });
        deletedData.notificationsDeleted = deletedNotifications;
        // 8. Delete exports
        const deletedExports = await Export_1.Export.destroy({
            where: { patientId },
            transaction: t,
        });
        deletedData.exportsDeleted = deletedExports;
        // 9. Anonymize orders (retain for financial/legal compliance)
        const [anonymizedOrders] = await Order_1.Order.update({ orderNote: "Account deleted" }, { where: { patientId }, transaction: t });
        deletedData.ordersAnonymized = anonymizedOrders;
        // 10. Anonymize patient PII and mark as INACTIVE
        patient.fullName = ANONYMIZED_NAME;
        patient.phone = null;
        patient.address = null;
        patient.fcmToken = null;
        patient.age = null;
        patient.gender = null;
        patient.status = "INACTIVE";
        patient.deactivationReason = reason || "Account deleted by user (Play Store compliance)";
        patient.deactivatedAt = new Date();
        patient.deactivatedBy = patientId; // self-deletion
        patient.prescribedTests = [];
        await patient.save({ transaction: t });
        // 11. Log deletion in audit trail
        await AuditLog_1.AuditLog.create({
            userId: patientId,
            userRole: "patient",
            action: "ACCOUNT_DELETED",
            details: {
                reason: reason || "User requested account deletion",
                deletedData,
                deletedAt: new Date().toISOString(),
            },
        }, { transaction: t });
    });
    return { deletedData };
}
exports.deletePatientAccount = deletePatientAccount;
