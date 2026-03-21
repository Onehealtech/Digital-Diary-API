"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAvailableDoctors = exports.verifySignupOtp = exports.sendSignupOtp = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sequelize_1 = require("sequelize");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const AppError_1 = require("../utils/AppError");
const otpService_1 = require("./otpService");
const twilio_service_1 = require("./twilio.service");
/**
 * Step 1: Send OTP to phone — works for both new and existing patients.
 * - If account exists → sends OTP for login (returns isExistingUser: true)
 * - If account does not exist → sends OTP for signup (returns isExistingUser: false)
 */
async function sendSignupOtp(phone) {
    const existing = await Patient_1.Patient.findOne({
        where: { phone, registrationSource: "SELF_SIGNUP" },
    });
    // Block inactive accounts
    if (existing && existing.status === "INACTIVE") {
        throw new AppError_1.AppError(403, "Your account has been deactivated. Please contact support.");
    }
    const key = `self-otp-${phone}`;
    const otp = (0, otpService_1.generateOTP)(key);
    const sent = await twilio_service_1.twilioService.sendOTP(phone, otp);
    if (!sent) {
        console.warn(`Failed to send OTP to ${phone}`);
    }
    return {
        message: "OTP sent to your phone number",
        isExistingUser: !!existing,
    };
}
exports.sendSignupOtp = sendSignupOtp;
/**
 * Step 2: Verify OTP — handles both login and signup in one function.
 * - If account exists → verify OTP and return JWT (login)
 * - If account does not exist → verify OTP, create profile, return JWT (signup)
 *
 * Profile fields (fullName, age, gender, caseType) are required only for new signups.
 */
async function verifySignupOtp(phone, otp, profile) {
    const key = `self-otp-${phone}`;
    const isValid = (0, otpService_1.verifyOTP)(key, otp);
    if (!isValid) {
        throw new AppError_1.AppError(401, "Invalid or expired OTP");
    }
    // Check if patient already exists
    const existing = await Patient_1.Patient.findOne({
        where: { phone, registrationSource: "SELF_SIGNUP" },
    });
    if (existing) {
        // --- LOGIN flow ---
        if (existing.status === "INACTIVE") {
            throw new AppError_1.AppError(403, "Your account has been deactivated. Please contact support.");
        }
        const token = jsonwebtoken_1.default.sign({
            id: existing.id,
            fullName: existing.fullName,
            caseType: existing.caseType,
            doctorId: existing.doctorId,
            type: "PATIENT",
        }, process.env.JWT_SECRET, { expiresIn: "30d" });
        return {
            token,
            patient: {
                id: existing.id,
                fullName: existing.fullName,
                age: existing.age,
                gender: existing.gender,
                phone: existing.phone,
                caseType: existing.caseType,
                doctorId: existing.doctorId,
                registrationSource: existing.registrationSource,
                status: existing.status,
            },
            isNewUser: false,
        };
    }
    // --- SIGNUP flow ---
    if (!profile || !profile.fullName || !profile.age || !profile.gender || !profile.caseType) {
        throw new AppError_1.AppError(400, "Profile details (fullName, age, gender, caseType) are required for new registration");
    }
    const { fullName, age, gender, caseType } = profile;
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
        isNewUser: true,
    };
}
exports.verifySignupOtp = verifySignupOtp;
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
