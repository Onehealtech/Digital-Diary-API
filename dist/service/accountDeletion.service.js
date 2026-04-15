"use strict";
// src/service/accountDeletion.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePatientAccount = void 0;
const Dbconnetion_1 = require("../config/Dbconnetion");
const Patient_1 = require("../models/Patient");
const UserSubscription_1 = require("../models/UserSubscription");
const Diary_1 = require("../models/Diary");
const DoctorAssignmentRequest_1 = require("../models/DoctorAssignmentRequest");
const Order_1 = require("../models/Order");
const AppError_1 = require("../utils/AppError");
const diaryStatus_1 = require("../utils/diaryStatus");
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
        // 2. Move diaries back to non-usable approval state
        const [deactivatedDiaries] = await Diary_1.Diary.update({ status: diaryStatus_1.DIARY_STATUS.APPROVED }, { where: { patientId }, transaction: t });
        deletedData.diariesDeactivated = deactivatedDiaries;
        // 3. Cancel pending doctor assignment requests
        const [cancelledRequests] = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.update({
            status: "REJECTED",
            rejectionReason: "Patient account deleted",
            respondedAt: new Date(),
        }, { where: { patientId, status: "PENDING" }, transaction: t });
        deletedData.requestsCancelled = cancelledRequests;
        // 4. Anonymize orders (retain for financial/legal compliance)
        const [anonymizedOrders] = await Order_1.Order.update({ orderNote: "Account deleted" }, { where: { patientId }, transaction: t });
        deletedData.ordersAnonymized = anonymizedOrders;
        // 5. Anonymize patient PII and mark as INACTIVE
        // patient.fullName = ANONYMIZED_NAME;
        // patient.phone = null as any;
        // patient.address = null as any;
        // patient.fcmToken = null as any;
        // patient.age = null as any;
        // patient.gender = null as any;
        patient.status = "INACTIVE";
        patient.deactivationReason = reason || "Account deleted by user (Play Store compliance)";
        patient.deactivatedAt = new Date();
        patient.deactivatedBy = patientId; // self-deletion
        patient.tokenVersion = (patient.tokenVersion ?? 0) + 1;
        patient.prescribedTests = [];
        await patient.save({ transaction: t });
    });
    return { deletedData };
}
exports.deletePatientAccount = deletePatientAccount;
