"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearOTP = exports.verifyOTP = exports.generateOTP = void 0;
const crypto_1 = __importDefault(require("crypto"));
// In-memory OTP storage (use Redis in production)
const otpStore = new Map();
/**
 * Generate a 6-digit OTP
 * @param email - User email to associate OTP with
 * @returns Generated OTP string
 */
const generateOTP = (email) => {
    // Use fixed OTP for testing environment
    const otp = process.env.NODE_ENV === 'test'
        ? '123456'
        : crypto_1.default.randomInt(100000, 999999).toString();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || "5");
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    otpStore.set(email.toLowerCase(), { otp, expiresAt });
    // Auto-cleanup expired OTP
    setTimeout(() => {
        otpStore.delete(email.toLowerCase());
    }, expiryMinutes * 60 * 1000);
    return otp;
};
exports.generateOTP = generateOTP;
/**
 * Verify OTP for a given email
 * @param email - User email
 * @param otp - OTP to verify
 * @returns true if valid, false otherwise
 */
const verifyOTP = (email, otp) => {
    const emailKey = email.toLowerCase();
    const otpData = otpStore.get(emailKey);
    if (!otpData) {
        return false; // OTP not found
    }
    if (new Date() > otpData.expiresAt) {
        otpStore.delete(emailKey);
        return false; // OTP expired
    }
    if (otpData.otp !== otp) {
        return false; // OTP mismatch
    }
    // OTP is valid, remove it (one-time use)
    otpStore.delete(emailKey);
    return true;
};
exports.verifyOTP = verifyOTP;
/**
 * Clear OTP for a given email (useful for testing or manual cleanup)
 * @param email - User email
 */
const clearOTP = (email) => {
    otpStore.delete(email.toLowerCase());
};
exports.clearOTP = clearOTP;
