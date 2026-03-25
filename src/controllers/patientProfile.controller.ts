import { Response } from "express";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { generateOTP, verifyOTP } from "../service/otpService";
import { t, translateStatus, translateCaseType, SupportedLanguage } from "../utils/translations";

/**
 * POST /api/v1/patient/request-edit-otp
 * Request OTP to edit patient profile
 */
export const requestEditOTP = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;

        // Get patient details
        const patient = await Patient.findByPk(patientId);

        if (!patient) {
            res.status(404).json({
                success: false,
                message: "Patient not found",
            });
            return;
        }

        if (!patient.phone) {
            res.status(400).json({
                success: false,
                message: "No phone number registered. Please contact hospital staff.",
            });
            return;
        }

        // Generate OTP (using phone as key)
        const otp = generateOTP(patient.phone);

        // For MVP: Log OTP to console (in production, send via SMS)
        console.log(`📱 OTP for ${patient.phone}: ${otp}`);
        console.log(`⚠️  For testing, use hardcoded OTP: 1234`);

        const lang = (patient.language || "en") as SupportedLanguage;

        res.status(200).json({
            success: true,
            message: t("msg.otpSent", lang),
            data: {
                phone: patient.phone.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2"), // Mask phone
            },
        });
    } catch (error: any) {
        console.error("Request edit OTP error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to send OTP",
        });
    }
};

/**
 * POST /api/v1/patient/update-profile
 * Update patient profile after OTP verification
 */
export const updateProfile = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const { fullName, age, gender, phone, language } = req.body;

        // if (!otp) {
        //     res.status(400).json({
        //         success: false,
        //         message: "OTP is required",
        //     });
        //     return;
        // }

        // Get patient details
        const patient = await Patient.findByPk(patientId);

        if (!patient) {
            res.status(404).json({
                success: false,
                message: "Patient not found",
            });
            return;
        }

        // For MVP: Accept hardcoded OTP "1234" OR verify generated OTP
        // const isValidOTP =
        //     otp === "1234" || verifyOTP(patient.phone || "", otp);

        // if (!isValidOTP) {
        //     res.status(401).json({
        //         success: false,
        //         message: "Invalid or expired OTP",
        //     });
        //     return;
        // }

        // Update patient details
        if (fullName) patient.fullName = fullName;
        if (age) patient.age = age;
        if (gender) patient.gender = gender;
        if (phone) patient.phone = phone;
        if (language) patient.language = language;

        await patient.save();

        const lang = (patient.language || "en") as SupportedLanguage;

        res.status(200).json({
            success: true,
            message: t("msg.profileUpdated", lang),
            data: {
                id: patient.id,
                diaryId: patient.diaryId,
                fullName: patient.fullName,
                age: patient.age,
                gender: patient.gender,
                phone: patient.phone,
                language: patient.language,
                caseType: patient.caseType,
                caseTypeLabel: patient.caseType ? translateCaseType(patient.caseType, lang) : null,
                status: patient.status,
                statusLabel: translateStatus(patient.status, lang),
            },
        });
    } catch (error: any) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update profile",
        });
    }
};

/**
 * GET /api/v1/patient/profile
 * Get current patient profile
 */
export const getProfile = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;

        const patient = await Patient.findByPk(patientId, {
            attributes: [
                "id",
                "diaryId",
                "fullName",
                "age",
                "gender",
                "phone",
                "language",
                "caseType",
                "status",
                "createdAt",
                "updatedAt",
            ],
        });

        if (!patient) {
            res.status(404).json({
                success: false,
                message: "Patient not found",
            });
            return;
        }

        const lang = (patient.language || "en") as SupportedLanguage;
        const patientData = patient.toJSON();

        res.status(200).json({
            success: true,
            message: t("msg.profileRetrieved", lang),
            data: {
                ...patientData,
                statusLabel: translateStatus(patient.status, lang),
                caseTypeLabel: patient.caseType ? translateCaseType(patient.caseType, lang) : null,
            },
        });
    } catch (error: any) {
        console.error("Get profile error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve profile",
        });
    }
};
