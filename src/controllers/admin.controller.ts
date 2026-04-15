import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import { AppUser } from "../models/Appuser";
import { generateSecurePassword } from "../utils/passwordUtils";
import { sendPasswordEmail } from "../service/emailService";
import { createWallet } from "../service/wallet.service";
import { AppError } from "../utils/AppError";
import { createDoctorService } from "../service/doctorCreation.service";
import { registerCashfreeVendor } from "../service/cashfreeOnboarding.service";

const walletTypeMap: Record<string, "VENDOR" | "DOCTOR" | "PLATFORM"> = {
  VENDOR: "VENDOR",
  DOCTOR: "DOCTOR",
  SUPER_ADMIN: "PLATFORM",
};

export const createStaff = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      fullName,
      email,
      phone,
      role,
      bank,
      upi,
      license,
      hospital,
      specialization,
      GST,
      address,
      city,
      state,
      commissionType,
      commissionRate,
      landLinePhone,
    } = req.body;

    if (!fullName || !email || !role) {
      res.status(400).json({
        success: false,
        message: "Full name, email, and role are required",
      });
      return;
    }

    const creatableRoles: UserRole[] = [
      UserRole.DOCTOR,
      UserRole.VENDOR,
      UserRole.SUPER_ADMIN,
    ];

    if (!creatableRoles.includes(role as UserRole)) {
      res.status(400).json({
        success: false,
        message: `Invalid role. Super Admin can create: ${creatableRoles.join(", ")}`,
      });
      return;
    }

    // Doctor flow (primary + secondary split)
    if (role === UserRole.DOCTOR) {
      const doctor = await createDoctorService({
        fullName,
        email,
        phone,
        license,
        hospital,
        specialization,
        GST,
        address,
        city,
        state,
        commissionType,
        commissionRate,
        landLinePhone,
        bank,
        createdBy: req.user!.id,
      });

      let cashfree: { status: "SUCCESS" } | { status: "FAILED"; message: string } = {
        status: "SUCCESS",
      };

      // Secondary operation: non-blocking. Doctor creation must not fail due to Cashfree.
      // TODO: move this to a background queue/job for retryable async onboarding.
      try {
        await registerCashfreeVendor({ userId: doctor.id, bank, upi });
      } catch (cfError: unknown) {
        const detail = cfError instanceof Error ? cfError.message : "Unknown error";
        console.error(`Cashfree onboarding failed for doctor ${doctor.id}:`, detail);
        cashfree = {
          status: "FAILED",
          message: "Cashfree onboarding failed. Please retry.",
        };
      }

      // Refresh to include latest cashfreeVendorId if onboarding succeeded.
      await doctor.reload();

      res.status(201).json({
        success: true,
        message: "Doctor created successfully",
        cashfree,
        data: {
          id: doctor.id,
          fullName: doctor.fullName,
          email: doctor.email,
          role: doctor.role,
          cashfreeVendorId: doctor.cashfreeVendorId || null,
          createdBy: req.user!.id,
        },
      });
      return;
    }

    // Non-doctor flow (existing behavior retained for VENDOR/SUPER_ADMIN).
    const existingUser = await AppUser.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
      return;
    }

    const plainPassword = generateSecurePassword();

    const newUser = await AppUser.create({
      fullName,
      email: email.toLowerCase(),
      password: plainPassword,
      phone,
      role,
      parentId: req.user!.id,
      isEmailVerified: false,
      license,
      hospital,
      specialization,
      commissionType,
      commissionRate,
      GST,
      address,
      city,
      state,
      landLinePhone,
      bankDetails: bank,
    });

    if (role === UserRole.VENDOR || role === UserRole.DOCTOR) {
      const walletType = walletTypeMap[role];
      if (walletType) {
        await createWallet(newUser.id, walletType);
      }
    }

    await sendPasswordEmail(email, plainPassword, role, fullName);

    res.status(201).json({
      success: true,
      message: `${role} created successfully. Credentials sent to ${email}.`,
      data: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        createdBy: req.user!.id,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Failed to create staff member";
    console.error("Create staff error:", message);
    res.status(500).json({
      success: false,
      message,
    });
  }
};

/**
 * Retry Cashfree onboarding.
 * Idempotent by design: already-onboarded users return success without duplicate vendor creation.
 */
export const retryCashfreeOnboarding = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = (req.params.userId || req.params.id) as string;
    const { bank, upi } = req.body;

    const result = await registerCashfreeVendor({ userId, bank, upi });

    if (result.status === "ALREADY_REGISTERED") {
      res.status(200).json({
        success: true,
        message: "User is already registered on Cashfree",
        cashfree: {
          status: "ALREADY_REGISTERED",
          vendorId: result.vendorId,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Cashfree vendor onboarding completed",
      cashfree: {
        status: "SUCCESS",
        vendorId: result.vendorId,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Failed to register on Cashfree";
    console.error("Retry Cashfree onboarding error:", message);
    res.status(500).json({
      success: false,
      message,
    });
  }
};
