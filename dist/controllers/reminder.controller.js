"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardReminders = exports.markReminderAsRead = exports.getPatientReminders = exports.createReminder = void 0;
const Reminder_1 = require("../models/Reminder");
const Patient_1 = require("../models/Patient");
/**
 * POST /api/v1/clinic/create-reminder
 * Doctor or Assistant creates a reminder for a patient
 */
const createReminder = async (req, res) => {
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
        const patient = await Patient_1.Patient.findOne({ where: { diaryId: patientId } });
        if (!patient) {
            res.status(404).json({
                success: false,
                message: "Patient not found",
            });
            return;
        }
        // Verify doctor/assistant has access to this patient
        let hasAccess = false;
        if (req.user.role === "DOCTOR") {
            hasAccess = patient.doctorId === req.user.id;
        }
        else if (req.user.role === "ASSISTANT") {
            hasAccess = patient.doctorId === req.user.parentId;
        }
        if (!hasAccess) {
            res.status(403).json({
                success: false,
                message: "You don't have access to this patient",
            });
            return;
        }
        // Create reminder
        const reminder = await Reminder_1.Reminder.create({
            patientId: patient.id,
            message,
            reminderDate: new Date(reminderDate),
            type,
            status: "PENDING",
            createdBy: req.user.id,
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
    }
    catch (error) {
        console.error("Create reminder error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create reminder",
        });
    }
};
exports.createReminder = createReminder;
/**
 * GET /api/v1/patient/reminders
 * Patient fetches their reminders
 */
const getPatientReminders = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { status } = req.query;
        const whereClause = { patientId };
        // Filter by status if provided
        if (status && ["PENDING", "READ", "EXPIRED"].includes(status)) {
            whereClause.status = status;
        }
        const reminders = await Reminder_1.Reminder.findAll({
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
    }
    catch (error) {
        console.error("Get patient reminders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve reminders",
        });
    }
};
exports.getPatientReminders = getPatientReminders;
/**
 * PATCH /api/v1/patient/reminders/:id/read
 * Mark reminder as read
 */
const markReminderAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const patientId = req.user.id;
        const reminder = await Reminder_1.Reminder.findOne({
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
    }
    catch (error) {
        console.error("Mark reminder as read error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to mark reminder as read",
        });
    }
};
exports.markReminderAsRead = markReminderAsRead;
/**
 * GET /api/v1/dashboard/reminders
 * Doctor/Assistant views reminders they created
 */
const getDashboardReminders = async (req, res) => {
    try {
        const createdBy = req.user.id;
        const { status, patientId } = req.query;
        const whereClause = { createdBy };
        // Filter by status if provided
        if (status && ["PENDING", "READ", "EXPIRED"].includes(status)) {
            whereClause.status = status;
        }
        // Filter by patient if provided
        if (patientId) {
            whereClause.patientId = patientId;
        }
        const reminders = await Reminder_1.Reminder.findAll({
            where: whereClause,
            include: [
                {
                    model: Patient_1.Patient,
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
    }
    catch (error) {
        console.error("Get dashboard reminders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve reminders",
        });
    }
};
exports.getDashboardReminders = getDashboardReminders;
