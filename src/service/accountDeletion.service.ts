// src/service/accountDeletion.service.ts

import { sequelize } from "../config/Dbconnetion";
import { Patient } from "../models/Patient";
import { UserSubscription } from "../models/UserSubscription";
import { Diary } from "../models/Diary";
import { DoctorAssignmentRequest } from "../models/DoctorAssignmentRequest";
import { Order } from "../models/Order";
import { AppError } from "../utils/AppError";
import { DIARY_STATUS } from "../utils/diaryStatus";

const ANONYMIZED_NAME = "Deleted User";

/**
 * Soft-delete a patient account and all associated data.
 * Compliant with Google Play Store Data Deletion policy.
 *
 * Strategy:
 * - PII is anonymized (name, phone, address)
 * - Financial records (orders, subscriptions) are retained anonymized for legal compliance
 * - Scan data, reminders, notifications, and exports are retained (soft delete — no hard destroy)
 * - Patient status is set to INACTIVE
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
      { status: DIARY_STATUS.APPROVED },
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

    // 4. Anonymize orders (retain for financial/legal compliance)
    const [anonymizedOrders] = await Order.update(
      { orderNote: "Account deleted" },
      { where: { patientId }, transaction: t }
    );
    deletedData.ordersAnonymized = anonymizedOrders;

    // 5. Anonymize patient PII and mark as INACTIVE
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

  });

  return { deletedData };
}
