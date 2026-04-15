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
const smsfortius_service_1 = require("./smsfortius.service");
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
    // Block login for inactive users — distinguish pending approval from admin-deactivated
    if (user.isActive === false) {
        const message = user.selfRegistered
            ? "Your account is pending approval from the Super Admin. You will be able to log in once approved."
            : "Your account has been deactivated. Please contact your administrator.";
        throw Object.assign(new Error(message), { loginBlocked: true, userId: user.id });
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
    console.log(`[Fortius SMS] Preparing to send OTP ${JSON.stringify(user)}`);
    // Store the same OTP under the phone key so verification works from either channel
    if (user.phone) {
        (0, otpService_1.storeOTP)(user.phone, otp);
        const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || "5";
        const sent = await (0, smsfortius_service_1.sendLoginOTP)(user.phone, otp, expiryMinutes);
        console.log(sent ? `OTP sent via Fortius to ${user.phone}` : `Failed to send OTP via Fortius to ${user.phone}`);
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
        attributes: ["id", "fullName", "email", "phone", "role", "parentId", "isEmailVerified", "assistantStatus", "isActive", "deletedAt", "tokenVersion"],
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
        const message = user.selfRegistered
            ? "Your account is pending approval from the Super Admin."
            : "Your account has been deactivated. Please contact your administrator.";
        throw new Error(message);
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
        tokenVersion: user.tokenVersion ?? 0,
    }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return {
        token,
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone || null,
            role: user.role,
            parentId: user.parentId,
        },
    };
};
exports.verifyStaffOTP = verifyStaffOTP;
