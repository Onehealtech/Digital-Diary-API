"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPatientOTP = exports.patientLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Patient_1 = require("../models/Patient");
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
    return {
        message: "OTP Required. Please enter the verification code.",
        diaryId,
    };
};
exports.patientLogin = patientLogin;
/**
 * Patient Login - Step 2: Verify OTP (hardcoded for MVP) and return JWT
 */
const verifyPatientOTP = async (diaryId, otp) => {
    // MVP: Hardcoded OTP validation
    if (otp !== "1234") {
        throw new Error("Invalid OTP");
    }
    // Get patient details
    const patient = await Patient_1.Patient.findOne({
        where: { diaryId },
        attributes: ["id", "diaryId", "fullName", "age", "status", "caseType", "doctorId"],
    });
    if (!patient) {
        throw new Error("Patient not found");
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
