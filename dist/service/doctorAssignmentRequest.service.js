"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestsForPatient = exports.rejectRequest = exports.acceptRequest = exports.getRequestsForDoctor = exports.createRequest = void 0;
const sequelize_1 = require("sequelize");
const Dbconnetion_1 = require("../config/Dbconnetion");
const DoctorAssignmentRequest_1 = require("../models/DoctorAssignmentRequest");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const AppError_1 = require("../utils/AppError");
const twilio_service_1 = require("./twilio.service");
const emailService_1 = require("./emailService");
const MAX_ATTEMPTS_PER_DOCTOR = 2;
/**
 * Patient sends a request to a doctor for assignment.
 * Flow: Patient selects doctor first, then subscribes after approval.
 * Max 2 requests per patient→doctor pair.
 */
async function createRequest(patientId, doctorId) {
    // Verify patient exists and has no doctor yet
    const patient = await Patient_1.Patient.findByPk(patientId);
    if (!patient)
        throw new AppError_1.AppError(404, "Patient not found");
    if (patient.doctorId)
        throw new AppError_1.AppError(400, "You already have a doctor assigned");
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
 * Doctor accepts a request — links doctor to patient.
 * Diary assignment happens later when the patient purchases a subscription.
 */
async function acceptRequest(requestId, doctorId) {
    return await Dbconnetion_1.sequelize.transaction(async (t) => {
        const request = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.findOne({
            where: { id: requestId, doctorId, status: "PENDING" },
            include: [{ model: Patient_1.Patient }],
            transaction: t,
        });
        if (!request)
            throw new AppError_1.AppError(404, "Pending request not found");
        const patient = await Patient_1.Patient.findByPk(request.patientId, { transaction: t });
        if (!patient)
            throw new AppError_1.AppError(404, "Patient not found");
        // 1. Assign doctor to patient
        patient.doctorId = doctorId;
        await patient.save({ transaction: t });
        // 2. Mark request as accepted
        request.status = "ACCEPTED";
        request.respondedAt = new Date();
        await request.save({ transaction: t });
        // 3. Cancel any other pending requests from this patient
        await DoctorAssignmentRequest_1.DoctorAssignmentRequest.update({ status: "REJECTED", rejectionReason: "Another doctor accepted", respondedAt: new Date() }, { where: { patientId: request.patientId, status: "PENDING", id: { [sequelize_1.Op.ne]: requestId } }, transaction: t });
        // 4. Notify patient via SMS (fire-and-forget)
        const doctor = await Appuser_1.AppUser.findByPk(doctorId, { attributes: ["fullName", "specialization", "hospital"], transaction: t });
        if (patient.phone && doctor) {
            twilio_service_1.twilioService
                .sendSMS(patient.phone, `Good news! Dr. ${doctor.fullName} has accepted your request. You can now purchase a subscription to start using your Elvantia diary. - Elvantia`)
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
        twilio_service_1.twilioService
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
        await twilio_service_1.twilioService.sendSMS(doctor.phone, `New patient request: ${patient.fullName} (${caseLabel}) has chosen you as their doctor on Elvantia. Please log in to your dashboard to accept or decline. - Elvantia`);
    }
    // Email notification
    if (doctor.email) {
        await (0, emailService_1.sendDoctorRequestEmail)(doctor.email, doctor.fullName, patient.fullName, patient.age?.toString() || "N/A", patient.gender || "N/A", caseLabel, patient.phone || "N/A");
    }
}
