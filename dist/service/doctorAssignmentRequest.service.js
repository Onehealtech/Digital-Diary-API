"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestsForPatient = exports.rejectRequest = exports.acceptRequest = exports.getRequestsForDoctor = exports.createRequest = void 0;
const sequelize_1 = require("sequelize");
const Dbconnetion_1 = require("../config/Dbconnetion");
const DoctorAssignmentRequest_1 = require("../models/DoctorAssignmentRequest");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const UserSubscription_1 = require("../models/UserSubscription");
const SubscriptionPlan_1 = require("../models/SubscriptionPlan");
const Diary_1 = require("../models/Diary");
const GeneratedDiary_1 = require("../models/GeneratedDiary");
const AppError_1 = require("../utils/AppError");
const messageCentral_service_1 = require("./messageCentral.service");
const emailService_1 = require("./emailService");
const crypto_1 = __importDefault(require("crypto"));
const MAX_ATTEMPTS_PER_DOCTOR = 2;
/**
 * Patient sends a request to a doctor for assignment.
 * Flow: Patient must have active subscription before choosing a doctor.
 * Max 2 requests per patient→doctor pair.
 */
async function createRequest(patientId, doctorId) {
    // Verify patient exists and has no doctor yet
    const patient = await Patient_1.Patient.findByPk(patientId);
    if (!patient)
        throw new AppError_1.AppError(404, "Patient not found");
    if (patient.doctorId)
        throw new AppError_1.AppError(400, "You already have a doctor assigned");
    // Patient must have an active subscription before sending doctor request
    const activeSubscription = await UserSubscription_1.UserSubscription.findOne({
        where: { patientId, status: "ACTIVE" },
    });
    if (!activeSubscription) {
        throw new AppError_1.AppError(400, "You must purchase a subscription plan before choosing a doctor");
    }
    // Verify doctor exists and is active
    const doctor = await Appuser_1.AppUser.findOne({
        where: { id: doctorId, role: "DOCTOR", isActive: true },
    });
    if (!doctor)
        throw new AppError_1.AppError(404, "Doctor not found or inactive");
    // Check attempt count for this patient→doctor pair
    const existingCount = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.count({
        where: { patientId, doctorId },
    });
    if (existingCount >= MAX_ATTEMPTS_PER_DOCTOR) {
        throw new AppError_1.AppError(400, "You have already sent the maximum number of requests (2) to this doctor");
    }
    // Check if there's already a PENDING request for this patient→doctor
    const pendingRequest = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.findOne({
        where: { patientId, doctorId, status: "PENDING" },
    });
    if (pendingRequest) {
        throw new AppError_1.AppError(400, "You already have a pending request with this doctor");
    }
    // Check if patient has any other PENDING request to a different doctor
    const otherPending = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.findOne({
        where: { patientId, status: "PENDING", doctorId: { [sequelize_1.Op.ne]: doctorId } },
    });
    if (otherPending) {
        throw new AppError_1.AppError(400, "You already have a pending request with another doctor. Please wait for a response.");
    }
    const request = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.create({
        patientId,
        doctorId,
        status: "PENDING",
        attemptNumber: existingCount + 1,
    });
    // Fire-and-forget: notify doctor via email and SMS
    notifyDoctorOfRequest(doctor, patient, request).catch((err) => console.error("Failed to notify doctor of assignment request:", err));
    return request;
}
exports.createRequest = createRequest;
/**
 * Doctor views their pending assignment requests
 */
async function getRequestsForDoctor(doctorId, status) {
    const where = { doctorId };
    if (status)
        where.status = status;
    return DoctorAssignmentRequest_1.DoctorAssignmentRequest.findAll({
        where,
        include: [
            {
                model: Patient_1.Patient,
                attributes: ["id", "fullName", "age", "gender", "phone", "caseType", "registrationSource"],
            },
        ],
        order: [["createdAt", "DESC"]],
    });
}
exports.getRequestsForDoctor = getRequestsForDoctor;
/**
 * Doctor accepts a request — assigns patient to doctor, assigns diary.
 * Flow: On acceptance, auto-assign a diary from GeneratedDiary pool,
 * link doctor to patient, subscription, and diary.
 */
async function acceptRequest(requestId, doctorId) {
    return await Dbconnetion_1.sequelize.transaction(async (t) => {
        const request = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.findOne({
            where: { id: requestId, doctorId, status: "PENDING" },
            include: [{ model: Patient_1.Patient }],
            transaction: t,
        });
        console.log(request, "request");
        if (!request)
            throw new AppError_1.AppError(404, "Pending request not found");
        const patient = await Patient_1.Patient.findByPk(request.patientId, { transaction: t });
        if (!patient)
            throw new AppError_1.AppError(404, "Patient not found");
        console.log(patient, "patient");
        console.log(request.patientId, "request.patientId");
        // 1. Find the patient's active subscription
        const subscription = await UserSubscription_1.UserSubscription.findOne({
            where: { patientId: request.patientId, status: "ACTIVE" },
            include: [{ model: SubscriptionPlan_1.SubscriptionPlan }],
            transaction: t,
            // lock: t.LOCK.UPDATE,
        });
        console.log(subscription, "subscription");
        if (!subscription)
            throw new AppError_1.AppError(400, "Patient does not have an active subscription");
        const plan = subscription.plan;
        // 2. Find or create an unassigned diary
        let generatedDiary = await GeneratedDiary_1.GeneratedDiary.findOne({
            where: { status: "unassigned" },
            order: [["createdAt", "ASC"]],
            lock: t.LOCK.UPDATE,
            transaction: t,
        });
        console.log(generatedDiary, "generatedDiary");
        if (!generatedDiary) {
            const diaryId = generateDiaryId();
            generatedDiary = await GeneratedDiary_1.GeneratedDiary.create({
                id: diaryId,
                diaryType: "peri-operative",
                status: "unassigned",
                generatedDate: new Date(),
            }, { transaction: t });
        }
        // 3. Mark generated diary as sold
        generatedDiary.status = "sold";
        generatedDiary.soldTo = request.patientId;
        generatedDiary.soldDate = new Date();
        await generatedDiary.save({ transaction: t });
        // 4. Create diary record with doctor
        await Diary_1.Diary.create({
            id: generatedDiary.id,
            patientId: request.patientId,
            doctorId,
            status: "active",
            activationDate: new Date(),
            saleAmount: plan ? Number(plan.monthlyPrice) : 0,
            commissionAmount: 0,
        }, { transaction: t }).then((diary) => {
            console.log(diary, "diary");
        }).catch((err) => {
            console.error("Failed to create diary record:", err);
            throw new AppError_1.AppError(500, "Failed to assign diary to patient");
        });
        // 5. Update patient: assign doctorId and diaryId
        patient.doctorId = doctorId;
        patient.diaryId = generatedDiary.id;
        await patient.save({ transaction: t });
        // 6. Update subscription: link doctor and diary
        subscription.doctorId = doctorId;
        subscription.diaryId = generatedDiary.id;
        await subscription.save({ transaction: t });
        // 7. Mark request as accepted
        request.status = "ACCEPTED";
        request.respondedAt = new Date();
        await request.save({ transaction: t });
        // 8. Cancel any other pending requests from this patient
        await DoctorAssignmentRequest_1.DoctorAssignmentRequest.update({ status: "REJECTED", rejectionReason: "Another doctor accepted", respondedAt: new Date() }, { where: { patientId: request.patientId, status: "PENDING", id: { [sequelize_1.Op.ne]: requestId } }, transaction: t });
        // 9. Notify patient via SMS (fire-and-forget, outside transaction)
        const doctor = await Appuser_1.AppUser.findByPk(doctorId, { attributes: ["fullName", "specialization", "hospital"], transaction: t });
        if (patient.phone && doctor) {
            messageCentral_service_1.messageCentralService
                .sendSMS(patient.phone, `Good news! Dr. ${doctor.fullName} has accepted your request. Your diary (${generatedDiary.id}) has been assigned. You can now start using your Elvantia diary. - Elvantia`)
                .catch((err) => console.error("Failed to send acceptance SMS:", err));
        }
        return request;
    });
}
exports.acceptRequest = acceptRequest;
/**
 * Doctor rejects a request
 */
async function rejectRequest(requestId, doctorId, rejectionReason) {
    const request = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.findOne({
        where: { id: requestId, doctorId, status: "PENDING" },
        include: [{ model: Patient_1.Patient }],
    });
    if (!request)
        throw new AppError_1.AppError(404, "Pending request not found");
    request.status = "REJECTED";
    request.rejectionReason = rejectionReason || "Doctor declined the request";
    request.respondedAt = new Date();
    await request.save();
    // Notify patient via SMS
    const patient = await Patient_1.Patient.findByPk(request.patientId);
    if (patient?.phone) {
        const canRetry = request.attemptNumber < MAX_ATTEMPTS_PER_DOCTOR;
        const retryMsg = canRetry
            ? " You may send one more request to this doctor, or choose a different doctor."
            : " You have used both attempts with this doctor. Please choose a different doctor.";
        messageCentral_service_1.messageCentralService
            .sendSMS(patient.phone, `Your doctor assignment request was not accepted.${retryMsg} - Elvantia`)
            .catch((err) => console.error("❌ Failed to send rejection SMS:", err));
    }
    return request;
}
exports.rejectRequest = rejectRequest;
/**
 * Get requests for a specific patient (for the mobile app)
 */
async function getRequestsForPatient(patientId) {
    return DoctorAssignmentRequest_1.DoctorAssignmentRequest.findAll({
        where: { patientId },
        include: [
            {
                model: Appuser_1.AppUser,
                attributes: ["id", "fullName", "specialization", "hospital", "location"],
            },
        ],
        order: [["createdAt", "DESC"]],
    });
}
exports.getRequestsForPatient = getRequestsForPatient;
/**
 * Fire-and-forget: Send email + SMS to doctor about new patient request
 */
async function notifyDoctorOfRequest(doctor, patient, request) {
    const caseLabel = patient.caseType
        ? patient.caseType.replace(/_/g, " ").toLowerCase()
        : "not specified";
    // SMS notification
    if (doctor.phone) {
        await messageCentral_service_1.messageCentralService.sendSMS(doctor.phone, `New patient request: ${patient.fullName} (${caseLabel}) has chosen you as their doctor on Elvantia. Please log in to your dashboard to accept or decline. - Elvantia`);
    }
    // Email notification
    if (doctor.email) {
        await (0, emailService_1.sendDoctorRequestEmail)(doctor.email, doctor.fullName, patient.fullName, patient.age?.toString() || "N/A", patient.gender || "N/A", caseLabel, patient.phone || "N/A");
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function generateDiaryId() {
    const year = new Date().getFullYear();
    const random = crypto_1.default.randomBytes(3).toString("hex").toUpperCase();
    return `DRY-${year}-AUTO-${random}`;
}
