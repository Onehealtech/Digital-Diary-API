"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOTP = exports.login = void 0;
const patientAuth_service_1 = require("../service/patientAuth.service");
/**
 * POST /api/v1/patient/login
 * Patient login - validates sticker ID
 */
const login = async (req, res) => {
    try {
        const { diaryId } = req.body;
        if (!diaryId) {
            res.status(400).json({
                success: false,
                message: "Sticker ID is required",
            });
            return;
        }
        const result = await (0, patientAuth_service_1.patientLogin)(diaryId);
        res.status(200).json({
            success: true,
            message: result.message,
            data: { diaryId: result.diaryId },
        });
    }
    catch (error) {
        res.status(404).json({
            success: false,
            message: error.message || "Patient login failed",
        });
    }
};
exports.login = login;
/**
 * POST /api/v1/patient/verify-otp
 * Verify patient OTP (hardcoded 1234 for MVP) and return JWT
 */
const verifyOTP = async (req, res) => {
    try {
        const { diaryId, otp } = req.body;
        if (!diaryId || !otp) {
            res.status(400).json({
                success: false,
                message: "Sticker ID and OTP are required",
            });
            return;
        }
        const result = await (0, patientAuth_service_1.verifyPatientOTP)(diaryId, otp);
        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token: result.token,
                patient: result.patient,
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
exports.verifyOTP = verifyOTP;
