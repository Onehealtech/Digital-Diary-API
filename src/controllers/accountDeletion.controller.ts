// src/controllers/accountDeletion.controller.ts

import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";
import { AppError } from "../utils/AppError";
import { Patient } from "../models/Patient";
import { generateOTP, verifyOTP } from "../service/otpService";
import { twilioService } from "../service/twilio.service";
import * as accountDeletionService from "../service/accountDeletion.service";

const deleteAccountSchema = z.object({
  reason: z.string().max(500).optional(),
  confirmDelete: z.literal(true, {
    errorMap: () => ({ message: "You must confirm deletion by setting confirmDelete to true" }),
  }),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

/**
 * POST /api/v1/account/request-delete-otp
 * Step 1: Send OTP to patient's phone before account deletion
 */
export const requestDeleteOTP = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = (req.user as { id: string }).id;

    const patient = await Patient.findByPk(patientId, { attributes: ["id", "phone", "status"] });
    if (!patient) {
      responseMiddleware(res, HTTP_STATUS.NOT_FOUND, "Patient not found");
      return;
    }

    if (patient.status === "INACTIVE") {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, "Account is already deleted");
      return;
    }

    if (!patient.phone) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, "No phone number on file. Please contact support to delete your account.");
      return;
    }

    // Generate OTP keyed by "delete:{patientId}" to avoid collisions with login OTPs
    const otpKey = `delete:${patientId}`;
    const otp = generateOTP(otpKey);

    // Send OTP via SMS
    await twilioService.sendOTP(patient.phone, otp);

    console.log(`Account deletion OTP for patient ${patientId}: ${otp}`);

    responseMiddleware(res, HTTP_STATUS.OK, "OTP sent to your registered phone number. Please verify to proceed with account deletion.");
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to send OTP";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

/**
 * DELETE /api/v1/account/delete
 * Step 2: Verify OTP and delete patient account (Google Play Store compliance)
 */
export const deleteAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = (req.user as { id: string }).id;

    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    // Verify OTP
    const otpKey = `delete:${patientId}`;
    const isValid = verifyOTP(otpKey, parsed.data.otp);
    if (!isValid) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, "Invalid or expired OTP. Please request a new one.");
      return;
    }

    const result = await accountDeletionService.deletePatientAccount(
      patientId,
      parsed.data.reason
    );

    responseMiddleware(res, HTTP_STATUS.OK, "User account and data deleted successfully", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to delete account";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};
