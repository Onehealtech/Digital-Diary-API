"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorAuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Appuser_1 = require("../models/Appuser");
const Wallet_1 = require("../models/Wallet");
const wallet_service_1 = require("./wallet.service");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // ✅ MUST be first
class DoctorAuthService {
    static async register(data) {
        const existing = await Appuser_1.AppUser.findOne({
            where: { email: data.email },
        });
        if (existing) {
            throw new Error("Doctor already exists");
        }
        const doctor = await Appuser_1.AppUser.create({
            fullName: data.fullName,
            email: data.email.toLowerCase(),
            password: data.password.trim(),
            address: data.address,
            phone: data.phone,
            role: "DOCTOR",
            isActive: false,
            selfRegistered: true,
        });
        // Credit referral coins to the referrer (non-blocking)
        if (data.referredByCode) {
            Appuser_1.AppUser.findOne({ where: { referralCode: data.referredByCode.trim().toUpperCase() } })
                .then((referrer) => {
                if (!referrer || referrer.id === doctor.id)
                    return;
                return (0, wallet_service_1.creditReferralCoins)({ referrerId: referrer.id, referredDoctorId: doctor.id });
            })
                .catch((err) => {
                const message = err instanceof Error ? err.message : "Unknown error";
                console.error(`Referral coin credit failed for code ${data.referredByCode}:`, message);
            });
        }
        return doctor;
    }
    static async login(email, password) {
        const doctor = await Appuser_1.AppUser.findOne({
            where: { email: email.toLowerCase(), role: "doctor" },
        });
        if (!doctor) {
            throw new Error("Doctor not found");
        }
        const isMatch = await bcrypt_1.default.compare(password.trim(), doctor.password);
        if (!isMatch) {
            throw new Error("Invalid credentials");
        }
        const token = jsonwebtoken_1.default.sign({
            id: doctor.id,
            role: doctor.role,
            fullName: doctor.fullName,
            email: doctor.email,
            tokenVersion: doctor.tokenVersion ?? 0,
        }, process.env.JWT_SECRET, { expiresIn: "7d" });
        return { token, doctor };
    }
    /**
     * Get current user by ID
     */
    static async getCurrentUser(userId) {
        const user = await Appuser_1.AppUser.findByPk(userId, {
            attributes: ["id", "fullName", "email", "phone", "role", "parentId", "permissions", "createdAt", "referralCode"],
        });
        if (!user) {
            throw new Error("User not found");
        }
        const wallet = await Wallet_1.Wallet.findOne({
            where: { userId },
            attributes: ["coinBalance"],
        });
        return {
            ...user.toJSON(),
            coinBalance: wallet?.coinBalance ?? 0,
        };
    }
    /**
     * Refresh access token
     */
    static async refreshToken(oldToken) {
        try {
            // Verify the old token (even if expired)
            const decoded = jsonwebtoken_1.default.verify(oldToken, process.env.JWT_SECRET, {
                ignoreExpiration: true,
            });
            // Get user from database to ensure they still exist
            const user = await Appuser_1.AppUser.findByPk(decoded.id);
            if (!user) {
                throw new Error("User not found");
            }
            // Generate new token
            const newToken = jsonwebtoken_1.default.sign({
                id: user.id,
                role: user.role,
                fullName: user.fullName,
                email: user.email,
                tokenVersion: user.tokenVersion ?? 0,
            }, process.env.JWT_SECRET, { expiresIn: "7d" });
            return { token: newToken, user };
        }
        catch (error) {
            if (error.name === "JsonWebTokenError") {
                throw new Error("Invalid token");
            }
            throw error;
        }
    }
    /**
     * Logout user (token blacklisting would be implemented here in production)
     */
    static async logout(userId) {
        // In production, you would:
        // 1. Add token to blacklist/redis
        // 2. Set token expiry
        // For now, just return success
        return {
            message: "Logged out successfully",
            userId,
        };
    }
    /**
     * Forgot password - Generate reset token
     */
    static async forgotPassword(email, currentPassword) {
        const user = await Appuser_1.AppUser.findOne({
            where: { email: email.toLowerCase() },
        });
        if (!user) {
            throw new Error("Invalid email or current password");
        }
        // Verify current password if provided
        if (currentPassword) {
            const isMatch = await bcrypt_1.default.compare(currentPassword.trim(), user.password);
            if (!isMatch) {
                throw new Error("Invalid email or current password");
            }
        }
        // Generate password reset token
        const resetToken = jsonwebtoken_1.default.sign({
            id: user.id,
            type: "password-reset",
        }, process.env.JWT_SECRET, { expiresIn: "1h" });
        return {
            message: "Identity verified. You can now reset your password.",
            resetToken,
        };
    }
    /**
     * Reset password using reset token
     */
    static async resetPassword(resetToken, newPassword) {
        try {
            // Verify reset token
            const decoded = jsonwebtoken_1.default.verify(resetToken, process.env.JWT_SECRET);
            if (decoded.type !== "password-reset") {
                throw new Error("Invalid reset token");
            }
            // Get user
            const user = await Appuser_1.AppUser.findByPk(decoded.id);
            if (!user) {
                throw new Error("User not found");
            }
            // Update password — the @BeforeUpdate hook in AppUser hashes it automatically
            await user.update({ password: newPassword.trim() });
            return {
                message: "Password reset successfully",
            };
        }
        catch (error) {
            if (error.name === "TokenExpiredError") {
                throw new Error("Reset token has expired");
            }
            if (error.name === "JsonWebTokenError") {
                throw new Error("Invalid reset token");
            }
            throw error;
        }
    }
    /**
     * Update profile (fullName and/or phone) for the authenticated user
     */
    static async updateProfile(userId, fullName, phone, bankDetails) {
        const user = await Appuser_1.AppUser.findByPk(userId);
        if (!user) {
            throw new Error("User not found");
        }
        if (!fullName?.trim()) {
            throw new Error("Full name is required");
        }
        const updateData = {
            fullName: fullName.trim(),
            ...(phone !== undefined && { phone: phone.trim() || null }),
        };
        if (bankDetails !== undefined) {
            updateData.bankDetails = bankDetails;
        }
        await user.update(updateData);
        return {
            id: user.id,
            fullName: user.fullName,
            phone: user.phone,
            email: user.email,
            role: user.role,
            bankDetails: user.bankDetails || null,
        };
    }
    static async changePassword(userId, oldPassword, newPassword) {
        // 1️⃣ Find user
        const user = await Appuser_1.AppUser.findByPk(userId);
        if (!user) {
            throw new Error("User not found");
        }
        // 2️⃣ Verify old password
        const isMatch = await bcrypt_1.default.compare(oldPassword.trim(), user.password);
        if (!isMatch) {
            throw new Error("Old password is incorrect");
        }
        // 3️⃣ Prevent same password reuse
        const isSamePassword = await bcrypt_1.default.compare(newPassword.trim(), user.password);
        if (isSamePassword) {
            throw new Error("New password cannot be same as old password");
        }
        // 4️⃣ Update password — @BeforeUpdate hook in AppUser hashes it automatically
        await user.update({ password: newPassword.trim() });
        return {
            message: "Password changed successfully",
        };
    }
}
exports.DoctorAuthService = DoctorAuthService;
