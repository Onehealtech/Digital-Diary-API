import { Request, Response } from "express";
import { patientLogin, verifyPatientOTP } from "../service/patientAuth.service";

/**
 * POST /api/v1/patient/login
 * Patient login - validates sticker ID
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { diaryId } = req.body;

        if (!diaryId) {
            res.status(400).json({
                success: false,
                message: "Sticker ID is required",
            });
            return;
        }

        const result = await patientLogin(diaryId);

        res.status(200).json({
            success: true,
            message: result.message,
            data: { diaryId: result.diaryId },
        });
    } catch (error: any) {
        res.status(404).json({
            success: false,
            message: error.message || "Patient login failed",
        });
    }
};

/**
 * POST /api/v1/patient/verify-otp
 * Verify patient OTP (hardcoded 1234 for MVP) and return JWT
 */
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { diaryId, otp } = req.body;

        if (!diaryId || !otp) {
            res.status(400).json({
                success: false,
                message: "Sticker ID and OTP are required",
            });
            return;
        }

        const result = await verifyPatientOTP(diaryId, otp);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token: result.token,
                patient: result.patient,
            },
        });
    } catch (error: any) {
        res.status(401).json({
            success: false,
            message: error.message || "OTP verification failed",
        });
    }
};
