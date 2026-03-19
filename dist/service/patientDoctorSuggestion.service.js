"use strict";
// src/service/patientDoctorSuggestion.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectSuggestion = exports.approveSuggestion = exports.getSuggestionById = exports.getAllSuggestions = exports.getMySuggestions = exports.createSuggestion = void 0;
const PatientDoctorSuggestion_1 = require("../models/PatientDoctorSuggestion");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const AppError_1 = require("../utils/AppError");
// ═══════════════════════════════════════════════════════════════════════════
// PATIENT-FACING
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Patient suggests a new doctor that isn't in the system.
 * Creates a PENDING request for Super Admin review.
 */
async function createSuggestion(patientId, data) {
    const patient = await Patient_1.Patient.findByPk(patientId);
    if (!patient)
        throw new AppError_1.AppError(404, "Patient not found");
    // Limit: max 3 pending suggestions per patient
    const pendingCount = await PatientDoctorSuggestion_1.PatientDoctorSuggestion.count({
        where: { patientId, status: "PENDING" },
    });
    if (pendingCount >= 3) {
        throw new AppError_1.AppError(400, "You already have 3 pending doctor suggestions. Please wait for admin review.");
    }
    return PatientDoctorSuggestion_1.PatientDoctorSuggestion.create({
        patientId,
        ...data,
        status: "PENDING",
    });
}
exports.createSuggestion = createSuggestion;
/**
 * Patient views their own suggestions.
 */
async function getMySuggestions(patientId) {
    return PatientDoctorSuggestion_1.PatientDoctorSuggestion.findAll({
        where: { patientId },
        order: [["createdAt", "DESC"]],
    });
}
exports.getMySuggestions = getMySuggestions;
// ═══════════════════════════════════════════════════════════════════════════
// SUPER ADMIN-FACING
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Super Admin views all doctor suggestions with pagination and filters.
 */
async function getAllSuggestions(params) {
    const { page, limit, status } = params;
    const where = {};
    if (status)
        where.status = status;
    const { rows, count } = await PatientDoctorSuggestion_1.PatientDoctorSuggestion.findAndCountAll({
        where,
        include: [
            {
                model: Patient_1.Patient,
                attributes: ["id", "fullName", "phone", "caseType"],
            },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
    });
    return {
        suggestions: rows,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
    };
}
exports.getAllSuggestions = getAllSuggestions;
/**
 * Super Admin views a single suggestion by ID.
 */
async function getSuggestionById(id) {
    const suggestion = await PatientDoctorSuggestion_1.PatientDoctorSuggestion.findByPk(id, {
        include: [
            {
                model: Patient_1.Patient,
                attributes: ["id", "fullName", "phone", "caseType", "registrationSource"],
            },
        ],
    });
    if (!suggestion)
        throw new AppError_1.AppError(404, "Suggestion not found");
    return suggestion;
}
exports.getSuggestionById = getSuggestionById;
/**
 * Super Admin approves and optionally links the created doctor.
 */
async function approveSuggestion(id, reviewerId, onboardedDoctorId) {
    const suggestion = await PatientDoctorSuggestion_1.PatientDoctorSuggestion.findByPk(id);
    if (!suggestion)
        throw new AppError_1.AppError(404, "Suggestion not found");
    if (suggestion.status !== "PENDING") {
        throw new AppError_1.AppError(400, "This suggestion has already been reviewed");
    }
    // If a doctorId is provided, verify the doctor exists
    if (onboardedDoctorId) {
        const doctor = await Appuser_1.AppUser.findOne({
            where: { id: onboardedDoctorId, role: "DOCTOR" },
        });
        if (!doctor)
            throw new AppError_1.AppError(404, "Doctor not found with the given ID");
    }
    suggestion.status = "APPROVED";
    suggestion.reviewedBy = reviewerId;
    suggestion.reviewedAt = new Date();
    suggestion.onboardedDoctorId = onboardedDoctorId || undefined;
    await suggestion.save();
    return suggestion;
}
exports.approveSuggestion = approveSuggestion;
/**
 * Super Admin rejects a suggestion with a reason.
 */
async function rejectSuggestion(id, reviewerId, rejectionReason) {
    const suggestion = await PatientDoctorSuggestion_1.PatientDoctorSuggestion.findByPk(id);
    if (!suggestion)
        throw new AppError_1.AppError(404, "Suggestion not found");
    if (suggestion.status !== "PENDING") {
        throw new AppError_1.AppError(400, "This suggestion has already been reviewed");
    }
    suggestion.status = "REJECTED";
    suggestion.reviewedBy = reviewerId;
    suggestion.reviewedAt = new Date();
    suggestion.rejectionReason = rejectionReason || "Request declined by admin";
    await suggestion.save();
    return suggestion;
}
exports.rejectSuggestion = rejectSuggestion;
