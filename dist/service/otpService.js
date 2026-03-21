"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearOTP = exports.verifyOTPMultiKey = exports.verifyOTP = exports.storeOTP = exports.generateOTP = void 0;
const crypto_1 = __importDefault(require("crypto"));
// In-memory OTP storage (use Redis in production)
const otpStore = new Map();
/**
 * Generate a 6-digit OTP and store it under the given key.
 * @param key - Unique key to associate OTP with (email, phone, diaryId, etc.)
 * @returns Generated OTP string
 */
const generateOTP = (key) => {
    // Use fixed OTP for testing environment
    const otp = process.env.NODE_ENV === 'test'
        ? '123456'
        : crypto_1.default.randomInt(100000, 999999).toString();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || "5");
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    otpStore.set(key.toLowerCase(), { otp, expiresAt });
    // Auto-cleanup expired OTP
    setTimeout(() => {
        otpStore.delete(key.toLowerCase());
    }, expiryMinutes * 60 * 1000);
    return otp;
};
exports.generateOTP = generateOTP;
/**
 * Store a pre-generated OTP under an additional key.
 * Used to map the same OTP to multiple keys (e.g. email + phone for staff 2FA).
 * @param key - Additional key (e.g. phone number)
 * @param otp - The OTP string to store
 */
const storeOTP = (key, otp) => {
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || "5");
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    otpStore.set(key.toLowerCase(), { otp, expiresAt });
    // Auto-cleanup
    setTimeout(() => {
        otpStore.delete(key.toLowerCase());
    }, expiryMinutes * 60 * 1000);
};
exports.storeOTP = storeOTP;
/**
 * Verify OTP for a given key.
 * @param key - The key used during generation (email, phone, diaryId, etc.)
 * @param otp - OTP to verify
 * @returns true if valid, false otherwise
 */
const verifyOTP = (key, otp) => {
    const normalizedKey = key.toLowerCase();
    const otpData = otpStore.get(normalizedKey);
    if (!otpData) {
        return false; // OTP not found
    }
    if (new Date() > otpData.expiresAt) {
        otpStore.delete(normalizedKey);
        return false; // OTP expired
    }
    if (otpData.otp !== otp) {
        return false; // OTP mismatch
    }
    // OTP is valid, remove it (one-time use)
    otpStore.delete(normalizedKey);
    return true;
};
exports.verifyOTP = verifyOTP;
/**
 * Verify OTP against multiple keys. Returns true if any key matches.
 * Cleans up all related keys on success to prevent reuse.
 * Used for staff 2FA where OTP can be entered from email or SMS.
 * @param keys - Array of keys to check (e.g. [email, phone])
 * @param otp  - OTP to verify
 * @returns true if valid against any key
 */
const verifyOTPMultiKey = (keys, otp) => {
    for (const key of keys) {
        const normalizedKey = key.toLowerCase();
        const otpData = otpStore.get(normalizedKey);
        if (!otpData)
            continue;
        if (new Date() > otpData.expiresAt) {
            otpStore.delete(normalizedKey);
            continue;
        }
        if (otpData.otp === otp) {
            // OTP is valid — clear all related keys to prevent reuse
            for (const k of keys) {
                otpStore.delete(k.toLowerCase());
            }
            return true;
        }
    }
    return false;
};
exports.verifyOTPMultiKey = verifyOTPMultiKey;
/**
 * Clear OTP for a given key (useful for testing or manual cleanup)
 * @param key - The key to clear
 */
const clearOTP = (key) => {
    otpStore.delete(key.toLowerCase());
};
exports.clearOTP = clearOTP;
