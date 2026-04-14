"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPatient = void 0;
const Patient_1 = require("../models/Patient");
const GeneratedDiary_1 = require("../models/GeneratedDiary");
/**
 * POST /api/v1/clinic/register-patient
 * Doctor or Assistant registers a patient with sticker ID
 * CRITICAL: If Assistant, uses parentId as doctorId
 */
const registerPatient = async (req, res) => {
    try {
        const { diaryId, fullName, age, phone, gender, caseType } = req.body;
        // Validate required fields
        if (!diaryId || !fullName) {
            res.status(400).json({
                success: false,
                message: "Sticker ID and full name are required",
            });
            return;
        }
        // Check if sticker already exists on any patient row
        const existingPatient = await Patient_1.Patient.findOne({
            where: { diaryId },
        });
        if (existingPatient) {
            res.status(409).json({
                success: false,
                message: "This sticker ID is already registered",
            });
            return;
        }
        // Check GeneratedDiary: sticker must exist and must NOT be already sold
        const generatedDiary = await GeneratedDiary_1.GeneratedDiary.findOne({ where: { id: diaryId } });
        if (!generatedDiary) {
            res.status(404).json({
                success: false,
                message: "Diary sticker not found in the system. Please use a valid issued diary.",
            });
            return;
        }
        if (generatedDiary.status === "sold") {
            res.status(409).json({
                success: false,
                message: "This diary sticker is already assigned to another patient.",
            });
            return;
        }
        // Determine doctorId based on user role
        let doctorId;
        if (req.user.role === "ASSISTANT") {
            // If Assistant, use their parentId (the Doctor's ID)
            if (!req.user.parentId) {
                res.status(400).json({
                    success: false,
                    message: "Assistant is not linked to a Doctor",
                });
                return;
            }
            doctorId = req.user.parentId;
        }
        else if (req.user.role === "DOCTOR") {
            // If Doctor, use their own ID
            doctorId = req.user.id;
        }
        else {
            res.status(403).json({
                success: false,
                message: "Only Doctors and Assistants can register patients",
            });
            return;
        }
        // Create patient
        const newPatient = await Patient_1.Patient.create({
            diaryId,
            fullName,
            age,
            phone,
            gender,
            caseType,
            doctorId,
            status: "ACTIVE",
        });
        res.status(201).json({
            success: true,
            message: "Patient registered successfully",
            data: {
                id: newPatient.id,
                diaryId: newPatient.diaryId,
                fullName: newPatient.fullName,
                age: newPatient.age,
                phone: newPatient.phone,
                gender: newPatient.gender,
                caseType: newPatient.caseType,
                status: newPatient.status,
                doctorId: newPatient.doctorId,
                registeredBy: req.user.role,
            },
        });
    }
    catch (error) {
        console.error("Register patient error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to register patient",
        });
    }
};
exports.registerPatient = registerPatient;
