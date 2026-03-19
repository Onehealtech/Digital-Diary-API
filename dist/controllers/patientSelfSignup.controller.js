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
exports.listDoctors = exports.verifySelfSignupLogin = exports.selfSignupLogin = exports.completeProfile = exports.verifySignupOtp = exports.sendSignupOtp = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../utils/AppError");
const constants_1 = require("../utils/constants");
const response_1 = require("../utils/response");
const signupService = __importStar(require("../service/patientSelfSignup.service"));
// ── Zod Schemas ──────────────────────────────────────────────────────────
const sendOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});
const verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
    otp: zod_1.z.string().min(4, "OTP must be at least 4 digits").max(6, "OTP must be at most 6 digits"),
});
const completeProfileSchema = zod_1.z.object({
    signupToken: zod_1.z.string().min(1, "Signup token is required"),
    fullName: zod_1.z.string().min(2, "Full name is required").max(255),
    age: zod_1.z.number().int().min(0, "Age must be 0–100").max(100, "Age must be 0–100"),
    gender: zod_1.z.enum(["Male", "Female", "Other"]),
    caseType: zod_1.z.enum([
        "PERI_OPERATIVE",
        "POST_OPERATIVE",
        "FOLLOW_UP",
        "CHEMOTHERAPY",
        "RADIOLOGY",
    ]),
});
const loginSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});
const verifyLoginSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
    otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
});
// ── Controllers ──────────────────────────────────────────────────────────
/**
 * POST /api/v1/patient/self-signup/send-otp
 * Step 1: Send OTP to phone for self-signup
 */
const sendSignupOtp = async (req, res) => {
    try {
        const parsed = sendOtpSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await signupService.sendSignupOtp(parsed.data.phone);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, result.message);
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
 * Step 2: Verify OTP only — returns a short-lived signup token (10 min)
 */
const verifySignupOtp = async (req, res) => {
    try {
        const parsed = verifyOtpSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await signupService.verifySignupOtp(parsed.data.phone, parsed.data.otp);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "OTP verified successfully", result);
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
 * POST /api/v1/patient/self-signup/complete-profile
 * Step 3: Submit profile details using the signup token from step 2
 */
const completeProfile = async (req, res) => {
    try {
        const parsed = completeProfileSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await signupService.completeSignupProfile(parsed.data);
        res.status(constants_1.HTTP_STATUS.CREATED).json({
            success: true,
            message: "Account created successfully",
            data: result,
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create account");
    }
};
exports.completeProfile = completeProfile;
/**
 * POST /api/v1/patient/self-signup/login
 * Self-signup patient login — sends OTP
 */
const selfSignupLogin = async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await signupService.selfSignupLogin(parsed.data.phone);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, result.message, { patientId: result.patientId });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to send OTP");
    }
};
exports.selfSignupLogin = selfSignupLogin;
/**
 * POST /api/v1/patient/self-signup/verify-login
 * Self-signup patient verify OTP and get JWT
 */
const verifySelfSignupLogin = async (req, res) => {
    try {
        const parsed = verifyLoginSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await signupService.verifySelfSignupLogin(parsed.data.phone, parsed.data.otp);
        res.status(constants_1.HTTP_STATUS.OK).json({
            success: true,
            message: "Login successful",
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
exports.verifySelfSignupLogin = verifySelfSignupLogin;
/**
 * GET /api/v1/patient/self-signup/doctors?page=1&limit=10&search=oncology
 * Public paginated list of available doctors for patient selection
 */
const listDoctors = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const search = req.query.search || undefined;
        const result = await signupService.listAvailableDoctors({ page, limit, search });
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Doctors fetched", result);
    }
    catch (error) {
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch doctors");
    }
};
exports.listDoctors = listDoctors;
