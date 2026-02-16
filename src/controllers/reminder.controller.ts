import { Response } from "express";
import { Reminder } from "../models/Reminder";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * POST /api/v1/clinic/create-reminder
 * Doctor or Assistant creates a reminder for a patient
 */
export const createReminder = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { patientId, message, reminderDate, type } = req.body;

        // Validate required fields
        if (!patientId || !message || !reminderDate || !type) {
            res.status(400).json({
                success: false,
                message: "Patient ID, message, reminder date, and type are required",
            });
            return;
        }

        // Validate reminder type
        const validTypes = ["APPOINTMENT", "CHEMOTHERAPY", "RADIOLOGY", "FOLLOW_UP", "OTHER"];
        if (!validTypes.includes(type)) {
            res.status(400).json({
                success: false,
                message: `Invalid reminder type. Must be one of: ${validTypes.join(", ")}`,
            });
            return;
        }

        // Check if patient exists
        const patient = await Patient.findOne({ where: { diaryId: patientId } });
        if (!patient) {
            res.status(404).json({
                success: false,
                message: "Patient not found",
            });
            return;
        }

        // Verify doctor/assistant has access to this patient
        let hasAccess = false;
        if (req.user!.role === "DOCTOR") {
            hasAccess = patient.doctorId === req.user!.id;
        } else if (req.user!.role === "ASSISTANT") {
            hasAccess = patient.doctorId === req.user!.parentId;
        }

        if (!hasAccess) {
            res.status(403).json({
                success: false,
                message: "You don't have access to this patient",
            });
            return;
        }

        // Create reminder
        const reminder = await Reminder.create({
            patientId:patient.id,
            message,
            reminderDate: new Date(reminderDate),
            type,
            status: "PENDING",
            createdBy: req.user!.id,
        });

        res.status(201).json({
            success: true,
            message: "Reminder created successfully",
            data: {
                id: reminder.id,
                patientId: reminder.patientId,
                message: reminder.message,
                reminderDate: reminder.reminderDate,
                type: reminder.type,
                status: reminder.status,
                createdAt: reminder.createdAt,
            },
        });
    } catch (error: any) {
        console.error("Create reminder error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create reminder",
        });
    }
};

/**
 * GET /api/v1/patient/reminders
 * Patient fetches their reminders
 */
export const getPatientReminders = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const { status } = req.query;

        const whereClause: any = { patientId };

        // Filter by status if provided
        if (status && ["PENDING", "READ", "EXPIRED"].includes(status as string)) {
            whereClause.status = status;
        }

        const reminders = await Reminder.findAll({
            where: whereClause,
            order: [["reminderDate", "DESC"]],
            attributes: [
                "id",
                "message",
                "reminderDate",
                "type",
                "status",
                "createdAt",
            ],
        });

        res.status(200).json({
            success: true,
            message: "Reminders retrieved successfully",
            data: {
                reminders,
                total: reminders.length,
            },
        });
    } catch (error: any) {
        console.error("Get patient reminders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve reminders",
        });
    }
};

/**
 * PATCH /api/v1/patient/reminders/:id/read
 * Mark reminder as read
 */
export const markReminderAsRead = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const patientId = req.user!.id;

        const reminder = await Reminder.findOne({
            where: { id, patientId },
        });

        if (!reminder) {
            res.status(404).json({
                success: false,
                message: "Reminder not found",
            });
            return;
        }

        reminder.status = "READ";
        await reminder.save();

        res.status(200).json({
            success: true,
            message: "Reminder marked as read",
            data: {
                id: reminder.id,
                status: reminder.status,
            },
        });
    } catch (error: any) {
        console.error("Mark reminder as read error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to mark reminder as read",
        });
    }
};

/**
 * GET /api/v1/dashboard/reminders
 * Doctor/Assistant views reminders they created
 */
export const getDashboardReminders = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const createdBy = req.user!.id;
        const { status, patientId } = req.query;

        const whereClause: any = { createdBy };

        // Filter by status if provided
        if (status && ["PENDING", "READ", "EXPIRED"].includes(status as string)) {
            whereClause.status = status;
        }

        // Filter by patient if provided
        if (patientId) {
            whereClause.patientId = patientId;
        }

        const reminders = await Reminder.findAll({
            where: whereClause,
            include: [
                {
                    model: Patient,
                    attributes: ["id", "diaryId", "fullName", "phone"],
                },
            ],
            order: [["reminderDate", "DESC"]],
        });

        res.status(200).json({
            success: true,
            message: "Reminders retrieved successfully",
            data: {
                reminders,
                total: reminders.length,
            },
        });
    } catch (error: any) {
        console.error("Get dashboard reminders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve reminders",
        });
    }
};
