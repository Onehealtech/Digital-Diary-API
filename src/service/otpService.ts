import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();
interface OTPData {
    otp: string;
    expiresAt: Date;
}

// In-memory OTP storage (use Redis in production)
const otpStore = new Map<string, OTPData>();

/**
 * Generate a 6-digit OTP and store it under the given key.
 * @param key - Unique key to associate OTP with (email, phone, diaryId, etc.)
 * @returns Generated OTP string
 */
export const generateOTP = (key: string): string => {
    // Use fixed OTP for testing environment
    const otp = process.env.NODE_ENV === 'test'
        ? '123456'
        : crypto.randomInt(100000, 999999).toString();

    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || "5");
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    otpStore.set(key.toLowerCase(), { otp, expiresAt });

    // Auto-cleanup expired OTP
    setTimeout(() => {
        otpStore.delete(key.toLowerCase());
    }, expiryMinutes * 60 * 1000);

    return otp;
};

/**
 * Store a pre-generated OTP under an additional key.
 * Used to map the same OTP to multiple keys (e.g. email + phone for staff 2FA).
 * @param key - Additional key (e.g. phone number)
 * @param otp - The OTP string to store
 */
export const storeOTP = (key: string, otp: string): void => {
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || "5");
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    otpStore.set(key.toLowerCase(), { otp, expiresAt });

    // Auto-cleanup
    setTimeout(() => {
        otpStore.delete(key.toLowerCase());
    }, expiryMinutes * 60 * 1000);
};

/**
 * Verify OTP for a given key.
 * @param key - The key used during generation (email, phone, diaryId, etc.)
 * @param otp - OTP to verify
 * @returns true if valid, false otherwise
 */
export const verifyOTP = (key: string, otp: string): boolean => {
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

/**
 * Verify OTP against multiple keys. Returns true if any key matches.
 * Cleans up all related keys on success to prevent reuse.
 * Used for staff 2FA where OTP can be entered from email or SMS.
 * @param keys - Array of keys to check (e.g. [email, phone])
 * @param otp  - OTP to verify
 * @returns true if valid against any key
 */
export const verifyOTPMultiKey = (keys: string[], otp: string): boolean => {
    for (const key of keys) {
        const normalizedKey = key.toLowerCase();
        const otpData = otpStore.get(normalizedKey);

        if (!otpData) continue;

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

/**
 * Clear OTP for a given key (useful for testing or manual cleanup)
 * @param key - The key to clear
 */
export const clearOTP = (key: string): void => {
    otpStore.delete(key.toLowerCase());
};
