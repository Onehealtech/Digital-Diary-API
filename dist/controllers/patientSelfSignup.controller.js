"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDoctors = exports.verifySignupOtp = exports.sendSignupOtp = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../utils/AppError");
const constants_1 = require("../utils/constants");
const response_1 = require("../utils/response");
const signupService = __importStar(require("../service/patientSelfSignup.service"));
const translations_1 = require("../utils/translations");
// ── Zod Schemas ──────────────────────────────────────────────────────────
const sendOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});
const verifyOtpSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid("Invalid session ID"),
    otp: zod_1.z.string().min(4, "OTP must be at least 4 digits").max(6, "OTP must be at most 6 digits"),
    // Profile fields — required only for new signups, optional for login
    fullName: zod_1.z.string().min(2).max(255).optional(),
    age: zod_1.z.number().int().min(0).max(100).optional(),
    gender: zod_1.z.enum(["Male", "Female", "Other"]).optional(),
    caseType: zod_1.z.enum([
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
const sendSignupOtp = async (req, res) => {
    try {
        const parsed = sendOtpSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await signupService.sendSignupOtp(parsed.data.phone);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, result.message, {
            isExistingUser: result.isExistingUser,
            sessionId: result.sessionId,
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to send OTP");
    }
};
exports.sendSignupOtp = sendSignupOtp;
/**
 * POST /api/v1/patient/self-signup/verify
 * Unified Step 2: Verify OTP — logs in existing users or signs up new users.
 * - Existing user: send { sessionId, otp } → returns JWT
 * - New user: send { sessionId, otp, fullName, age, gender, caseType } → creates account + returns JWT
 */
const verifySignupOtp = async (req, res) => {
    try {
        const parsed = verifyOtpSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const { sessionId, otp, fullName, age, gender, caseType } = parsed.data;
        // Build profile object only if profile fields are provided
        const profile = fullName && age !== undefined && gender && caseType
            ? { fullName, age, gender, caseType }
            : undefined;
        const result = await signupService.verifySignupOtp(sessionId, otp, profile);
        const statusCode = result.isNewUser ? constants_1.HTTP_STATUS.CREATED : constants_1.HTTP_STATUS.OK;
        const message = result.isNewUser ? "Account created successfully" : "Login successful";
        res.status(statusCode).json({
            success: true,
            message,
            data: result,
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to verify OTP");
    }
};
exports.verifySignupOtp = verifySignupOtp;
/**
 * GET /api/v1/patient/self-signup/doctors?page=1&limit=10&search=oncology
 * Public paginated list of available doctors for patient selection
 */
const listDoctors = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const search = req.query.search || undefined;
        const lang = (req.user?.language || "en");
        const result = await signupService.listAvailableDoctors({ page, limit, search });
        // Translate doctor info for Hindi (?lang=hi)
        if (lang === "hi") {
            result.doctors = await (0, translations_1.translateArrayFields)(result.doctors, ["specialization", "hospital", "location", "address", "city", "state"], lang, ["fullName"] // names → transliterate (phonetic)
            );
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Doctors fetched", result);
    }
    catch (error) {
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch doctors");
    }
};
exports.listDoctors = listDoctors;
