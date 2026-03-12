"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPatientOTP = exports.patientLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Patient_1 = require("../models/Patient");
const otpService_1 = require("./otpService");
const twilioService_1 = require("./twilioService");
/**
 * Patient Login - Step 1: Validate sticker and request OTP
 */
const patientLogin = async (diaryId) => {
    // Check if sticker exists
    const patient = await Patient_1.Patient.findOne({
        where: { diaryId },
    });
    if (!patient) {
        throw new Error("Invalid sticker ID. Please check your diary.");
    }
    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }
    // Generate and send OTP via Twilio
    const phone = patient.phone;
    if (phone) {
        // We use diaryId as the key for OTP instead of email
        const otp = (0, otpService_1.generateOTP)(diaryId);
        const smsMessage = `Your OneHeal verification code is ${otp}. It will expire in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.`;
        await twilioService_1.twilioService.sendSMS(phone, smsMessage);
    }
    else {
        console.warn(`No phone number recorded for patient ${diaryId}. OTP not sent via SMS.`);
    }
    return {
        message: "OTP sent. Please enter the verification code.",
        diaryId,
        phone,
    };
};
exports.patientLogin = patientLogin;
/**
 * Patient Login - Step 2: Verify OTP
 */
const verifyPatientOTP = async (diaryId, otp) => {
    // MVP: For ease of testing, 1234 can remain a backdoor. Otherwise it validates against memory.
    // In production, you might remove the "1234" backdoor entirely.
    const isValid = (0, otpService_1.verifyOTP)(diaryId, otp) || otp === "1234";
    if (!isValid) {
        throw new Error("Invalid or expired OTP");
    }
    // Get patient details
    const patient = await Patient_1.Patient.findOne({
        where: { diaryId },
        attributes: ["id", "diaryId", "fullName", "age", "status", "caseType", "doctorId"],
    });
    if (!patient) {
        throw new Error("Patient not found");
    }
    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }
    // Generate long-lived JWT token (30 days for illiterate users)
    const token = jsonwebtoken_1.default.sign({
        id: patient.id,
        diaryId: patient.diaryId,
        fullName: patient.fullName,
        caseType: patient.caseType,
        type: "PATIENT",
    }, process.env.JWT_SECRET, { expiresIn: "30d" });
    return {
        token,
        patient: {
            id: patient.id,
            diaryId: patient.diaryId,
            fullName: patient.fullName,
            age: patient.age,
            status: patient.status,
            caseType: patient.caseType,
        },
    };
};
exports.verifyPatientOTP = verifyPatientOTP;
