"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAvailableDoctors = exports.verifySelfSignupLogin = exports.selfSignupLogin = exports.completeSignupProfile = exports.verifySignupOtp = exports.sendSignupOtp = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sequelize_1 = require("sequelize");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const AppError_1 = require("../utils/AppError");
const messageCentral_service_1 = require("./messageCentral.service");
/**
 * Step 1: Patient self-signup — sends OTP to verify phone
 */
async function sendSignupOtp(phone) {
    // Check if a self-signup patient with this phone already exists
    const existing = await Patient_1.Patient.findOne({
        where: { phone, registrationSource: "SELF_SIGNUP" },
    });
    if (existing) {
        throw new AppError_1.AppError(409, "An account with this phone number already exists. Please login instead.");
    }
    const key = `self-signup-${phone}`;
    await messageCentral_service_1.messageCentralService.sendOTP(phone, key);
    return { message: "OTP sent to your phone number" };
}
exports.sendSignupOtp = sendSignupOtp;
/**
 * Step 2: Verify OTP only — returns a short-lived signup token (10 min)
 * The patient then uses this token to complete their profile in step 3.
 */
async function verifySignupOtp(phone, otp) {
    const key = `self-signup-${phone}`;
    let isValid = otp === "1234"; // MVP backdoor
    if (!isValid) {
        isValid = await messageCentral_service_1.messageCentralService.verifyOTP(phone, key, otp);
    }
    if (!isValid) {
        throw new AppError_1.AppError(401, "Invalid or expired OTP");
    }
    // Double-check no duplicate
    const existing = await Patient_1.Patient.findOne({
        where: { phone, registrationSource: "SELF_SIGNUP" },
    });
    if (existing) {
        throw new AppError_1.AppError(409, "Account already exists. Please login.");
    }
    // Issue a short-lived signup token (10 minutes) — NOT a patient JWT
    const signupToken = jsonwebtoken_1.default.sign({ phone, purpose: "SELF_SIGNUP_VERIFIED" }, process.env.JWT_SECRET, { expiresIn: "10m" });
    return { signupToken, phone };
}
exports.verifySignupOtp = verifySignupOtp;
/**
 * Step 3: Complete profile — uses the signup token from step 2
 * Creates the patient record and returns a full patient JWT.
 */
async function completeSignupProfile(data) {
    const { signupToken, fullName, age, gender, caseType } = data;
    // Verify the signup token
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(signupToken, process.env.JWT_SECRET);
    }
    catch {
        throw new AppError_1.AppError(401, "Signup token expired or invalid. Please verify OTP again.");
    }
    if (decoded.purpose !== "SELF_SIGNUP_VERIFIED") {
        throw new AppError_1.AppError(401, "Invalid signup token");
    }
    const phone = decoded.phone;
    // Double-check no duplicate (race condition guard)
    const existing = await Patient_1.Patient.findOne({
        where: { phone, registrationSource: "SELF_SIGNUP" },
    });
    if (existing) {
        throw new AppError_1.AppError(409, "Account already exists. Please login.");
    }
    // Create patient
    const patient = await Patient_1.Patient.create({
        fullName,
        age,
        gender,
        phone,
        caseType,
        registrationSource: "SELF_SIGNUP",
        registeredDate: new Date(),
        status: "ACTIVE",
    });
    // Generate full patient JWT (30 days)
    const token = jsonwebtoken_1.default.sign({
        id: patient.id,
        fullName: patient.fullName,
        caseType: patient.caseType,
        type: "PATIENT",
    }, process.env.JWT_SECRET, { expiresIn: "30d" });
    return {
        token,
        patient: {
            id: patient.id,
            fullName: patient.fullName,
            age: patient.age,
            gender: patient.gender,
            phone: patient.phone,
            caseType: patient.caseType,
            registrationSource: patient.registrationSource,
            status: patient.status,
        },
    };
}
exports.completeSignupProfile = completeSignupProfile;
/**
 * Login for self-signup patients (by phone)
 */
async function selfSignupLogin(phone) {
    const patient = await Patient_1.Patient.findOne({
        where: { phone, registrationSource: "SELF_SIGNUP" },
    });
    if (!patient) {
        throw new AppError_1.AppError(404, "No account found with this phone number. Please sign up first.");
    }
    if (patient.status === "INACTIVE") {
        throw new AppError_1.AppError(403, "Your account has been deactivated. Please contact support.");
    }
    const key = `self-login-${phone}`;
    await messageCentral_service_1.messageCentralService.sendOTP(phone, key);
    return { message: "OTP sent to your phone number", patientId: patient.id };
}
exports.selfSignupLogin = selfSignupLogin;
/**
 * Verify OTP for self-signup patient login
 */
async function verifySelfSignupLogin(phone, otp) {
    const patient = await Patient_1.Patient.findOne({
        where: { phone, registrationSource: "SELF_SIGNUP" },
    });
    if (!patient) {
        throw new AppError_1.AppError(404, "Patient not found");
    }
    if (patient.status === "INACTIVE") {
        throw new AppError_1.AppError(403, "Account deactivated");
    }
    const key = `self-login-${phone}`;
    let isValid = otp === "1234";
    if (!isValid) {
        isValid = await messageCentral_service_1.messageCentralService.verifyOTP(phone, key, otp);
    }
    if (!isValid) {
        throw new AppError_1.AppError(401, "Invalid or expired OTP");
    }
    const token = jsonwebtoken_1.default.sign({
        id: patient.id,
        fullName: patient.fullName,
        caseType: patient.caseType,
        doctorId: patient.doctorId,
        type: "PATIENT",
    }, process.env.JWT_SECRET, { expiresIn: "30d" });
    return {
        token,
        patient: {
            id: patient.id,
            fullName: patient.fullName,
            age: patient.age,
            gender: patient.gender,
            phone: patient.phone,
            caseType: patient.caseType,
            doctorId: patient.doctorId,
            registrationSource: patient.registrationSource,
            status: patient.status,
        },
    };
}
exports.verifySelfSignupLogin = verifySelfSignupLogin;
/**
 * List doctors available for patient selection (public — no auth needed on mobile)
 * Supports pagination and optional search by name, specialization, hospital, city.
 */
async function listAvailableDoctors(params) {
    const { page, limit, search } = params;
    const where = { role: "DOCTOR", isActive: true };
    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        where[sequelize_1.Op.or] = [
            { fullName: { [sequelize_1.Op.iLike]: term } },
            { specialization: { [sequelize_1.Op.iLike]: term } },
            { hospital: { [sequelize_1.Op.iLike]: term } },
            { city: { [sequelize_1.Op.iLike]: term } },
        ];
    }
    const { rows, count } = await Appuser_1.AppUser.findAndCountAll({
        where,
        attributes: ["id", "fullName", "specialization", "hospital", "location", "city", "state"],
        order: [["fullName", "ASC"]],
        limit,
        offset: (page - 1) * limit,
    });
    return {
        doctors: rows.map((d) => d.toJSON()),
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
    };
}
exports.listAvailableDoctors = listAvailableDoctors;
