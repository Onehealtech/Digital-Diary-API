"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendReminder = exports.respondToReminder = exports.getDashboardReminders = exports.markReminderAsRead = exports.getPatientRemindersforadmin = exports.getPatientReminders = exports.createReminder = void 0;
const path_1 = __importDefault(require("path"));
const Reminder_1 = require("../models/Reminder");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const sequelize_1 = require("sequelize");
const emailService_1 = require("../service/emailService");
const notification_service_1 = require("../service/notification.service");
const smsfortius_service_1 = require("../service/smsfortius.service");
const s3Upload_1 = require("../utils/s3Upload");
const translations_1 = require("../utils/translations");
/**
 * POST /api/v1/clinic/create-reminder
 * Doctor or Assistant creates a reminder for a patient
 */
const createReminder = async (req, res) => {
    try {
        const { patientId, message, reminderDate, type, force } = req.body;
        const forceCreate = force === true || force === "true";
        let attachmentUrl = req.body.attachmentUrl || undefined;
        const file = req.file;
        if (file) {
            const ext = path_1.default.extname(file.originalname).toLowerCase() || ".bin";
            const s3Key = `reminders/attachments/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
            attachmentUrl = await (0, s3Upload_1.uploadBufferToS3)(file.buffer, file.mimetype, s3Key);
        }
        // Validate required fields
        if (!patientId || !message || !reminderDate || !type) {
            res.status(400).json({
                success: false,
                message: "Patient ID, message, reminder date, and type are required",
            });
            return;
        }
        // Validate reminder type
        const validTypes = ["APPOINTMENT", "CHEMOTHERAPY", "RADIOLOGY", "SURGERY", "FOLLOW_UP", "OTHER"];
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
        // Check for existing PENDING reminder at the same time (unless force flag is set)
        if (!forceCreate) {
            const requestedTime = new Date(reminderDate);
            const windowStart = new Date(requestedTime.getTime() - 30 * 60 * 1000); // -30 min
            const windowEnd = new Date(requestedTime.getTime() + 30 * 60 * 1000); // +30 min
            const existing = await Reminder_1.Reminder.findOne({
                where: {
                    patientId: patient.id,
                    status: "PENDING",
                    reminderDate: { [sequelize_1.Op.between]: [windowStart, windowEnd] },
                },
            });
            if (existing) {
                res.status(409).json({
                    success: false,
                    isDuplicate: true,
                    message: `An appointment is already scheduled near this time (${new Date(existing.reminderDate).toLocaleString()}).`,
                });
                return;
            }
        }
        // Create reminder
        const reminder = await Reminder_1.Reminder.create({
            patientId: patient.id,
            message,
            reminderDate: new Date(reminderDate),
            type,
            status: "PENDING",
            createdBy: req.user.id,
            reminderCount: 1,
            attachmentUrl,
        });
        const isHindi = patient.language === "hi";
        const dateObj = new Date(reminderDate);
        const formattedDate = dateObj.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
        });
        const enAlertMessage = `You have a ${type} reminder scheduled on ${formattedDate}.`;
        const enSmsContent = `OneHeal Appointment/Reminder: ${type}\nDate: ${formattedDate}\n${message}`;
        let alertTitle = "New Appointment Reminder";
        let alertMessage = enAlertMessage;
        let smsContent = enSmsContent;
        if (isHindi) {
            const [hiTitle, hiAlertMessage, hiType, hiDoctorMessage] = await Promise.all([
                (0, translations_1.translateText)("New Appointment Reminder", "hi"),
                (0, translations_1.translateText)(enAlertMessage, "hi"),
                (0, translations_1.translateText)(type, "hi"),
                (0, translations_1.translateText)(message, "hi"),
            ]);
            alertTitle = `New Appointment Reminder / ${hiTitle}`;
            alertMessage = `${enAlertMessage}\n\n${hiAlertMessage}`;
            // eslint-disable-next-line no-useless-concat
            smsContent = `${enSmsContent}\n\n---\n` + `OneHeal: ${hiType}\n${formattedDate}\n${hiDoctorMessage}`;
        }
        await notification_service_1.notificationService.createNotification({
            senderId: req.user.id,
            recipientId: patient.id,
            recipientType: "patient",
            type: "reminder",
            severity: "medium",
            title: alertTitle,
            message: alertMessage,
            relatedTaskId: reminder.id,
            deliveryMethod: "in-app",
            attachmentUrl: attachmentUrl,
        });
        // Send SMS via Fortius (DLT-approved templates) + Twilio fallback
        if (patient.phone) {
            const dateObj = new Date(reminderDate);
            const dateStr = dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
            const timeStr = dateObj.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
            // Get doctor name for Fortius template
            const doctor = await Appuser_1.AppUser.findByPk(req.user.role === "ASSISTANT" ? req.user.parentId : req.user.id, { attributes: ["fullName", "phone"] });
            const doctorName = doctor?.fullName || "your Doctor";
            // Template 2: Appointment SMS to patient
            (0, smsfortius_service_1.sendDoctorAppointmentSMS)(patient.phone, doctorName, dateStr, timeStr)
                .catch(err => console.error("Fortius appointment SMS err:", err));
            // Template 3: Consultation alert to doctor/staff
            if (doctor?.phone) {
                (0, smsfortius_service_1.sendConsultationAlert)(doctor.phone, patient.fullName || "A patient", dateStr, timeStr)
                    .catch(err => console.error("Fortius consultation alert err:", err));
            }
            // General SMS with full content
            (0, smsfortius_service_1.sendSMS)(patient.phone, smsContent).catch(err => console.error("Fortius SMS err:", err));
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
                "attachmentUrl",
            ],
        });
        const lang = await (0, translations_1.getPatientLanguage)(patientId);
        let translatedReminders = reminders.map((r) => {
            const data = r.toJSON();
            return {
                ...data,
                typeLabel: (0, translations_1.translateReminderType)(data.type, lang),
                statusLabel: (0, translations_1.translateReminderStatus)(data.status, lang),
            };
        });
        // Translate dynamic message content for Hindi
        if (lang === "hi") {
            translatedReminders = await (0, translations_1.translateArrayFields)(translatedReminders, ["message"], lang);
        }
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)("msg.remindersRetrieved", lang),
            data: {
                reminders: translatedReminders,
                total: translatedReminders.length,
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
        const lang = await (0, translations_1.getPatientLanguage)(patientId);
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)("msg.reminderMarkedRead", lang),
            data: {
                id: reminder.id,
                status: reminder.status,
                statusLabel: (0, translations_1.translateReminderStatus)(reminder.status, lang),
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
        const userId = req.user.id;
        const userRole = req.user.role;
        const parentId = req.user?.parentId;
        const { status, patientId } = req.query;
        // Doctor sees own + all their assistants' reminders
        // Assistant sees own + their doctor's reminders
        let createdByIds = [userId];
        if (userRole === "DOCTOR") {
            // Find all assistants belonging to this doctor (include soft-deleted to catch all reminders)
            const assistants = await Appuser_1.AppUser.findAll({
                where: { parentId: userId, role: "ASSISTANT" },
                attributes: ["id"],
                raw: true,
                paranoid: false, // Include soft-deleted assistants too
            });
            createdByIds = [userId, ...assistants.map((a) => a.id)];
            console.log(`[Reminders] Doctor ${userId} — querying createdBy IDs:`, createdByIds);
        }
        else if (userRole === "ASSISTANT" && parentId) {
            createdByIds = [userId, parentId];
            console.log(`[Reminders] Assistant ${userId} — querying createdBy IDs:`, createdByIds);
        }
        const whereClause = { createdBy: { [sequelize_1.Op.in]: createdByIds } };
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
        const creator = reminder.getDataValue("creator");
        const patientName = reminder.patient?.fullName || "A patient";
        const dateObj = new Date(reminder.reminderDate);
        const dateStr = dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const timeStr = dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        // If accepted → send consultation alert to doctor
        if (status === "ACCEPTED" && creator) {
            // Fetch doctor phone for SMS
            const doctorUser = await Appuser_1.AppUser.findByPk(creator.id, { attributes: ["phone"] });
            if (doctorUser?.phone) {
                (0, smsfortius_service_1.sendConsultationAlert)(doctorUser.phone, patientName, dateStr, timeStr)
                    .catch(err => console.error("Fortius consultation alert err:", err));
            }
        }
        // If rejected → notify doctor/assistant
        if (status === "REJECTED") {
            if (creator) {
                // In-app Notification
                await notification_service_1.notificationService.createNotification({
                    senderId: creator.id,
                    recipientId: creator.id,
                    recipientType: "staff",
                    type: "alert",
                    severity: "medium",
                    title: "Appointment Rejected",
                    message: `Patient ${patientName} rejected the ${reminder.type} appointment. Reason: ${rejectReason || "None"}`,
                    relatedTaskId: reminder.id,
                    deliveryMethod: "in-app",
                });
                // SMS alert to doctor about rejection
                const doctorUser = await Appuser_1.AppUser.findByPk(creator.id, { attributes: ["phone"] });
                if (doctorUser?.phone) {
                    (0, smsfortius_service_1.sendConsultationAlert)(doctorUser.phone, `${patientName} (REJECTED)`, dateStr, timeStr)
                        .catch(err => console.error("Fortius rejection alert err:", err));
                }
                // Email Notification
                if (creator.email) {
                    await (0, emailService_1.sendAppointmentRejectionEmail)(creator.email, creator.fullName, patientName, reminder.type, new Date(reminder.reminderDate).toLocaleString(), rejectReason || "No reason given").catch(err => console.error("Rejection Email Error:", err));
                }
            }
        }
        const lang = await (0, translations_1.getPatientLanguage)(patientId);
        const msgKey = status === "ACCEPTED" ? "msg.reminderAccepted" : "msg.reminderRejected";
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)(msgKey, lang),
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
        const userRole = req.user.role;
        const parentId = req.user?.parentId;
        const { newReminderDate, newReminderMessage } = req.body;
        // Doctor can reschedule own + assistant-created reminders
        // Assistant can reschedule own + their doctor's reminders
        let allowedCreatorIds = [userId];
        if (userRole === "DOCTOR") {
            const assistants = await Appuser_1.AppUser.findAll({
                where: { parentId: userId, role: "ASSISTANT" },
                attributes: ["id"],
                raw: true,
                paranoid: false,
            });
            allowedCreatorIds = [userId, ...assistants.map((a) => a.id)];
        }
        else if (userRole === "ASSISTANT" && parentId) {
            allowedCreatorIds = [userId, parentId];
        }
        const reminder = await Reminder_1.Reminder.findOne({
            where: { id, createdBy: { [sequelize_1.Op.in]: allowedCreatorIds } },
            include: [{ model: Patient_1.Patient }]
        });
        if (!reminder) {
            res.status(404).json({ success: false, message: "Reminder not found or you don't have permission to reschedule it" });
            return;
        }
        // Only block truly terminal statuses — allow reschedule for REJECTED, PENDING, READ
        if (reminder.status === "CLOSED" || reminder.status === "EXPIRED") {
            res.status(400).json({
                success: false,
                message: `Cannot reschedule a reminder that is ${reminder.status.toLowerCase()}`
            });
            return;
        }
        // Allow up to 5 reschedules (generous limit for back-and-forth scheduling)
        if (reminder.reminderCount >= 5) {
            reminder.status = "CLOSED";
            await reminder.save();
            res.status(400).json({
                success: false,
                message: "Max reschedule limit (5) reached. Please create a new appointment."
            });
            return;
        }
        // ✅ Save new reminder info — update both the main date and the newReminderDate
        console.log("[Reschedule] Input:", { newReminderDate, newReminderMessage, currentStatus: reminder.status, reminderCount: reminder.reminderCount });
        if (newReminderDate) {
            const parsedDate = new Date(newReminderDate);
            if (isNaN(parsedDate.getTime())) {
                res.status(400).json({ success: false, message: "Invalid date format provided" });
                return;
            }
            reminder.reminderDate = parsedDate; // Update the actual appointment date
            reminder.newReminderDate = parsedDate; // Also store as the rescheduled date
            console.log("[Reschedule] New date:", parsedDate.toISOString());
        }
        if (newReminderMessage) {
            reminder.message = newReminderMessage;
            reminder.newReminderMessage = newReminderMessage;
        }
        reminder.reminderCount += 1;
        reminder.status = "PENDING"; // Reset so patient sees the new appointment with action buttons
        await reminder.save();
        // Create in-app notification
        if (reminder.patient) {
            const isHindi = reminder.patient.language === "hi";
            const rescheduledDate = new Date(reminder.newReminderDate || reminder.reminderDate).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: true,
            });
            const doctorMessage = reminder.newReminderMessage || reminder.message;
            const enAlertMessage = `Your ${reminder.type} appointment has been rescheduled to ${rescheduledDate}.`;
            const enSmsContent = `OneHeal Appointment Update\n\nType: ${reminder.type}\nNew Date: ${rescheduledDate}\n\n${doctorMessage}`;
            let alertTitle = "Appointment Reminder Updated";
            let alertMessage = enAlertMessage;
            let smsContent = enSmsContent;
            if (isHindi) {
                const [hiTitle, hiAlertMessage, hiType, hiDoctorMessage] = await Promise.all([
                    (0, translations_1.translateText)("Appointment Reminder Updated", "hi"),
                    (0, translations_1.translateText)(enAlertMessage, "hi"),
                    (0, translations_1.translateText)(reminder.type, "hi"),
                    (0, translations_1.translateText)(doctorMessage, "hi"),
                ]);
                alertTitle = `Appointment Reminder Updated / ${hiTitle}`;
                alertMessage = `${enAlertMessage}\n\n${hiAlertMessage}`;
                // eslint-disable-next-line no-useless-concat
                smsContent = `${enSmsContent}\n\n---\n` + `OneHeal: ${hiType}\n${rescheduledDate}\n${hiDoctorMessage}`;
            }
            await notification_service_1.notificationService.createNotification({
                senderId: userId,
                recipientId: reminder.patient.id,
                recipientType: "patient",
                type: "reminder",
                severity: "medium",
                title: alertTitle,
                message: alertMessage,
                relatedTaskId: reminder.id,
                deliveryMethod: "in-app",
                attachmentUrl: reminder.attachmentUrl,
            });
            if (reminder.patient.phone) {
                const reschedDateObj = new Date(reminder.newReminderDate || reminder.reminderDate);
                const reschedDateStr = reschedDateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
                const reschedTimeStr = reschedDateObj.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
                // Get doctor name for Fortius template
                const doctor = await Appuser_1.AppUser.findByPk(userId, { attributes: ["fullName"] });
                const doctorName = doctor?.fullName || "your Doctor";
                // Fortius: appointment SMS to patient
                (0, smsfortius_service_1.sendDoctorAppointmentSMS)(reminder.patient.phone, doctorName, reschedDateStr, reschedTimeStr)
                    .catch((err) => console.error("Fortius resend SMS err:", err));
                // General SMS with full content
                (0, smsfortius_service_1.sendSMS)(reminder.patient.phone, smsContent)
                    .catch((err) => console.error("Fortius resend SMS err:", err));
            }
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
