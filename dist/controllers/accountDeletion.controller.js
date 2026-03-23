"use strict";
// src/controllers/accountDeletion.controller.ts
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
exports.deleteAccount = exports.requestDeleteOTP = void 0;
const zod_1 = require("zod");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const AppError_1 = require("../utils/AppError");
const Patient_1 = require("../models/Patient");
const otpService_1 = require("../service/otpService");
const twilio_service_1 = require("../service/twilio.service");
const accountDeletionService = __importStar(require("../service/accountDeletion.service"));
const deleteAccountSchema = zod_1.z.object({
    reason: zod_1.z.string().max(500).optional(),
    confirmDelete: zod_1.z.literal(true, {
        errorMap: () => ({ message: "You must confirm deletion by setting confirmDelete to true" }),
    }),
    otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
});
/**
 * POST /api/v1/account/request-delete-otp
 * Step 1: Send OTP to patient's phone before account deletion
 */
const requestDeleteOTP = async (req, res) => {
    try {
        const patientId = req.user.id;
        const patient = await Patient_1.Patient.findByPk(patientId, { attributes: ["id", "phone", "status"] });
        if (!patient) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.NOT_FOUND, "Patient not found");
            return;
        }
        if (patient.status === "INACTIVE") {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "Account is already deleted");
            return;
        }
        if (!patient.phone) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "No phone number on file. Please contact support to delete your account.");
            return;
        }
        // Generate OTP keyed by "delete:{patientId}" to avoid collisions with login OTPs
        const otpKey = `delete:${patientId}`;
        const otp = (0, otpService_1.generateOTP)(otpKey);
        // Send OTP via SMS
        await twilio_service_1.twilioService.sendOTP(patient.phone, otp);
        console.log(`Account deletion OTP for patient ${patientId}: ${otp}`);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "OTP sent to your registered phone number. Please verify to proceed with account deletion.");
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to send OTP";
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.requestDeleteOTP = requestDeleteOTP;
/**
 * DELETE /api/v1/account/delete
 * Step 2: Verify OTP and delete patient account (Google Play Store compliance)
 */
const deleteAccount = async (req, res) => {
    try {
        const patientId = req.user.id;
        const parsed = deleteAccountSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        // Verify OTP
        const otpKey = `delete:${patientId}`;
        const isValid = (0, otpService_1.verifyOTP)(otpKey, parsed.data.otp);
        if (!isValid) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "Invalid or expired OTP. Please request a new one.");
            return;
        }
        const result = await accountDeletionService.deletePatientAccount(patientId, parsed.data.reason);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "User account and data deleted successfully", result);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to delete account";
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.deleteAccount = deleteAccount;
