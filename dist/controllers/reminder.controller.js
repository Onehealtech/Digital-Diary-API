"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendReminder = exports.respondToReminder = exports.getDashboardReminders = exports.markReminderAsRead = exports.getPatientRemindersforadmin = exports.getPatientReminders = exports.createReminder = void 0;
const Reminder_1 = require("../models/Reminder");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const Notification_1 = require("../models/Notification");
const twilioService_1 = require("../service/twilioService");
const emailService_1 = require("../service/emailService");
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
            reminderCount: 1
        });
        // Send Twilio SMS
        if (patient.phone) {
            const smsContent = `OneHeal Appointment/Reminder: ${type}\nDate: ${new Date(reminderDate).toLocaleString()}\n${message}`;
            twilioService_1.twilioService.sendSMS(patient.phone, smsContent).catch(err => console.error("Twilio SMS reminder err:", err));
        }
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
const getPatientRemindersforadmin = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const { status } = req.query;
        const whereClause = { patientId };
        // Filter by status if provided
        if (status && ["PENDING", "READ", "EXPIRED"].includes(status)) {
            whereClause.status = status;
        }
        const reminders = await Reminder_1.Reminder.findAll({
            where: whereClause,
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
        console.error("Get patient reminders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve reminders",
        });
    }
};
exports.getPatientRemindersforadmin = getPatientRemindersforadmin;
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
/**
 * PATCH /api/v1/patient/reminders/:id/respond
 * Patient responds to Reminder (ACCEPT/REJECT)
 */
const respondToReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const patientId = req.user.id;
        const { status, rejectReason } = req.body;
        if (!status || !["ACCEPTED", "REJECTED"].includes(status)) {
            res.status(400).json({
                success: false,
                message: "Valid status (ACCEPTED/REJECTED) is required"
            });
            return;
        }
        const reminder = await Reminder_1.Reminder.findOne({
            where: { id, patientId },
            include: [
                { model: Patient_1.Patient },
                { model: Appuser_1.AppUser, as: "creator", attributes: ["id", "fullName", "email"] }
            ]
        });
        if (!reminder) {
            res.status(404).json({ success: false, message: "Reminder not found" });
            return;
        }
        if (reminder.status === "CLOSED" || reminder.status === "EXPIRED") {
            res.status(400).json({
                success: false,
                message: "Cannot respond to this reminder anymore"
            });
            return;
        }
        // Update reminder status
        reminder.status = status;
        if (status === "REJECTED") {
            reminder.rejectReason = rejectReason || null;
        }
        await reminder.save();
        // If rejected → notify doctor/assistant
        if (status === "REJECTED") {
            const creator = reminder.getDataValue("creator");
            if (creator) {
                // In-app Notification
                await Notification_1.Notification.create({
                    senderId: creator.id,
                    recipientId: creator.id,
                    recipientType: "staff",
                    type: "alert",
                    severity: "medium",
                    title: "Appointment Rejected",
                    message: `Patient ${reminder.patient?.fullName || "A patient"} rejected the ${reminder.type} appointment. Reason: ${rejectReason || "None"}`,
                    relatedTaskId: reminder.id,
                    deliveryMethod: "in-app",
                    delivered: true,
                });
                // Email Notification
                if (creator.email) {
                    await (0, emailService_1.sendAppointmentRejectionEmail)(creator.email, creator.fullName, reminder.patient?.fullName || "Unknown", reminder.type, new Date(reminder.reminderDate).toLocaleString(), rejectReason || "No reason given").catch(err => console.error("Rejection Email Error:", err));
                }
            }
        }
        res.status(200).json({
            success: true,
            message: `Reminder ${status.toLowerCase()} successfully`,
            data: reminder,
        });
    }
    catch (error) {
        console.error("Respond reminder error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to respond to reminder"
        });
    }
};
exports.respondToReminder = respondToReminder;
/**
 * POST /api/v1/clinic/reminders/:id/resend
 * Doctor/Assistant resends the same reminder. Max 2 times total (original + 1 resend)
 */
const resendReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { newReminderDate, newReminderMessage } = req.body;
        const reminder = await Reminder_1.Reminder.findOne({
            where: { id, createdBy: userId },
            include: [{ model: Patient_1.Patient }]
        });
        if (!reminder) {
            res.status(404).json({ success: false, message: "Reminder not found" });
            return;
        }
        if (reminder.status === "ACCEPTED" ||
            reminder.status === "CLOSED" ||
            reminder.status === "EXPIRED") {
            res.status(400).json({
                success: false,
                message: `Cannot resend a reminder that is ${reminder.status}`
            });
            return;
        }
        if (reminder.reminderCount >= 2) {
            reminder.status = "CLOSED";
            await reminder.save();
            res.status(400).json({
                success: false,
                message: "Max resend limit reached. Reminder has been closed."
            });
            return;
        }
        // ✅ Save new reminder info
        if (newReminderDate) {
            reminder.newReminderDate = new Date(newReminderDate);
        }
        if (newReminderMessage) {
            reminder.newReminderMessage = newReminderMessage;
        }
        reminder.reminderCount += 1;
        await reminder.save();
        // SMS
        if (reminder.patient?.phone) {
            const smsContent = `OneHeal Appointment Update

Type: ${reminder.type}
New Date: ${new Date(reminder.newReminderDate || reminder.reminderDate).toLocaleString()}

${reminder.newReminderMessage || reminder.message}`;
            twilioService_1.twilioService
                .sendSMS(reminder.patient.phone, smsContent)
                .catch(err => console.error("Twilio SMS resend err:", err));
        }
        res.status(200).json({
            success: true,
            message: "Reminder rescheduled and resent successfully",
            data: reminder,
        });
    }
    catch (error) {
        console.error("Resend reminder error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to resend reminder"
        });
    }
};
exports.resendReminder = resendReminder;
