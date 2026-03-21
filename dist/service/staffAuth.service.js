"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyStaffOTP = exports.staffLogin = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Appuser_1 = require("../models/Appuser");
const otpService_1 = require("./otpService");
const emailService_1 = require("./emailService");
const twilio_service_1 = require("./twilio.service");
/**
 * Staff Login - Step 1: Validate credentials and send OTP via Email + SMS
 * Roles: Super Admin, Doctor, Assistant, Vendor
 */
const staffLogin = async (email, password) => {
    // Use paranoid: false so archived (soft-deleted) assistants get a clear error
    const user = await Appuser_1.AppUser.findOne({
        where: { email: email.toLowerCase() },
        paranoid: false,
    });
    if (!user) {
        throw new Error("Invalid credentials");
    }
    // Verify password
    const isMatch = await bcrypt_1.default.compare(password.trim(), user.password);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }
    // Block login for deactivated users (isActive = false)
    if (user.isActive === false) {
        throw Object.assign(new Error("Your account has been deactivated. Please contact your administrator."), { loginBlocked: true, userId: user.id });
    }
    // Block login for archived (soft-deleted) users
    if (user.deletedAt !== null) {
        throw Object.assign(new Error("Your account has been archived. Please contact your administrator to restore access."), { loginBlocked: true, userId: user.id });
    }
    // Block login for on-hold assistants
    if (user.role === "ASSISTANT") {
        const status = user.assistantStatus;
        if (status === "DELETED") {
            throw Object.assign(new Error("Your account has been archived. Contact your Doctor to restore access."), { loginBlocked: true, assistantId: user.id });
        }
        if (status === "ON_HOLD") {
            throw Object.assign(new Error("Your account is temporarily on hold. Contact your Doctor."), { loginBlocked: true, assistantId: user.id });
        }
    }
    // Generate a single OTP — send the SAME code via Email and SMS
    const otp = (0, otpService_1.generateOTP)(email);
    // Store the same OTP under the phone key so verification works from either channel
    if (user.phone) {
        (0, otpService_1.storeOTP)(user.phone, otp);
    }
    // Send OTP via Email
    try {
        await (0, emailService_1.sendOTPEmail)(email, otp, user.fullName);
    }
    catch (err) {
        console.error("Failed to send OTP email:", err);
        // Continue — SMS may still work
    }
    // Send the same OTP via SMS (Twilio)
    if (user.phone) {
        twilio_service_1.twilioService.sendOTP(user.phone, otp).catch((err) => {
            console.error("Failed to send OTP SMS:", err);
        });
    }
    return {
        message: "OTP sent to your email and phone",
        email: email.toLowerCase(),
    };
};
exports.staffLogin = staffLogin;
/**
 * Staff Login - Step 2: Verify OTP and return JWT
 * OTP validation works regardless of whether user enters OTP from email or SMS.
 */
const verifyStaffOTP = async (email, otp) => {
    // Get user to retrieve phone for multi-key verification
    const user = await Appuser_1.AppUser.findOne({
        where: { email: email.toLowerCase() },
        attributes: ["id", "fullName", "email", "phone", "role", "parentId", "isEmailVerified", "assistantStatus", "isActive", "deletedAt"],
        paranoid: false,
    });
    if (!user) {
        throw new Error("User not found");
    }
    // Verify OTP against both email and phone keys
    const keysToCheck = [email];
    if (user.phone) {
        keysToCheck.push(user.phone);
    }
    const isValid = (0, otpService_1.verifyOTPMultiKey)(keysToCheck, otp);
    if (!isValid) {
        throw new Error("Invalid or expired OTP");
    }
    // Block OTP verification for deactivated users
    if (user.isActive === false) {
        throw new Error("Your account has been deactivated. Please contact your administrator.");
    }
    // Block OTP verification for archived (soft-deleted) users
    if (user.deletedAt !== null) {
        throw new Error("Your account has been archived. Please contact your administrator to restore access.");
    }
    // Block OTP verification for on-hold assistants
    if (user.role === "ASSISTANT") {
        const status = user.assistantStatus;
        if (status === "DELETED") {
            throw new Error("Your account has been archived. Please contact your doctor.");
        }
        if (status === "ON_HOLD") {
            throw new Error("Your account is temporarily on hold. Contact your Doctor.");
        }
    }
    // Generate JWT token
    const token = jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        parentId: user.parentId,
    }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return {
        token,
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            parentId: user.parentId,
        },
    };
};
exports.verifyStaffOTP = verifyStaffOTP;
