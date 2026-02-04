import { Request, Response } from "express";
import { staffLogin, verifyStaffOTP } from "../service/staffAuth.service";

/**
 * POST /api/v1/auth/login
 * Staff login - validates credentials and sends OTP
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
            return;
        }

        const result = await staffLogin(email, password);

        res.status(200).json({
            success: true,
            message: result.message,
            data: { email: result.email },
        });
    } catch (error: any) {
        res.status(401).json({
            success: false,
            message: error.message || "Login failed",
        });
    }
};

/**
 * POST /api/v1/auth/verify-2fa
 * Verify OTP and return JWT token
 */
export const verify2FA = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            });
            return;
        }

        const result = await verifyStaffOTP(email, otp);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token: result.token,
                user: result.user,
            },
        });
    } catch (error: any) {
        res.status(401).json({
            success: false,
            message: error.message || "OTP verification failed",
        });
    }
};
