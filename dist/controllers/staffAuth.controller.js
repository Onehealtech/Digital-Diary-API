"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verify2FA = exports.login = void 0;
const staffAuth_service_1 = require("../service/staffAuth.service");
const activityLogger_1 = require("../utils/activityLogger");
/**
 * POST /api/v1/auth/login
 * Staff login - validates credentials and sends OTP
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
            return;
        }
        const result = await (0, staffAuth_service_1.staffLogin)(email, password);
        res.status(200).json({
            success: true,
            message: result.message,
            data: { email: result.email },
        });
    }
    catch (error) {
        // Log blocked login attempts for deactivated/archived/on-hold users
        if (error.loginBlocked) {
            const userId = error.userId || error.assistantId;
            if (userId) {
                (0, activityLogger_1.logActivity)({
                    req,
                    userId,
                    userRole: "UNKNOWN",
                    action: "LOGIN_BLOCKED",
                    details: { email: req.body.email, reason: error.message },
                });
            }
        }
        res.status(401).json({
            success: false,
            message: error.message || "Login failed",
        });
    }
};
exports.login = login;
/**
 * POST /api/v1/auth/verify-2fa
 * Verify OTP and return JWT token
 */
const verify2FA = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            });
            return;
        }
        const result = await (0, staffAuth_service_1.verifyStaffOTP)(email, otp);
        (0, activityLogger_1.logActivity)({
            req,
            userId: result.user.id,
            userRole: result.user.role,
            action: "STAFF_LOGIN",
            details: { email },
        });
        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token: result.token,
                user: result.user,
            },
        });
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: error.message || "OTP verification failed",
        });
    }
};
exports.verify2FA = verify2FA;
