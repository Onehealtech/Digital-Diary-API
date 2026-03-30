import { Response } from "express";
import { Reminder } from "../models/Reminder";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { Op } from "sequelize";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { twilioService } from "../service/twilio.service";
import { sendAppointmentRejectionEmail } from "../service/emailService";
import { notificationService } from "../service/notification.service";
import { t, translateReminderType, translateReminderStatus, getPatientLanguage, translateArrayFields } from "../utils/translations";

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
        const attachmentUrl = (req as any).file
            ? `/uploads/notification_attachments/${(req as any).file.filename}`
            : (req.body.attachmentUrl as string | undefined) || undefined;

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
            patientId: patient.id,
            message,
            reminderDate: new Date(reminderDate),
            type,
            status: "PENDING",
            createdBy: req.user!.id,
            reminderCount: 1,
            attachmentUrl,
        });
        
        await notificationService.createNotification({
            senderId: req.user!.id,
            recipientId: patient.id,
            recipientType: "patient",
            type: "reminder",
            severity: "medium",
            title: "New Appointment Reminder",
            message: `You have a ${type} reminder scheduled on ${new Date(reminderDate).toLocaleString()}.`,
            relatedTaskId: reminder.id,
            deliveryMethod: "in-app",
        });

        // Send SMS
        if (patient.phone) {
            const smsContent = `OneHeal Appointment/Reminder: ${type}\nDate: ${new Date(reminderDate).toLocaleString()}\n${message}`;
            twilioService.sendSMS(patient.phone, smsContent).catch(err => console.error("SMS reminder err:", err));
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

        const lang = await getPatientLanguage(patientId);

        let translatedReminders = reminders.map((r) => {
            const data = r.toJSON();
            return {
                ...data,
                typeLabel: translateReminderType(data.type, lang),
                statusLabel: translateReminderStatus(data.status, lang),
            };
        });

        // Translate dynamic message content for Hindi
        if (lang === "hi") {
            translatedReminders = await translateArrayFields(translatedReminders, ["message"], lang);
        }

        res.status(200).json({
            success: true,
            message: t("msg.remindersRetrieved", lang),
            data: {
                reminders: translatedReminders,
                total: translatedReminders.length,
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

export const getPatientRemindersforadmin = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.params.patientId;
        const { status } = req.query;

        const whereClause: any = { patientId };

        // Filter by status if provided
        if (status && ["PENDING", "READ", "EXPIRED"].includes(status as string)) {
            whereClause.status = status;
        }

        const reminders = await Reminder.findAll({
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

        const lang = await getPatientLanguage(patientId);

        res.status(200).json({
            success: true,
            message: t("msg.reminderMarkedRead", lang),
            data: {
                id: reminder.id,
                status: reminder.status,
                statusLabel: translateReminderStatus(reminder.status, lang),
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
        const userId = req.user!.id;
        const userRole = req.user!.role;
        const parentId = (req.user as any)?.parentId;
        const { status, patientId } = req.query;

        // Doctor sees own + all their assistants' reminders
        // Assistant sees own + their doctor's reminders
        let createdByIds: string[] = [userId];

        if (userRole === "DOCTOR") {
            // Find all assistants belonging to this doctor (include soft-deleted to catch all reminders)
            const assistants = await AppUser.findAll({
                where: { parentId: userId, role: "ASSISTANT" },
                attributes: ["id"],
                raw: true,
                paranoid: false, // Include soft-deleted assistants too
            });
            createdByIds = [userId, ...assistants.map((a: { id: string }) => a.id)];
            console.log(`[Reminders] Doctor ${userId} — querying createdBy IDs:`, createdByIds);
        } else if (userRole === "ASSISTANT" && parentId) {
            createdByIds = [userId, parentId];
            console.log(`[Reminders] Assistant ${userId} — querying createdBy IDs:`, createdByIds);
        }

        const whereClause: any = { createdBy: { [Op.in]: createdByIds } };

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

/**
 * PATCH /api/v1/patient/reminders/:id/respond
 * Patient responds to Reminder (ACCEPT/REJECT)
 */
export const respondToReminder = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const patientId = req.user!.id;
        const { status, rejectReason } = req.body;

        if (!status || !["ACCEPTED", "REJECTED"].includes(status)) {
            res.status(400).json({
                success: false,
                message: "Valid status (ACCEPTED/REJECTED) is required"
            });
            return;
        }

        const reminder = await Reminder.findOne({
            where: { id, patientId },
            include: [
                { model: Patient },
                { model: AppUser, as: "creator", attributes: ["id", "fullName", "email"] }
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
        reminder.status = status as "ACCEPTED" | "REJECTED";

        if (status === "REJECTED") {
            reminder.rejectReason = rejectReason || null;
        }

        await reminder.save();

        // If rejected → notify doctor/assistant
        if (status === "REJECTED") {

            const creator = reminder.getDataValue("creator");

            if (creator) {

                // In-app Notification
                await notificationService.createNotification({
                    senderId: creator.id,
                    recipientId: creator.id,
                    recipientType: "staff",
                    type: "alert",
                    severity: "medium",
                    title: "Appointment Rejected",
                    message: `Patient ${reminder.patient?.fullName || "A patient"} rejected the ${reminder.type} appointment. Reason: ${rejectReason || "None"}`,
                    relatedTaskId: reminder.id,
                    deliveryMethod: "in-app",
                });

                // Email Notification
                if (creator.email) {
                    await sendAppointmentRejectionEmail(
                        creator.email,
                        creator.fullName,
                        reminder.patient?.fullName || "Unknown",
                        reminder.type,
                        new Date(reminder.reminderDate).toLocaleString(),
                        rejectReason || "No reason given"
                    ).catch(err =>
                        console.error("Rejection Email Error:", err)
                    );
                }
            }
        }

        const lang = await getPatientLanguage(patientId);
        const msgKey = status === "ACCEPTED" ? "msg.reminderAccepted" : "msg.reminderRejected";

        res.status(200).json({
            success: true,
            message: t(msgKey, lang),
            data: reminder,
        });

    } catch (error: any) {
        console.error("Respond reminder error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to respond to reminder"
        });
    }
};

/**
 * POST /api/v1/clinic/reminders/:id/resend
 * Doctor/Assistant resends the same reminder. Max 2 times total (original + 1 resend)
 */
export const resendReminder = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        const userRole = req.user!.role;
        const parentId = (req.user as any)?.parentId;
        const { newReminderDate, newReminderMessage } = req.body;

        // Doctor can reschedule own + assistant-created reminders
        // Assistant can reschedule own + their doctor's reminders
        let allowedCreatorIds: string[] = [userId];
        if (userRole === "DOCTOR") {
            const assistants = await AppUser.findAll({
                where: { parentId: userId, role: "ASSISTANT" },
                attributes: ["id"],
                raw: true,
                paranoid: false,
            });
            allowedCreatorIds = [userId, ...assistants.map((a: { id: string }) => a.id)];
        } else if (userRole === "ASSISTANT" && parentId) {
            allowedCreatorIds = [userId, parentId];
        }

        const reminder = await Reminder.findOne({
            where: { id, createdBy: { [Op.in]: allowedCreatorIds } },
            include: [{ model: Patient }]
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
            reminder.reminderDate = parsedDate;      // Update the actual appointment date
            reminder.newReminderDate = parsedDate;    // Also store as the rescheduled date
            console.log("[Reschedule] New date:", parsedDate.toISOString());
        }

        if (newReminderMessage) {
            reminder.message = newReminderMessage;
            reminder.newReminderMessage = newReminderMessage;
        }

        reminder.reminderCount += 1;
        reminder.status = "PENDING"; // Reset so patient sees the new appointment with action buttons

        await reminder.save();
        // 🔔 Create in-app notification
        if (reminder.patient) {
            await notificationService.createNotification({
                senderId: userId,
                recipientId: reminder.patient.id,
                recipientType: "patient",
                type: "reminder",
                severity: "medium",
                title: "Appointment Reminder Updated",
                message: `Your ${reminder.type} appointment has been rescheduled to ${new Date(
                    reminder.newReminderDate || reminder.reminderDate
                ).toLocaleString()}.`,
                relatedTaskId: reminder.id,
                deliveryMethod: "in-app",
            });
        }
        // SMS
        if (reminder.patient?.phone) {

            const smsContent = `OneHeal Appointment Update

Type: ${reminder.type}
New Date: ${new Date(reminder.newReminderDate || reminder.reminderDate).toLocaleString()}

${reminder.newReminderMessage || reminder.message}`;

            twilioService
                .sendSMS(reminder.patient.phone, smsContent)
                .catch((err: unknown) => console.error("SMS resend err:", err));
        }

        res.status(200).json({
            success: true,
            message: "Reminder rescheduled and resent successfully",
            data: reminder,
        });

    } catch (error: any) {
        console.error("Resend reminder error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to resend reminder"
        });
    }
};