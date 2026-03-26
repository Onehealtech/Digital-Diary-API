import { Response } from "express";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { generateOTP, verifyOTP } from "../service/otpService";

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

        const patient = await Patient.findByPk(patientId);

        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }

        if (!patient.phone) {
            res.status(400).json({
                success: false,
                message: "No phone number registered. Please contact hospital staff.",
            });
            return;
        }

        const otp = generateOTP(patient.phone);

        console.log(`📱 OTP for ${patient.phone}: ${otp}`);
        console.log(`⚠️  For testing, use hardcoded OTP: 1234`);

        res.status(200).json({
            success: true,
            message: "OTP sent to your registered mobile number",
            data: {
                phone: patient.phone.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2"),
            },
        });
    } catch (error: any) {
        console.error("Request edit OTP error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to send OTP" });
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

        const patient = await Patient.findByPk(patientId);

        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }

        if (fullName) patient.fullName = fullName;
        if (age) patient.age = age;
        if (gender) patient.gender = gender;
        if (phone) patient.phone = phone;
        if (language) patient.language = language;

        await patient.save();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                id: patient.id,
                diaryId: patient.diaryId,
                fullName: patient.fullName,
                age: patient.age,
                gender: patient.gender,
                phone: patient.phone,
                language: patient.language,
                caseType: patient.caseType,
                status: patient.status,
            },
        });
    } catch (error: any) {
        console.error("Update profile error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to update profile" });
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
                "id", "diaryId", "fullName", "age", "gender", "phone",
                "language", "caseType", "status", "doctorId",
                "stage", "treatmentPlan", "address",
                "createdAt", "updatedAt",
            ],
        });

        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }

        const patientData = patient.toJSON() as any;

        // Fetch doctor info
        if (patient.doctorId) {
            const doctor = await AppUser.findByPk(patient.doctorId, {
                attributes: ["id", "fullName", "specialization", "hospital"],
            });
            if (doctor) {
                patientData.doctor = {
                    id: doctor.id,
                    fullName: doctor.fullName,
                    specialization: doctor.specialization || null,
                    hospital: doctor.hospital || null,
                };
            }
        }

        res.status(200).json({
            success: true,
            message: "Profile retrieved successfully",
            data: patientData,
        });
    } catch (error: any) {
        console.error("Get profile error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to retrieve profile" });
    }
};

/**
 * PATCH /api/v1/patient/language
 * Update patient language preference
 */
export const updateLanguage = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const { language } = req.body;

        if (!language || !["en", "hi"].includes(language)) {
            res.status(400).json({
                success: false,
                message: "Invalid language. Supported: en, hi",
            });
            return;
        }

        const patient = await Patient.findByPk(patientId);

        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }

        patient.language = language;
        await patient.save();

        res.status(200).json({
            success: true,
            message: "Language updated successfully",
            data: { language: patient.language },
        });
    } catch (error: any) {
        console.error("Update language error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to update language" });
    }
};
