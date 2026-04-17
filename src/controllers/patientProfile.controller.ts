import { Response } from "express";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { Reminder } from "../models/Reminder";
import { BubbleScanResult } from "../models/BubbleScanResult";
import { UserSubscription } from "../models/UserSubscription";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { DoctorPatientHistory } from "../models/DoctorPatientHistory";
import { generateAndUploadPatientPDF } from "../service/patientPdf.service";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { generateOTP, verifyOTP } from "../service/otpService";
import { normalizeQuestionReports, normalizeReportFiles } from "../utils/reportFiles";
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
 * GET /api/v1/patient/my-data
 * Returns all patient data in a single response for PDF export.
 * Includes: profile, doctor info, subscription, reminders, diary scan results.
 */
export const getMyData = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;

        // 1. Patient profile + doctor
        const patient = await Patient.findByPk(patientId, {
            attributes: [
                "id", "diaryId", "fullName", "age", "gender", "phone",
                "address", "language", "caseType", "status", "stage",
                "treatmentPlan", "prescribedTests", "testCompletionPercentage",
                "totalTestsPrescribed", "doctorId", "registeredDate",
                "lastDiaryScan", "lastDoctorContact", "createdAt",
            ],
            include: [{
                model: AppUser,
                as: "doctor",
                attributes: ["id", "fullName", "specialization", "hospital", "phone", "email", "license"],
            }],
        });

        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }

        // 2. Active subscription
        const subscription = await UserSubscription.findOne({
            where: { patientId, status: "ACTIVE" },
            include: [{ model: SubscriptionPlan, attributes: ["name", "description", "monthlyPrice", "maxDiaryPages", "scanEnabled", "manualEntryEnabled"] }],
        });

        // 3. Reminders (last 50, sorted newest first)
        const reminders = await Reminder.findAll({
            where: { patientId },
            order: [["reminderDate", "DESC"]],
            limit: 50,
            attributes: ["id", "message", "reminderDate", "type", "status", "createdAt", "reminderCount", "newReminderDate"],
        });

        // 4. Diary scan results — include all answer and image fields
        const scanResults = await BubbleScanResult.findAll({
            where: { patientId },
            order: [["createdAt", "DESC"]],
            limit: 200,
            attributes: [
                "id", "pageNumber", "pageType", "pageId", "templateName",
                "submissionType", "processingStatus",
                "imageUrl",
                "scanResults", "doctorOverrides", "questionMarks",
                "doctorReviewed", "doctorNotes",
                "flagged", "reportUrls", "questionReports",
                "createdAt", "reviewedAt",
            ],
        });

        // 5. Full doctor history (all doctors ever assigned)
        const doctorHistory = await DoctorPatientHistory.findAll({
            where: { patientId },
            order: [["assignedAt", "ASC"]],
            include: [{
                model: AppUser,
                as: "doctor",
                attributes: ["id", "fullName", "specialization", "hospital", "phone", "email"],
            }],
        });

        const exportedAt = new Date().toISOString();

        const subscriptionData = subscription
            ? {
                  status: subscription.status,
                  planName: (subscription.plan as SubscriptionPlan | null)?.name,
                  paidAmount: subscription.paidAmount,
                  maxDiaryPages: subscription.maxDiaryPages,
                  pagesUsed: subscription.pagesUsed,
                  scanEnabled: subscription.scanEnabled,
                  manualEntryEnabled: subscription.manualEntryEnabled,
                  startDate: subscription.startDate,
                  endDate: subscription.endDate,
              }
            : null;

        const doctorHistoryData = doctorHistory.map((h) => ({
            doctorId: h.doctorId,
            doctor: (h as any).doctor
                ? {
                      id: (h as any).doctor.id,
                      fullName: (h as any).doctor.fullName,
                      specialization: (h as any).doctor.specialization,
                      hospital: (h as any).doctor.hospital,
                      phone: (h as any).doctor.phone,
                      email: (h as any).doctor.email,
                  }
                : null,
            assignedAt: h.assignedAt,
            unassignedAt: h.unassignedAt ?? null,
            isCurrent: !h.unassignedAt,
        }));

        const normalizedScanResults = scanResults.map((scan) => {
            const data = scan.toJSON() as any;
            return {
                ...data,
                reportFiles: normalizeReportFiles(data.reportUrls),
                questionReports: normalizeQuestionReports(data.questionReports),
            };
        });

        const pdfPayload = {
            exportedAt,
            patient: patient.toJSON(),
            subscription: subscriptionData,
            reminders: reminders.map((r) => r.toJSON()),
            scanResults: normalizedScanResults,
            doctorHistory: doctorHistoryData,
        };

        // Generate PDF in background and upload to S3
        let pdfUrl: string | null = null;
        try {
            pdfUrl = await generateAndUploadPatientPDF(
                pdfPayload as any,
                patientId,
                patient.diaryId
            );
            console.info(`[PDF_EXPORT] patientId=${patientId} url=${pdfUrl}`);
        } catch (pdfErr: any) {
            // PDF generation failure must not block the data response
            console.error("[PDF_EXPORT] Failed to generate/upload PDF:", pdfErr.message);
        }

        res.status(200).json({
            success: true,
            message: "Patient data retrieved successfully",
            data: {
                // ...pdfPayload,/
                pdfUrl,
            },
        });
    } catch (error: any) {
        console.error("Get my data error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to retrieve patient data" });
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
