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
  fullName: z.string().min(2, "Full name is required").max(255),
  age: z.number().int().min(0, "Age must be 0–100").max(100, "Age must be 0–100"),
  gender: z.enum(["Male", "Female", "Other"]),
  caseType: z.enum([
    "PERI_OPERATIVE",
    "POST_OPERATIVE",
    "FOLLOW_UP",
    "CHEMOTHERAPY",
    "RADIOLOGY",
  ]),
});

const loginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});

const verifyLoginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

// ── Controllers ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/patient/self-signup/send-otp
 * Step 1: Send OTP to phone for self-signup
 */
export const sendSignupOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await signupService.sendSignupOtp(parsed.data.phone);
    responseMiddleware(res, HTTP_STATUS.OK, result.message);
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
 * Step 2: Verify OTP and create patient profile in one step
 */
export const verifySignupOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const { phone, otp, fullName, age, gender, caseType } = parsed.data;
    const result = await signupService.verifySignupOtpAndCreateProfile(phone, otp, {
      fullName,
      age,
      gender,
      caseType,
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Account created successfully",
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create account");
  }
};

/**
 * POST /api/v1/patient/self-signup/login
 * Self-signup patient login — sends OTP
 */
export const selfSignupLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await signupService.selfSignupLogin(parsed.data.phone);
    responseMiddleware(res, HTTP_STATUS.OK, result.message, { patientId: result.patientId });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to send OTP");
  }
};

/**
 * POST /api/v1/patient/self-signup/verify-login
 * Self-signup patient verify OTP and get JWT
 */
export const verifySelfSignupLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = verifyLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await signupService.verifySelfSignupLogin(parsed.data.phone, parsed.data.otp);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Login successful",
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
