import { Response } from "express";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { generateOTP, verifyOTP } from "../service/otpService";
import {
    t, translateStatus, translateCaseType, translateFields,
    SupportedLanguage,
} from "../utils/translations";

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

        const lang = (patient.language || "en") as SupportedLanguage;

        res.status(200).json({
            success: true,
            message: t("msg.otpSent", lang),
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

        const lang = (patient.language || "en") as SupportedLanguage;

        // Build response with translated labels
        let responseData: any = {
            id: patient.id,
            diaryId: patient.diaryId,
            fullName: patient.fullName,
            age: patient.age,
            gender: patient.gender,
            genderLabel: t(`gender.${patient.gender}`, lang),
            phone: patient.phone,
            language: patient.language,
            caseType: patient.caseType,
            caseTypeLabel: patient.caseType ? translateCaseType(patient.caseType, lang) : null,
            status: patient.status,
            statusLabel: translateStatus(patient.status, lang),
        };

        // Translate dynamic fields (fullName, etc.) for Hindi
        if (lang === "hi") {
            responseData = await translateFields(responseData, ["fullName"], lang);
        }

        res.status(200).json({
            success: true,
            message: t("msg.profileUpdated", lang),
            data: responseData,
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
                "id",
                "diaryId",
                "fullName",
                "age",
                "gender",
                "phone",
                "language",
                "caseType",
                "status",
                "doctorId",
                "stage",
                "treatmentPlan",
                "address",
                "createdAt",
                "updatedAt",
            ],
        });

        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }

        const lang = (patient.language || "en") as SupportedLanguage;
        const patientData = patient.toJSON() as any;

        // Add static translated labels
        patientData.statusLabel = translateStatus(patient.status, lang);
        patientData.caseTypeLabel = patient.caseType ? translateCaseType(patient.caseType, lang) : null;
        patientData.genderLabel = patient.gender ? t(`gender.${patient.gender}`, lang) : null;

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

        // Translate dynamic text fields for Hindi
        if (lang === "hi") {
            const fieldsToTranslate = [
                "fullName",
                "address",
                "stage",
                "treatmentPlan",
                "doctor.fullName",
                "doctor.specialization",
                "doctor.hospital",
            ];
            const translated = await translateFields(patientData, fieldsToTranslate, lang);
            Object.assign(patientData, translated);
        }

        res.status(200).json({
            success: true,
            message: t("msg.profileRetrieved", lang),
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
