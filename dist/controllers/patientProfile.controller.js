"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.updateProfile = exports.requestEditOTP = void 0;
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const otpService_1 = require("../service/otpService");
const translations_1 = require("../utils/translations");
/**
 * POST /api/v1/patient/request-edit-otp
 * Request OTP to edit patient profile
 */
const requestEditOTP = async (req, res) => {
    try {
        const patientId = req.user.id;
        // Get patient details
        const patient = await Patient_1.Patient.findByPk(patientId);
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
        const otp = (0, otpService_1.generateOTP)(patient.phone);
        // For MVP: Log OTP to console (in production, send via SMS)
        console.log(`📱 OTP for ${patient.phone}: ${otp}`);
        console.log(`⚠️  For testing, use hardcoded OTP: 1234`);
        const lang = (patient.language || "en");
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)("msg.otpSent", lang),
            data: {
                phone: patient.phone.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2"), // Mask phone
            },
        });
    }
    catch (error) {
        console.error("Request edit OTP error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to send OTP",
        });
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
        // if (!otp) {
        //     res.status(400).json({
        //         success: false,
        //         message: "OTP is required",
        //     });
        //     return;
        // }
        // Get patient details
        const patient = await Patient_1.Patient.findByPk(patientId);
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
        // Transliterate name for Hindi (phonetic script conversion)
        if (lang === "hi") {
            responseData = await (0, translations_1.translateFields)(responseData, [], lang, ["fullName"]);
        }
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)("msg.profileUpdated", lang),
            data: responseData,
        });
    }
    catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update profile",
        });
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
            res.status(404).json({
                success: false,
                message: "Patient not found",
            });
            return;
        }
        const lang = (patient.language || "en");
        const patientData = patient.toJSON();
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
            const translated = await (0, translations_1.translateFields)(patientData, ["address", "stage", "treatmentPlan", "doctor.specialization", "doctor.hospital"], lang, ["fullName", "doctor.fullName"] // names → transliterate (phonetic)
            );
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
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve profile",
        });
    }
};
exports.getProfile = getProfile;
