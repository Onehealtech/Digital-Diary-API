"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLanguage = exports.getMyData = exports.getProfile = exports.updateProfile = exports.requestEditOTP = void 0;
const Patient_1 = require("../models/Patient");
const PatientPreferences_1 = require("../models/PatientPreferences");
const Appuser_1 = require("../models/Appuser");
const Reminder_1 = require("../models/Reminder");
const BubbleScanResult_1 = require("../models/BubbleScanResult");
const UserSubscription_1 = require("../models/UserSubscription");
const SubscriptionPlan_1 = require("../models/SubscriptionPlan");
const DoctorPatientHistory_1 = require("../models/DoctorPatientHistory");
const patientPdf_service_1 = require("../service/patientPdf.service");
const otpService_1 = require("../service/otpService");
const translations_1 = require("../utils/translations");
/**
 * POST /api/v1/patient/request-edit-otp
 * Request OTP to edit patient profile
 */
const requestEditOTP = async (req, res) => {
    try {
        const patientId = req.user.id;
        const patient = await Patient_1.Patient.findByPk(patientId);
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
        const otp = (0, otpService_1.generateOTP)(patient.phone);
        console.log(`📱 OTP for ${patient.phone}: ${otp}`);
        console.log(`⚠️  For testing, use hardcoded OTP: 1234`);
        const lang = (patient.language || "en");
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)("msg.otpSent", lang),
            data: {
                phone: patient.phone.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2"),
            },
        });
    }
    catch (error) {
        console.error("Request edit OTP error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to send OTP" });
    }
};
exports.requestEditOTP = requestEditOTP;
/**
 * POST /api/v1/patient/update-profile
 * Update patient profile after OTP verification
 */
const updateProfile = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { fullName, age, gender, phone, language } = req.body;
        const patient = await Patient_1.Patient.findByPk(patientId);
        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }
        if (fullName)
            patient.fullName = fullName;
        if (age)
            patient.age = age;
        if (gender)
            patient.gender = gender;
        if (phone)
            patient.phone = phone;
        if (language)
            patient.language = language;
        await patient.save();
        const lang = (patient.language || "en");
        // Build response with translated labels
        let responseData = {
            id: patient.id,
            diaryId: patient.diaryId,
            fullName: patient.fullName,
            age: patient.age,
            gender: patient.gender,
            genderLabel: (0, translations_1.t)(`gender.${patient.gender}`, lang),
            phone: patient.phone,
            language: patient.language,
            caseType: patient.caseType,
            caseTypeLabel: patient.caseType ? (0, translations_1.translateCaseType)(patient.caseType, lang) : null,
            status: patient.status,
            statusLabel: (0, translations_1.translateStatus)(patient.status, lang),
        };
        // Translate dynamic fields (fullName, etc.) for Hindi
        if (lang === "hi") {
            responseData = await (0, translations_1.translateFields)(responseData, ["fullName"], lang);
        }
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)("msg.profileUpdated", lang),
            data: responseData,
        });
    }
    catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to update profile" });
    }
};
exports.updateProfile = updateProfile;
/**
 * GET /api/v1/patient/profile
 * Get current patient profile
 */
const getProfile = async (req, res) => {
    try {
        const patientId = req.user.id;
        const patient = await Patient_1.Patient.findByPk(patientId, {
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
        const lang = (patient.language || "en");
        const patientData = patient.toJSON();
        const prefs = await PatientPreferences_1.PatientPreferences.findByPk(patientId);
        patientData.languageSource = prefs?.languageSource ?? "device";
        // Add static translated labels
        patientData.statusLabel = (0, translations_1.translateStatus)(patient.status, lang);
        patientData.caseTypeLabel = patient.caseType ? (0, translations_1.translateCaseType)(patient.caseType, lang) : null;
        patientData.genderLabel = patient.gender ? (0, translations_1.t)(`gender.${patient.gender}`, lang) : null;
        // Fetch doctor info
        if (patient.doctorId) {
            const doctor = await Appuser_1.AppUser.findByPk(patient.doctorId, {
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
            const translated = await (0, translations_1.translateFields)(patientData, fieldsToTranslate, lang);
            Object.assign(patientData, translated);
        }
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)("msg.profileRetrieved", lang),
            data: patientData,
        });
    }
    catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to retrieve profile" });
    }
};
exports.getProfile = getProfile;
/**
 * GET /api/v1/patient/my-data
 * Returns all patient data in a single response for PDF export.
 * Includes: profile, doctor info, subscription, reminders, diary scan results.
 */
const getMyData = async (req, res) => {
    try {
        const patientId = req.user.id;
        // 1. Patient profile + doctor
        const patient = await Patient_1.Patient.findByPk(patientId, {
            attributes: [
                "id", "diaryId", "fullName", "age", "gender", "phone",
                "address", "language", "caseType", "status", "stage",
                "treatmentPlan", "prescribedTests", "testCompletionPercentage",
                "totalTestsPrescribed", "doctorId", "registeredDate",
                "lastDiaryScan", "lastDoctorContact", "createdAt",
            ],
            include: [{
                    model: Appuser_1.AppUser,
                    as: "doctor",
                    attributes: ["id", "fullName", "specialization", "hospital", "phone", "email", "license"],
                }],
        });
        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }
        // 2. Active subscription
        const subscription = await UserSubscription_1.UserSubscription.findOne({
            where: { patientId, status: "ACTIVE" },
            include: [{ model: SubscriptionPlan_1.SubscriptionPlan, attributes: ["name", "description", "monthlyPrice", "maxDiaryPages", "scanEnabled", "manualEntryEnabled"] }],
        });
        // 3. Reminders (last 50, sorted newest first)
        const reminders = await Reminder_1.Reminder.findAll({
            where: { patientId },
            order: [["reminderDate", "DESC"]],
            limit: 50,
            attributes: ["id", "message", "reminderDate", "type", "status", "createdAt", "reminderCount", "newReminderDate"],
        });
        // 4. Diary scan results — include all answer and image fields
        const scanResults = await BubbleScanResult_1.BubbleScanResult.findAll({
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
        const doctorHistory = await DoctorPatientHistory_1.DoctorPatientHistory.findAll({
            where: { patientId },
            order: [["assignedAt", "ASC"]],
            include: [{
                    model: Appuser_1.AppUser,
                    as: "doctor",
                    attributes: ["id", "fullName", "specialization", "hospital", "phone", "email"],
                }],
        });
        const exportedAt = new Date().toISOString();
        const subscriptionData = subscription
            ? {
                status: subscription.status,
                planName: subscription.plan?.name,
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
            doctor: h.doctor
                ? {
                    id: h.doctor.id,
                    fullName: h.doctor.fullName,
                    specialization: h.doctor.specialization,
                    hospital: h.doctor.hospital,
                    phone: h.doctor.phone,
                    email: h.doctor.email,
                }
                : null,
            assignedAt: h.assignedAt,
            unassignedAt: h.unassignedAt ?? null,
            isCurrent: !h.unassignedAt,
        }));
        const pdfPayload = {
            exportedAt,
            patient: patient.toJSON(),
            subscription: subscriptionData,
            reminders: reminders.map((r) => r.toJSON()),
            scanResults: scanResults.map((s) => s.toJSON()),
            doctorHistory: doctorHistoryData,
        };
        // Generate PDF in background and upload to S3
        let pdfUrl = null;
        try {
            pdfUrl = await (0, patientPdf_service_1.generateAndUploadPatientPDF)(pdfPayload, patientId, patient.diaryId);
            console.info(`[PDF_EXPORT] patientId=${patientId} url=${pdfUrl}`);
        }
        catch (pdfErr) {
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
    }
    catch (error) {
        console.error("Get my data error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to retrieve patient data" });
    }
};
exports.getMyData = getMyData;
/**
 * PATCH /api/v1/patient/language
 * Update patient language preference
 */
const updateLanguage = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { language, languageSource } = req.body;
        if (!language || !["en", "hi"].includes(language)) {
            res.status(400).json({
                success: false,
                message: "Invalid language. Supported: en, hi",
            });
            return;
        }
        if (languageSource && !["device", "user"].includes(languageSource)) {
            res.status(400).json({
                success: false,
                message: "Invalid languageSource. Supported: device, user",
            });
            return;
        }
        const patient = await Patient_1.Patient.findByPk(patientId);
        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }
        patient.language = language;
        await patient.save();
        await PatientPreferences_1.PatientPreferences.upsert({
            patientId,
            languageSource: languageSource ?? "device",
        });
        res.status(200).json({
            success: true,
            message: "Language updated successfully",
            data: { language: patient.language, languageSource: languageSource ?? "device" },
        });
    }
    catch (error) {
        console.error("Update language error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to update language" });
    }
};
exports.updateLanguage = updateLanguage;
