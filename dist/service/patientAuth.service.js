"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPatientOTP = exports.patientLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Patient_1 = require("../models/Patient");
const messageCentral_service_1 = require("./messageCentral.service");
/**
 * Patient Login - Step 1: Validate sticker and send OTP via Message Central
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
    // Send OTP via Message Central
    const phone = patient.phone;
    if (phone) {
        await messageCentral_service_1.messageCentralService.sendOTP(phone, diaryId);
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
 * Patient Login - Step 2: Verify OTP via Message Central
 */
const verifyPatientOTP = async (diaryId, otp) => {
    // Get patient details first (need phone for verification)
    const patient = await Patient_1.Patient.findOne({
        where: { diaryId },
        attributes: ["id", "diaryId", "fullName", "age", "status", "caseType", "doctorId", "phone"],
    });
    if (!patient) {
        throw new Error("Patient not found");
    }
    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }
    // MVP: "1234" backdoor for testing. Remove in production.
    let isValid = otp === "1234";
    if (!isValid && patient.phone) {
        isValid = await messageCentral_service_1.messageCentralService.verifyOTP(patient.phone, diaryId, otp);
    }
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
