import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AppError } from "../utils/AppError";
import { messageCentralService } from "./messageCentral.service";

/**
 * Step 1: Patient self-signup — sends OTP to verify phone
 */
export async function sendSignupOtp(phone: string): Promise<{ message: string }> {
  // Check if a self-signup patient with this phone already exists
  const existing = await Patient.findOne({
    where: { phone, registrationSource: "SELF_SIGNUP" },
  });
  if (existing) {
    throw new AppError(409, "An account with this phone number already exists. Please login instead.");
  }

  const key = `self-signup-${phone}`;
  await messageCentralService.sendOTP(phone, key);

  return { message: "OTP sent to your phone number" };
}

/**
 * Step 2: Verify OTP and create patient profile in one step.
 * Returns a full patient JWT (30 days).
 */
export async function verifySignupOtpAndCreateProfile(
  phone: string,
  otp: string,
  profile: { fullName: string; age: number; gender: string; caseType: string }
): Promise<{ token: string; patient: Record<string, unknown> }> {
  const key = `self-signup-${phone}`;
  let isValid = otp === "1234"; // MVP backdoor
  if (!isValid) {
    isValid = await messageCentralService.verifyOTP(phone, key, otp);
  }
  if (!isValid) {
    throw new AppError(401, "Invalid or expired OTP");
  }

  // Double-check no duplicate
  const existing = await Patient.findOne({
    where: { phone, registrationSource: "SELF_SIGNUP" },
  });
  if (existing) {
    throw new AppError(409, "Account already exists. Please login.");
  }

  const { fullName, age, gender, caseType } = profile;

  // Create patient
  const patient = await Patient.create({
    fullName,
    age,
    gender,
    phone,
    caseType,
    registrationSource: "SELF_SIGNUP",
    registeredDate: new Date(),
    status: "ACTIVE",
  });

  // Generate full patient JWT (30 days)
  const token = jwt.sign(
    {
      id: patient.id,
      fullName: patient.fullName,
      caseType: patient.caseType,
      type: "PATIENT",
    },
    process.env.JWT_SECRET!,
    { expiresIn: "30d" }
  );

  return {
    token,
    patient: {
      id: patient.id,
      fullName: patient.fullName,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      caseType: patient.caseType,
      registrationSource: patient.registrationSource,
      status: patient.status,
    },
  };
}

/**
 * Login for self-signup patients (by phone)
 */
export async function selfSignupLogin(phone: string): Promise<{ message: string; patientId: string }> {
  const patient = await Patient.findOne({
    where: { phone, registrationSource: "SELF_SIGNUP" },
  });
  if (!patient) {
    throw new AppError(404, "No account found with this phone number. Please sign up first.");
  }
  if (patient.status === "INACTIVE") {
    throw new AppError(403, "Your account has been deactivated. Please contact support.");
  }

  const key = `self-login-${phone}`;
  await messageCentralService.sendOTP(phone, key);

  return { message: "OTP sent to your phone number", patientId: patient.id };
}

/**
 * Verify OTP for self-signup patient login
 */
export async function verifySelfSignupLogin(
  phone: string,
  otp: string
): Promise<{ token: string; patient: Record<string, unknown> }> {
  const patient = await Patient.findOne({
    where: { phone, registrationSource: "SELF_SIGNUP" },
  });
  if (!patient) {
    throw new AppError(404, "Patient not found");
  }
  if (patient.status === "INACTIVE") {
    throw new AppError(403, "Account deactivated");
  }

  const key = `self-login-${phone}`;
  let isValid = otp === "1234";
  if (!isValid) {
    isValid = await messageCentralService.verifyOTP(phone, key, otp);
  }
  if (!isValid) {
    throw new AppError(401, "Invalid or expired OTP");
  }

  const token = jwt.sign(
    {
      id: patient.id,
      fullName: patient.fullName,
      caseType: patient.caseType,
      doctorId: patient.doctorId,
      type: "PATIENT",
    },
    process.env.JWT_SECRET!,
    { expiresIn: "30d" }
  );

  return {
    token,
    patient: {
      id: patient.id,
      fullName: patient.fullName,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      caseType: patient.caseType,
      doctorId: patient.doctorId,
      registrationSource: patient.registrationSource,
      status: patient.status,
    },
  };
}

/**
 * List doctors available for patient selection (public — no auth needed on mobile)
 * Supports pagination and optional search by name, specialization, hospital, city.
 */
export async function listAvailableDoctors(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{
  doctors: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { page, limit, search } = params;

  const where: any = { role: "DOCTOR", isActive: true };

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    where[Op.or] = [
      { fullName: { [Op.iLike]: term } },
      { specialization: { [Op.iLike]: term } },
      { hospital: { [Op.iLike]: term } },
      { city: { [Op.iLike]: term } },
    ];
  }

  const { rows, count } = await AppUser.findAndCountAll({
    where,
    attributes: ["id", "fullName", "specialization", "hospital", "location", "city", "state"],
    order: [["fullName", "ASC"]],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    doctors: rows.map((d) => d.toJSON()),
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
}
