import { Response } from "express";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * POST /api/v1/clinic/register-patient
 * Doctor or Assistant registers a patient with sticker ID
 * CRITICAL: If Assistant, uses parentId as doctorId
 */
export const registerPatient = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { stickerId, fullName, age, phone, gender, caseType } = req.body;

        // Validate required fields
        if (!stickerId || !fullName) {
            res.status(400).json({
                success: false,
                message: "Sticker ID and full name are required",
            });
            return;
        }

        // Check if sticker already exists
        const existingPatient = await Patient.findOne({
            where: { stickerId },
        });

        if (existingPatient) {
            res.status(409).json({
                success: false,
                message: "This sticker ID is already registered",
            });
            return;
        }

        // Determine doctorId based on user role
        let doctorId: string;

        if (req.user!.role === "ASSISTANT") {
            // If Assistant, use their parentId (the Doctor's ID)
            if (!req.user!.parentId) {
                res.status(400).json({
                    success: false,
                    message: "Assistant is not linked to a Doctor",
                });
                return;
            }
            doctorId = req.user!.parentId;
        } else if (req.user!.role === "DOCTOR") {
            // If Doctor, use their own ID
            doctorId = req.user!.id;
        } else {
            res.status(403).json({
                success: false,
                message: "Only Doctors and Assistants can register patients",
            });
            return;
        }

        // Create patient
        const newPatient = await Patient.create({
            stickerId,
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
                stickerId: newPatient.stickerId,
                fullName: newPatient.fullName,
                age: newPatient.age,
                phone: newPatient.phone,
                gender: newPatient.gender,
                caseType: newPatient.caseType,
                status: newPatient.status,
                doctorId: newPatient.doctorId,
                registeredBy: req.user!.role,
            },
        });
    } catch (error: any) {
        console.error("Register patient error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to register patient",
        });
    }
};
