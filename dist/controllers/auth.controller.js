"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorAuthController = void 0;
const auth_service_1 = require("../service/auth.service");
const response_1 = require("../utils/response");
class DoctorAuthController {
    static async register(req, res) {
        try {
            const doctor = await auth_service_1.DoctorAuthService.register(req.body);
            return res.status(201).json({
                message: "Doctor registered successfully",
                data: {
                    id: doctor.id,
                    fullName: doctor.fullName,
                    email: doctor.email,
                },
            });
        }
        catch (error) {
            return res.status(400).json({ message: error.message });
        }
    }
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.DoctorAuthService.login(email, password);
            return res.json({
                message: "Login successful",
                token: result.token,
                doctor: {
                    id: result.doctor.id,
                    fullName: result.doctor.fullName,
                    email: result.doctor.email,
                },
            });
        }
        catch (error) {
            return res.status(401).json({ message: error.message });
        }
    }
    /**
     * GET /api/v1/auth/me
     * Get current logged-in user details
     */
    static async getCurrentUser(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const user = await auth_service_1.DoctorAuthService.getCurrentUser(userId);
            return (0, response_1.sendResponse)(res, user, "User details fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, 404);
        }
    }
    /**
     * POST /api/v1/auth/logout
     * Logout user
     */
    static async logout(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const result = await auth_service_1.DoctorAuthService.logout(userId);
            return (0, response_1.sendResponse)(res, result, "Logged out successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * POST /api/v1/auth/refresh
     * Refresh access token
     */
    static async refreshToken(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                return (0, response_1.sendError)(res, "Token is required", 400);
            }
            const result = await auth_service_1.DoctorAuthService.refreshToken(token);
            return (0, response_1.sendResponse)(res, result, "Token refreshed successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, 401);
        }
    }
    /**
     * POST /api/v1/auth/forgot-password
     * Request password reset
     */
    static async forgotPassword(req, res) {
        try {
            const { email, currentPassword } = req.body;
            if (!email) {
                return (0, response_1.sendError)(res, "Email is required", 400);
            }
            const result = await auth_service_1.DoctorAuthService.forgotPassword(email, currentPassword);
            return (0, response_1.sendResponse)(res, result, "Identity verified");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, 400);
        }
    }
    /**
     * POST /api/v1/auth/reset-password
     * Reset password using reset token
     */
    static async resetPassword(req, res) {
        try {
            const { resetToken, newPassword } = req.body;
            if (!resetToken || !newPassword) {
                return (0, response_1.sendError)(res, "resetToken and newPassword are required", 400);
            }
            if (newPassword.length < 6) {
                return (0, response_1.sendError)(res, "Password must be at least 6 characters", 400);
            }
            const result = await auth_service_1.DoctorAuthService.resetPassword(resetToken, newPassword);
            return (0, response_1.sendResponse)(res, result, "Password reset successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, 400);
        }
    }
    /**
     * PUT /api/v1/user/profile
     * Update fullName and phone for the authenticated user
     */
    static async updateProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { fullName, phone } = req.body;
            if (!fullName?.trim()) {
                return (0, response_1.sendError)(res, "Full name is required", 400);
            }
            const result = await auth_service_1.DoctorAuthService.updateProfile(userId, fullName, phone);
            return (0, response_1.sendResponse)(res, result, "Profile updated successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, 400);
        }
    }
    /**
     * PUT /api/v1/auth/change-password
     * Change password for authenticated users (requires current password verification)
     */
    static async changePassword(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                return (0, response_1.sendError)(res, "currentPassword and newPassword are required", 400);
            }
            if (newPassword.length < 6) {
                return (0, response_1.sendError)(res, "Password must be at least 6 characters", 400);
            }
            const result = await auth_service_1.DoctorAuthService.changePassword(userId, currentPassword, newPassword);
            return (0, response_1.sendResponse)(res, result, "Password changed successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, 400);
        }
    }
}
exports.DoctorAuthController = DoctorAuthController;
