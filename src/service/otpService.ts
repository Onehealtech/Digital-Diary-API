import crypto from "crypto";

interface OTPData {
    otp: string;
    expiresAt: Date;
}

// In-memory OTP storage (use Redis in production)
const otpStore = new Map<string, OTPData>();

/**
 * Generate a 6-digit OTP
 * @param email - User email to associate OTP with
 * @returns Generated OTP string
 */
export const generateOTP = (email: string): string => {
    const otp = crypto.randomInt(100000, 999999).toString();

    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || "5");
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    otpStore.set(email.toLowerCase(), { otp, expiresAt });

    // Auto-cleanup expired OTP
    setTimeout(() => {
        otpStore.delete(email.toLowerCase());
    }, expiryMinutes * 60 * 1000);

    return otp;
};

/**
 * Verify OTP for a given email
 * @param email - User email
 * @param otp - OTP to verify
 * @returns true if valid, false otherwise
 */
export const verifyOTP = (email: string, otp: string): boolean => {
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

/**
 * Clear OTP for a given email (useful for testing or manual cleanup)
 * @param email - User email
 */
export const clearOTP = (email: string): void => {
    otpStore.delete(email.toLowerCase());
};
