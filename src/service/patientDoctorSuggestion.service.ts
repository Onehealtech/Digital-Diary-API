// src/service/patientDoctorSuggestion.service.ts

import { Op } from "sequelize";
import { PatientDoctorSuggestion } from "../models/PatientDoctorSuggestion";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AppError } from "../utils/AppError";
import { generateSecurePassword } from "../utils/passwordUtils";
import { sendPasswordEmail } from "./emailService";
import { createWallet } from "./wallet.service";
import { createCashfreeVendor } from "./cashfree-vendor.service";

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
 * Super Admin approves and optionally links an existing doctor OR creates a new one.
 *
 * - onboardedDoctorId: link to an existing doctor
 * - newDoctor: create a new doctor profile, then link
 */
export async function approveSuggestion(
  id: string,
  reviewerId: string,
  onboardedDoctorId?: string,
  newDoctor?: {
    fullName: string;
    email: string;
    phone?: string;
    hospital?: string;
    specialization?: string;
    license?: string;
    address?: string;
    city?: string;
    state?: string;
    commissionType?: string;
    commissionRate?: number;
    bank?: {
      accountHolder: string;
      accountNumber: string;
      ifsc: string;
      bankName: string;
    };
  }
): Promise<{ suggestion: PatientDoctorSuggestion; doctorCreated?: boolean; warnings?: string[] }> {
  const suggestion = await PatientDoctorSuggestion.findByPk(id);
  if (!suggestion) throw new AppError(404, "Suggestion not found");
  if (suggestion.status !== "PENDING") {
    throw new AppError(400, "This suggestion has already been reviewed");
  }

  let doctorId = onboardedDoctorId;
  let doctorCreated = false;
  const warnings: string[] = [];

  // If linking to an existing doctor, verify it exists
  if (doctorId) {
    const doctor = await AppUser.findOne({
      where: { id: doctorId, role: "DOCTOR" },
    });
    if (!doctor) throw new AppError(404, "Doctor not found with the given ID");
  }

  // If creating a new doctor profile
  if (newDoctor && !doctorId) {
    if (!newDoctor.fullName || !newDoctor.email) {
      throw new AppError(400, "Doctor full name and email are required");
    }

    // Check duplicate email
    const existing = await AppUser.findOne({
      where: { email: newDoctor.email.toLowerCase() },
    });
    if (existing) {
      throw new AppError(409, "A user with this email already exists");
    }

    const plainPassword = generateSecurePassword();

    const newUser = await AppUser.create({
      fullName: newDoctor.fullName,
      email: newDoctor.email.toLowerCase(),
      password: plainPassword,
      phone: newDoctor.phone,
      role: "DOCTOR",
      parentId: reviewerId,
      isEmailVerified: false,
      license: newDoctor.license,
      hospital: newDoctor.hospital,
      specialization: newDoctor.specialization,
      address: newDoctor.address,
      city: newDoctor.city,
      state: newDoctor.state,
      commissionType: newDoctor.commissionType,
      commissionRate: newDoctor.commissionRate,
    });

    // Create wallet
    // try {
    //   await createWallet(newUser.id, "DOCTOR");
    // } catch (err: any) {
    //   warnings.push(`Wallet creation failed: ${err.message}`);
    // }

    // Register on Cashfree
    // try {
    //   const cfResult = await createCashfreeVendor({
    //     vendorId: newUser.id,
    //     name: newDoctor.fullName,
    //     email: newDoctor.email.toLowerCase(),
    //     phone: newDoctor.phone,
    //     role: "DOCTOR",
    //     bank: newDoctor.bank,
    //   });
    //   await newUser.update({ cashfreeVendorId: cfResult.vendor_id });
    // } catch (err: any) {
    //   warnings.push(`Cashfree registration failed: ${err.message}`);
    // }

    // Send credentials email
    try {
      await sendPasswordEmail(newDoctor.email, plainPassword, "DOCTOR", newDoctor.fullName);
    } catch (err: any) {
      warnings.push(`Credential email failed: ${err.message}`);
    }

    doctorId = newUser.id;
    doctorCreated = true;
  }

  suggestion.status = "APPROVED";
  suggestion.reviewedBy = reviewerId;
  suggestion.reviewedAt = new Date();
  suggestion.onboardedDoctorId = doctorId || undefined;
  await suggestion.save();

  return { suggestion, doctorCreated, warnings: warnings.length > 0 ? warnings : undefined };
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
