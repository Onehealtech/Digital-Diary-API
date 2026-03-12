import { Reminder } from "../models/Reminder";
import { Notification } from "../models/Notification";
import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { Op } from "sequelize";

/**
 * Service to automatically close unresponded reminders
 */
class ReminderCronService {
    private intervalId: NodeJS.Timeout | null = null;

    /**
     * Start the cron job
     * Checks every hour by default (3600000 ms)
     */
    start(intervalMs: number = 3600000) {
        if (this.intervalId) {
            console.warn("ReminderCronService is already running.");
            return;
        }

        console.log("⏰ Started ReminderCronService. Unanswered reminders will be auto-closed periodically.");

        this.intervalId = setInterval(async () => {
             await this.processUnansweredReminders();
        }, intervalMs);
    }

    /**
     * Stop the cron job
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("⏰ Stopped ReminderCronService.");
        }
    }

    /**
     * Find PENDING reminders past their reminderDate + 24 hours
     * Mark them as CLOSED and notify the creator (Doctor/Assistant)
     */
    async processUnansweredReminders() {
        try {
            // Cutoff time: 24 hours ago
            const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const expiredReminders = await Reminder.findAll({
                where: {
                    status: "PENDING",
                    reminderDate: {
                        [Op.lt]: cutoffDate
                    }
                },
                include: [{ model: Patient }]
            });

            if (expiredReminders.length === 0) {
                return; // Nothing to do
            }

            console.log(`⏰ Found ${expiredReminders.length} unanswered reminders to auto-close.`);

            for (const reminder of expiredReminders) {
                 reminder.status = "CLOSED";
                 await reminder.save();

                 const creator = await AppUser.findByPk(reminder.createdBy);
                 if (creator) {
                      await Notification.create({
                          senderId: reminder.patientId, // Contextually from patient 
                          recipientId: creator.id,
                          recipientType: "staff",
                          type: "alert",
                          severity: "low",
                          title: "Reminder Auto-Closed",
                          message: `The ${reminder.type} appointment reminder for ${reminder.patient?.fullName || "patient"} was not responded to within 24 hours and has been auto-closed.`,
                          relatedTaskId: reminder.id,
                          deliveryMethod: "in-app",
                          delivered: true,
                      });
                 }
            }

            console.log("⏰ Finished processing unanswered reminders.");

        } catch (error) {
            console.error("error processing unanswered reminders:", error);
        }
    }
}

export const reminderCronService = new ReminderCronService();
