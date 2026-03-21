import { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../utils/constants";
import { responseMiddleware } from "../utils/response";
import * as signupService from "../service/patientSelfSignup.service";

// ── Zod Schemas ──────────────────────────────────────────────────────────

const sendOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  otp: z.string().min(4, "OTP must be at least 4 digits").max(6, "OTP must be at most 6 digits"),
  // Profile fields — required only for new signups, optional for login
  fullName: z.string().min(2).max(255).optional(),
  age: z.number().int().min(0).max(100).optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  caseType: z.enum([
    "PERI_OPERATIVE",
    "POST_OPERATIVE",
    "FOLLOW_UP",
    "CHEMOTHERAPY",
    "RADIOLOGY",
  ]).optional(),
});

// ── Controllers ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/patient/self-signup/send-otp
 * Unified Step 1: Send OTP to phone for both signup and login.
 * Returns { isExistingUser } so the frontend knows whether to show
 * the profile form (new user) or go straight to OTP verification (existing user).
 */
export const sendSignupOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await signupService.sendSignupOtp(parsed.data.phone);
    responseMiddleware(res, HTTP_STATUS.OK, result.message, {
      isExistingUser: result.isExistingUser,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to send OTP");
  }
};

/**
 * POST /api/v1/patient/self-signup/verify
 * Unified Step 2: Verify OTP — logs in existing users or signs up new users.
 * - Existing user: send { phone, otp } → returns JWT
 * - New user: send { phone, otp, fullName, age, gender, caseType } → creates account + returns JWT
 */
export const verifySignupOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const { phone, otp, fullName, age, gender, caseType } = parsed.data;

    // Build profile object only if profile fields are provided
    const profile = fullName && age !== undefined && gender && caseType
      ? { fullName, age, gender, caseType }
      : undefined;

    const result = await signupService.verifySignupOtp(phone, otp, profile);

    const statusCode = result.isNewUser ? HTTP_STATUS.CREATED : HTTP_STATUS.OK;
    const message = result.isNewUser ? "Account created successfully" : "Login successful";

    res.status(statusCode).json({
      success: true,
      message,
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to verify OTP");
  }
};

/**
 * GET /api/v1/patient/self-signup/doctors?page=1&limit=10&search=oncology
 * Public paginated list of available doctors for patient selection
 */
export const listDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string) || undefined;

    const result = await signupService.listAvailableDoctors({ page, limit, search });
    responseMiddleware(res, HTTP_STATUS.OK, "Doctors fetched", result);
  } catch (error: unknown) {
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch doctors");
  }
};
