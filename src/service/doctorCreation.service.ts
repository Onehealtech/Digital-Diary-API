import { AppUser } from "../models/Appuser";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS, UserRole } from "../utils/constants";
import { generateSecurePassword } from "../utils/passwordUtils";
import { sendPasswordEmail } from "./emailService";
import { createWallet } from "./wallet.service";

type BankDetailsInput = {
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
};

export type CreateDoctorServiceInput = {
  fullName: string;
  email: string;
  phone?: string;
  license?: string;
  hospital?: string;
  specialization?: string;
  GST?: string;
  address?: string;
  city?: string;
  state?: string;
  commissionType?: string;
  commissionRate?: number;
  landLinePhone?: string;
  bank?: BankDetailsInput;
  createdBy: string;
};

/**
 * Primary operation: create doctor account and complete core setup.
 * Cashfree onboarding is intentionally excluded and handled separately.
 */
export const createDoctorService = async (
  input: CreateDoctorServiceInput
) => {
  const normalizedEmail = input.email.toLowerCase().trim();

  const existingDoctor = await AppUser.findOne({
    where: { email: normalizedEmail },
  });

  if (existingDoctor) {
    throw new AppError(HTTP_STATUS.CONFLICT, "User with this email already exists");
  }

  const plainPassword = generateSecurePassword();

  const doctor = await AppUser.create({
    fullName: input.fullName,
    email: normalizedEmail,
    password: plainPassword,
    phone: input.phone,
    role: UserRole.DOCTOR,
    parentId: input.createdBy,
    isEmailVerified: false,
    license: input.license,
    hospital: input.hospital,
    specialization: input.specialization,
    commissionType: input.commissionType,
    commissionRate: input.commissionRate,
    GST: input.GST,
    address: input.address,
    city: input.city,
    state: input.state,
    landLinePhone: input.landLinePhone,
    bankDetails: input.bank,
  });

  // Core doctor setup step.
  await createWallet(doctor.id, "DOCTOR");

  // Send credentials as part of doctor creation workflow.
  await sendPasswordEmail(normalizedEmail, plainPassword, UserRole.DOCTOR, input.fullName);

  return doctor;
};

