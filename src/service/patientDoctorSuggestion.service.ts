// src/service/patientDoctorSuggestion.service.ts

import { Op } from "sequelize";
import { PatientDoctorSuggestion } from "../models/PatientDoctorSuggestion";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AppError } from "../utils/AppError";

// ═══════════════════════════════════════════════════════════════════════════
// PATIENT-FACING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patient suggests a new doctor that isn't in the system.
 * Creates a PENDING request for Super Admin review.
 */
export async function createSuggestion(
  patientId: string,
  data: {
    doctorName: string;
    doctorPhone?: string;
    doctorEmail?: string;
    hospital?: string;
    specialization?: string;
    city?: string;
    additionalNotes?: string;
  }
): Promise<PatientDoctorSuggestion> {
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new AppError(404, "Patient not found");

  // Limit: max 3 pending suggestions per patient
  const pendingCount = await PatientDoctorSuggestion.count({
    where: { patientId, status: "PENDING" },
  });
  if (pendingCount >= 3) {
    throw new AppError(400, "You already have 3 pending doctor suggestions. Please wait for admin review.");
  }

  return PatientDoctorSuggestion.create({
    patientId,
    ...data,
    status: "PENDING",
  });
}

/**
 * Patient views their own suggestions.
 */
export async function getMySuggestions(
  patientId: string
): Promise<PatientDoctorSuggestion[]> {
  return PatientDoctorSuggestion.findAll({
    where: { patientId },
    order: [["createdAt", "DESC"]],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPER ADMIN-FACING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Super Admin views all doctor suggestions with pagination and filters.
 */
export async function getAllSuggestions(params: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{
  suggestions: PatientDoctorSuggestion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { page, limit, status } = params;
  const where: any = {};
  if (status) where.status = status;

  const { rows, count } = await PatientDoctorSuggestion.findAndCountAll({
    where,
    include: [
      {
        model: Patient,
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

/**
 * Super Admin views a single suggestion by ID.
 */
export async function getSuggestionById(
  id: string
): Promise<PatientDoctorSuggestion> {
  const suggestion = await PatientDoctorSuggestion.findByPk(id, {
    include: [
      {
        model: Patient,
        attributes: ["id", "fullName", "phone", "caseType", "registrationSource"],
      },
    ],
  });
  if (!suggestion) throw new AppError(404, "Suggestion not found");
  return suggestion;
}

/**
 * Super Admin approves and optionally links the created doctor.
 */
export async function approveSuggestion(
  id: string,
  reviewerId: string,
  onboardedDoctorId?: string
): Promise<PatientDoctorSuggestion> {
  const suggestion = await PatientDoctorSuggestion.findByPk(id);
  if (!suggestion) throw new AppError(404, "Suggestion not found");
  if (suggestion.status !== "PENDING") {
    throw new AppError(400, "This suggestion has already been reviewed");
  }

  // If a doctorId is provided, verify the doctor exists
  if (onboardedDoctorId) {
    const doctor = await AppUser.findOne({
      where: { id: onboardedDoctorId, role: "DOCTOR" },
    });
    if (!doctor) throw new AppError(404, "Doctor not found with the given ID");
  }

  suggestion.status = "APPROVED";
  suggestion.reviewedBy = reviewerId;
  suggestion.reviewedAt = new Date();
  suggestion.onboardedDoctorId = onboardedDoctorId || undefined;
  await suggestion.save();

  return suggestion;
}

/**
 * Super Admin rejects a suggestion with a reason.
 */
export async function rejectSuggestion(
  id: string,
  reviewerId: string,
  rejectionReason?: string
): Promise<PatientDoctorSuggestion> {
  const suggestion = await PatientDoctorSuggestion.findByPk(id);
  if (!suggestion) throw new AppError(404, "Suggestion not found");
  if (suggestion.status !== "PENDING") {
    throw new AppError(400, "This suggestion has already been reviewed");
  }

  suggestion.status = "REJECTED";
  suggestion.reviewedBy = reviewerId;
  suggestion.reviewedAt = new Date();
  suggestion.rejectionReason = rejectionReason || "Request declined by admin";
  await suggestion.save();

  return suggestion;
}
