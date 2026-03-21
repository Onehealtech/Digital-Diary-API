import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AppError } from "../utils/AppError";
import { generateOTP, verifyOTP } from "./otpService";
import { twilioService } from "./twilio.service";

/**
 * Step 1: Send OTP to phone — works for both new and existing patients.
 * - If account exists → sends OTP for login (returns isExistingUser: true)
 * - If account does not exist → sends OTP for signup (returns isExistingUser: false)
 */
export async function sendSignupOtp(
  phone: string
): Promise<{ message: string; isExistingUser: boolean }> {
  const existing = await Patient.findOne({
    where: { phone, registrationSource: "SELF_SIGNUP" },
  });

  // Block inactive accounts
  if (existing && existing.status === "INACTIVE") {
    throw new AppError(403, "Your account has been deactivated. Please contact support.");
  }

  const key = `self-otp-${phone}`;
  const otp = generateOTP(key);

  const sent = await twilioService.sendOTP(phone, otp);
  if (!sent) {
    console.warn(`Failed to send OTP to ${phone}`);
  }

  return {
    message: "OTP sent to your phone number",
    isExistingUser: !!existing,
  };
}

/**
 * Step 2: Verify OTP — handles both login and signup in one function.
 * - If account exists → verify OTP and return JWT (login)
 * - If account does not exist → verify OTP, create profile, return JWT (signup)
 *
 * Profile fields (fullName, age, gender, caseType) are required only for new signups.
 */
export async function verifySignupOtp(
  phone: string,
  otp: string,
  profile?: { fullName: string; age: number; gender: string; caseType: string }
): Promise<{ token: string; patient: Record<string, unknown>; isNewUser: boolean }> {
  const key = `self-otp-${phone}`;

  const isValid = verifyOTP(key, otp);
  if (!isValid) {
    throw new AppError(401, "Invalid or expired OTP");
  }

  // Check if patient already exists
  const existing = await Patient.findOne({
    where: { phone, registrationSource: "SELF_SIGNUP" },
  });

  if (existing) {
    // --- LOGIN flow ---
    if (existing.status === "INACTIVE") {
      throw new AppError(403, "Your account has been deactivated. Please contact support.");
    }

    const token = jwt.sign(
      {
        id: existing.id,
        fullName: existing.fullName,
        caseType: existing.caseType,
        doctorId: existing.doctorId,
        type: "PATIENT",
      },
      process.env.JWT_SECRET!,
      { expiresIn: "30d" }
    );

    return {
      token,
      patient: {
        id: existing.id,
        fullName: existing.fullName,
        age: existing.age,
        gender: existing.gender,
        phone: existing.phone,
        caseType: existing.caseType,
        doctorId: existing.doctorId,
        registrationSource: existing.registrationSource,
        status: existing.status,
      },
      isNewUser: false,
    };
  }

  // --- SIGNUP flow ---
  if (!profile || !profile.fullName || !profile.age || !profile.gender || !profile.caseType) {
    throw new AppError(400, "Profile details (fullName, age, gender, caseType) are required for new registration");
  }

  const { fullName, age, gender, caseType } = profile;

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
    isNewUser: true,
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
