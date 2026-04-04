"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPatientOTP = exports.patientLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Patient_1 = require("../models/Patient");
const Diary_1 = require("../models/Diary");
const otpService_1 = require("./otpService");
const twilio_service_1 = require("./twilio.service");
/**
 * Patient Login - Step 1: Validate sticker and send OTP via SMS (Twilio)
 * Patients receive OTP on mobile only.
 */
const patientLogin = async (diaryId) => {
    // Check if sticker exists
    const patient = await Patient_1.Patient.findOne({
        where: { diaryId },
        include: [{ model: Diary_1.Diary, as: "diary", attributes: ["status"] }],
    });
    if (!patient) {
        throw new Error("Invalid sticker ID. Please check your diary.");
    }
    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }
    const diary = patient.diary;
    if (diary?.status === "pending") {
        throw new Error("Your diary is not yet approved by the admin. Please wait for approval.");
    }
    if (diary?.status === "rejected") {
        throw new Error("Your diary has been rejected. Please contact your doctor.");
    }
    // Generate OTP locally and send via Twilio SMS
    const phone = patient.phone;
    if (phone) {
        const otp = (0, otpService_1.generateOTP)(diaryId);
        const sent = await twilio_service_1.twilioService.sendOTP(phone, otp);
        if (!sent) {
            console.warn(`Failed to send OTP SMS to ${phone} for diary ${diaryId}`);
        }
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
 * Patient Login - Step 2: Verify OTP (locally generated, verified in-memory)
 * Patients verify via SMS OTP only.
 */
const verifyPatientOTP = async (diaryId, otp) => {
    // Get patient details
    const patient = await Patient_1.Patient.findOne({
        where: { diaryId },
        attributes: ["id", "diaryId", "fullName", "age", "status", "caseType", "doctorId", "phone"],
        include: [{ model: Diary_1.Diary, as: "diary", attributes: ["status"] }],
    });
    if (!patient) {
        throw new Error("Patient not found");
    }
    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }
    const diary = patient.diary;
    if (diary?.status === "pending") {
        throw new Error("Your diary is not yet approved by the admin. Please wait for approval.");
    }
    if (diary?.status === "rejected") {
        throw new Error("Your diary has been rejected. Please contact your doctor.");
    }
    // Verify OTP from local store (keyed by diaryId)
    const isValid = (0, otpService_1.verifyOTP)(diaryId, otp);
    if (!isValid) {
        throw new Error("Invalid or expired OTP");
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
