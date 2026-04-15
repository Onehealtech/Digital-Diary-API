"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskService = void 0;
const Task_1 = require("../models/Task");
const Appuser_1 = require("../models/Appuser");
const Patient_1 = require("../models/Patient");
const Notification_1 = require("../models/Notification");
const sequelize_1 = require("sequelize");
const fcm_service_1 = require("./fcm.service");
class TaskService {
    /**
     * Get all tasks with filters
     */
    async getAllTasks(params) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;
        const whereClause = {};
        // Role-based filtering
        if (params.userRole === "DOCTOR") {
            whereClause.createdBy = params.userId;
        }
        else if (params.userRole === "ASSISTANT") {
            whereClause.assignedTo = params.userId;
        }
        if (params.assignedTo) {
            whereClause.assignedTo = params.assignedTo;
        }
        if (params.createdBy) {
            whereClause.createdBy = params.createdBy;
        }
        if (params.status) {
            whereClause.status = params.status;
        }
        if (params.priority) {
            whereClause.priority = params.priority;
        }
        if (params.overdue) {
            whereClause.dueDate = { [sequelize_1.Op.lt]: new Date() };
            whereClause.status = { [sequelize_1.Op.ne]: "completed" };
        }
        const tasks = await Task_1.Task.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "creator",
                    attributes: ["id", "fullName", "email"],
                },
                {
                    model: Appuser_1.AppUser,
                    as: "assignee",
                    attributes: ["id", "fullName", "email"],
                },
            ],
            limit,
            offset,
            order: [["dueDate", "ASC"]],
        });
        // Calculate stats
        const pending = await Task_1.Task.count({
            where: { ...whereClause, status: "pending" },
        });
        const completed = await Task_1.Task.count({
            where: { ...whereClause, status: "completed" },
        });
        const overdue = await Task_1.Task.count({
            where: {
                ...whereClause,
                dueDate: { [sequelize_1.Op.lt]: new Date() },
                status: { [sequelize_1.Op.ne]: "completed" },
            },
        });
        return {
            data: tasks.rows,
            total: tasks.count,
            page,
            limit,
            totalPages: Math.ceil(tasks.count / limit),
            stats: { pending, completed, overdue },
        };
    }
    /**
     * Get task by ID
     */
    async getTaskById(taskId) {
        const task = await Task_1.Task.findByPk(taskId, {
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "creator",
                    attributes: ["id", "fullName", "email"],
                },
                {
                    model: Appuser_1.AppUser,
                    as: "assignee",
                    attributes: ["id", "fullName", "email"],
                },
            ],
        });
        if (!task) {
            throw new Error("Task not found");
        }
        // If relatedPatientIds exist, fetch patient details
        let patients = [];
        if (task.relatedPatientIds && task.relatedPatientIds.length > 0) {
            patients = await Patient_1.Patient.findAll({
                where: {
                    id: { [sequelize_1.Op.in]: task.relatedPatientIds },
                },
                attributes: ["id", "fullName", "phone", "stickerId", "status"],
            });
        }
        return { task, patients };
    }
    /**
     * Create new task (Doctor assigns to Assistant)
     */
    async createTask(data) {
        // Verify assignedTo is an assistant under this doctor
        const assistant = await Appuser_1.AppUser.findOne({
            where: {
                id: data.assignedTo,
                role: "ASSISTANT",
                parentId: data.createdBy,
            },
        });
        if (!assistant) {
            throw new Error("Assistant not found or not assigned to this doctor");
        }
        const task = await Task_1.Task.create({
            createdBy: data.createdBy,
            assignedTo: data.assignedTo,
            title: data.title,
            description: data.description,
            taskType: data.taskType,
            priority: data.priority,
            dueDate: data.dueDate,
            relatedPatientIds: data.relatedPatientIds,
            status: "pending",
            notificationSent: false,
        });
        // Create notification for assistant
        const notification = await Notification_1.Notification.create({
            recipientId: data.assignedTo,
            recipientType: "staff",
            senderId: data.createdBy,
            type: "task-assigned",
            severity: data.priority === "urgent" ? "high" : "medium",
            title: "New Task Assigned",
            message: `You have been assigned a new task: ${data.title}`,
            relatedTaskId: task.id,
            read: false,
            delivered: true,
        });
        // Send FCM push notification to assistant
        if (assistant.fcmToken) {
            fcm_service_1.fcmService
                .sendPushNotification(assistant.fcmToken, "New Task Assigned", `You have been assigned a new task: ${data.title}`, {
                notificationId: notification.id,
                type: "task-assigned",
                severity: data.priority === "urgent" ? "high" : "medium",
                taskId: task.id,
            })
                .catch((err) => console.error("FCM push error (task assigned):", err));
        }
        task.notificationSent = true;
        await task.save();
        return task;
    }
    /**
     * Update task
     */
    async updateTask(taskId, userId, userRole, updates) {
        const task = await Task_1.Task.findByPk(taskId);
        if (!task) {
            throw new Error("Task not found");
        }
        // Authorization check
        if (userRole === "DOCTOR" && task.createdBy !== userId) {
            throw new Error("Unauthorized: You can only update your own tasks");
        }
        if (userRole === "ASSISTANT" && task.assignedTo !== userId) {
            throw new Error("Unauthorized: You can only update tasks assigned to you");
        }
        // DOCTOR can update everything except status
        if (userRole === "DOCTOR") {
            if (updates.title)
                task.title = updates.title;
            if (updates.description)
                task.description = updates.description;
            if (updates.priority)
                task.priority = updates.priority;
            if (updates.dueDate)
                task.dueDate = updates.dueDate;
        }
        // ASSISTANT can update status and completion notes
        if (userRole === "ASSISTANT") {
            if (updates.status) {
                task.status = updates.status;
                if (updates.status === "completed") {
                    task.completedAt = new Date();
                }
            }
            if (updates.completionNotes) {
                task.completionNotes = updates.completionNotes;
            }
        }
        await task.save();
        return task;
    }
    /**
     * Mark task as completed (Assistant only)
     */
    async completeTask(taskId, assistantId, completionNotes) {
        const task = await Task_1.Task.findByPk(taskId);
        if (!task) {
            throw new Error("Task not found");
        }
        if (task.assignedTo !== assistantId) {
            throw new Error("Unauthorized: Task not assigned to you");
        }
        task.status = "completed";
        task.completedAt = new Date();
        if (completionNotes) {
            task.completionNotes = completionNotes;
        }
        await task.save();
        // Notify doctor
        const notification = await Notification_1.Notification.create({
            recipientId: task.createdBy,
            recipientType: "staff",
            senderId: assistantId,
            type: "info",
            severity: "low",
            title: "Task Completed",
            message: `Task "${task.title}" has been completed by your assistant.`,
            relatedTaskId: task.id,
            read: false,
            delivered: true,
        });
        // Send FCM push notification to doctor
        const doctor = await Appuser_1.AppUser.findByPk(task.createdBy);
        if (doctor?.fcmToken) {
            fcm_service_1.fcmService
                .sendPushNotification(doctor.fcmToken, "Task Completed", `Task "${task.title}" has been completed by your assistant.`, {
                notificationId: notification.id,
                type: "task-completed",
                severity: "low",
                taskId: task.id,
            })
                .catch((err) => console.error("FCM push error (task completed):", err));
        }
        return task;
    }
    /**
     * Delete task (Doctor only)
     */
    async deleteTask(taskId, doctorId) {
        const task = await Task_1.Task.findByPk(taskId);
        if (!task) {
            throw new Error("Task not found");
        }
        if (task.createdBy !== doctorId) {
            throw new Error("Unauthorized: You can only delete your own tasks");
        }
        await task.destroy();
        return { success: true };
    }
}
exports.TaskService = TaskService;
