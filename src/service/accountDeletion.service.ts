// src/service/accountDeletion.service.ts

import { sequelize } from "../config/Dbconnetion";
import { Patient } from "../models/Patient";
import { UserSubscription } from "../models/UserSubscription";
import { Diary } from "../models/Diary";
import { GeneratedDiary } from "../models/GeneratedDiary";
import { DoctorAssignmentRequest } from "../models/DoctorAssignmentRequest";
import { Order } from "../models/Order";
import { BubbleScanResult } from "../models/BubbleScanResult";
import { ScanLog } from "../models/ScanLog";
import { Reminder } from "../models/Reminder";
import { Notification } from "../models/Notification";
import { Export } from "../models/Export";
import ImageHistory from "../models/ImageHistory.model";
import { AuditLog } from "../models/AuditLog";
import { AppError } from "../utils/AppError";
import { DIARY_STATUS } from "../utils/diaryStatus";

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
export async function deletePatientAccount(
  patientId: string,
  reason?: string
): Promise<{ deletedData: Record<string, number> }> {
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new AppError(404, "Patient not found");
  if (patient.status === "INACTIVE") {
    throw new AppError(400, "Account is already deleted");
  }

  const deletedData: Record<string, number> = {};

  await sequelize.transaction(async (t) => {
    // 1. Cancel active subscriptions
    const [cancelledSubs] = await UserSubscription.update(
      { status: "CANCELLED", cancelledAt: new Date() },
      { where: { patientId, status: "ACTIVE" }, transaction: t }
    );
    deletedData.subscriptionsCancelled = cancelledSubs;

    // 2. Move diaries back to non-usable approval state
    const [deactivatedDiaries] = await Diary.update(
      { status: DIARY_STATUS.PENDING },
      { where: { patientId }, transaction: t }
    );
    deletedData.diariesDeactivated = deactivatedDiaries;

    // 3. Cancel pending doctor assignment requests
    const [cancelledRequests] = await DoctorAssignmentRequest.update(
      {
        status: "REJECTED",
        rejectionReason: "Patient account deleted",
        respondedAt: new Date(),
      },
      { where: { patientId, status: "PENDING" }, transaction: t }
    );
    deletedData.requestsCancelled = cancelledRequests;

    // 4. Delete scan data (PII — medical data)
    const deletedScans = await BubbleScanResult.destroy({
      where: { patientId },
      transaction: t,
    });
    deletedData.scansDeleted = deletedScans;

    const deletedScanLogs = await ScanLog.destroy({
      where: { patientId },
      transaction: t,
    });
    deletedData.scanLogsDeleted = deletedScanLogs;

    // 5. Delete image history
    const diaryId = patient.diaryId;
    if (diaryId) {
      const deletedImages = await ImageHistory.destroy({
        where: { diaryId },
        transaction: t,
      });
      deletedData.imagesDeleted = deletedImages;
    }

    // 6. Delete reminders
    const deletedReminders = await Reminder.destroy({
      where: { patientId },
      transaction: t,
    });
    deletedData.remindersDeleted = deletedReminders;

    // 7. Delete notifications sent TO this patient
    const deletedNotifications = await Notification.destroy({
      where: { recipientId: patientId, recipientType: "patient" },
      transaction: t,
    });
    deletedData.notificationsDeleted = deletedNotifications;

    // 8. Delete exports
    const deletedExports = await Export.destroy({
      where: { patientId },
      transaction: t,
    });
    deletedData.exportsDeleted = deletedExports;

    // 9. Anonymize orders (retain for financial/legal compliance)
    const [anonymizedOrders] = await Order.update(
      { orderNote: "Account deleted" },
      { where: { patientId }, transaction: t }
    );
    deletedData.ordersAnonymized = anonymizedOrders;

    // 10. Anonymize patient PII and mark as INACTIVE
    patient.fullName = ANONYMIZED_NAME;
    patient.phone = null as any;
    patient.address = null as any;
    patient.fcmToken = null as any;
    patient.age = null as any;
    patient.gender = null as any;
    patient.status = "INACTIVE";
    patient.deactivationReason = reason || "Account deleted by user (Play Store compliance)";
    patient.deactivatedAt = new Date();
    patient.deactivatedBy = patientId; // self-deletion
    patient.tokenVersion = ((patient as any).tokenVersion ?? 0) + 1;
    patient.prescribedTests = [];
    await patient.save({ transaction: t });

    // 11. Log deletion in audit trail
    await AuditLog.create(
      {
        userId: patientId,
        userRole: "patient",
        action: "ACCOUNT_DELETED",
        details: {
          reason: reason || "User requested account deletion",
          deletedData,
          deletedAt: new Date().toISOString(),
        },
      },
      { transaction: t }
    );
  });

  return { deletedData };
}
