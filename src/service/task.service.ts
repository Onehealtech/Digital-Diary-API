import { Task } from "../models/Task";
import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { Notification } from "../models/Notification";
import { Op } from "sequelize";
import { fcmService } from "./fcm.service";

export class TaskService {
  /**
   * Get all tasks with filters
   */
  async getAllTasks(params: {
    userId: string;
    userRole: string;
    page?: number;
    limit?: number;
    assignedTo?: string;
    createdBy?: string;
    status?: string;
    priority?: string;
    overdue?: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const whereClause: any = {};

    // Role-based filtering
    if (params.userRole === "DOCTOR") {
      whereClause.createdBy = params.userId;
    } else if (params.userRole === "ASSISTANT") {
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
      whereClause.dueDate = { [Op.lt]: new Date() };
      whereClause.status = { [Op.ne]: "completed" };
    }

    const tasks = await Task.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: AppUser,
          as: "creator",
          attributes: ["id", "fullName", "email"],
        },
        {
          model: AppUser,
          as: "assignee",
          attributes: ["id", "fullName", "email"],
        },
      ],
      limit,
      offset,
      order: [["dueDate", "ASC"]],
    });

    // Calculate stats
    const pending = await Task.count({
      where: { ...whereClause, status: "pending" },
    });

    const completed = await Task.count({
      where: { ...whereClause, status: "completed" },
    });

    const overdue = await Task.count({
      where: {
        ...whereClause,
        dueDate: { [Op.lt]: new Date() },
        status: { [Op.ne]: "completed" },
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
  async getTaskById(taskId: string) {
    const task = await Task.findByPk(taskId, {
      include: [
        {
          model: AppUser,
          as: "creator",
          attributes: ["id", "fullName", "email"],
        },
        {
          model: AppUser,
          as: "assignee",
          attributes: ["id", "fullName", "email"],
        },
      ],
    });

    if (!task) {
      throw new Error("Task not found");
    }

    // If relatedPatientIds exist, fetch patient details
    let patients: Patient[] = [];
    if (task.relatedPatientIds && task.relatedPatientIds.length > 0) {
      patients = await Patient.findAll({
        where: {
          id: { [Op.in]: task.relatedPatientIds },
        },
        attributes: ["id", "fullName", "phone", "stickerId", "status"],
      });
    }

    return { task, patients };
  }

  /**
   * Create new task (Doctor assigns to Assistant)
   */
  async createTask(data: {
    createdBy: string;
    assignedTo: string;
    title: string;
    description?: string;
    taskType: string;
    priority: string;
    dueDate: Date;
    relatedPatientIds?: string[];
  }) {
    // Verify assignedTo is an assistant under this doctor
    const assistant = await AppUser.findOne({
      where: {
        id: data.assignedTo,
        role: "ASSISTANT",
        parentId: data.createdBy,
      },
    });

    if (!assistant) {
      throw new Error(
        "Assistant not found or not assigned to this doctor"
      );
    }

    const task = await Task.create({
      createdBy: data.createdBy,
      assignedTo: data.assignedTo,
      title: data.title,
      description: data.description,
      taskType: data.taskType as any,
      priority: data.priority as any,
      dueDate: data.dueDate,
      relatedPatientIds: data.relatedPatientIds,
      status: "pending",
      notificationSent: false,
    });

    // Create notification for assistant
    const notification = await Notification.create({
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
      fcmService
        .sendPushNotification(
          assistant.fcmToken,
          "New Task Assigned",
          `You have been assigned a new task: ${data.title}`,
          {
            notificationId: notification.id,
            type: "task-assigned",
            severity: data.priority === "urgent" ? "high" : "medium",
            taskId: task.id,
          }
        )
        .catch((err) => console.error("FCM push error (task assigned):", err));
    }

    task.notificationSent = true;
    await task.save();

    return task;
  }

  /**
   * Update task
   */
  async updateTask(
    taskId: string,
    userId: string,
    userRole: string,
    updates: {
      title?: string;
      description?: string;
      priority?: string;
      dueDate?: Date;
      status?: string;
      completionNotes?: string;
    }
  ) {
    const task = await Task.findByPk(taskId);

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
      if (updates.title) task.title = updates.title;
      if (updates.description) task.description = updates.description;
      if (updates.priority) task.priority = updates.priority as any;
      if (updates.dueDate) task.dueDate = updates.dueDate;
    }

    // ASSISTANT can update status and completion notes
    if (userRole === "ASSISTANT") {
      if (updates.status) {
        task.status = updates.status as any;
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
  async completeTask(taskId: string, assistantId: string, completionNotes?: string) {
    const task = await Task.findByPk(taskId);

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
    const notification = await Notification.create({
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
    const doctor = await AppUser.findByPk(task.createdBy);
    if (doctor?.fcmToken) {
      fcmService
        .sendPushNotification(
          doctor.fcmToken,
          "Task Completed",
          `Task "${task.title}" has been completed by your assistant.`,
          {
            notificationId: notification.id,
            type: "task-completed",
            severity: "low",
            taskId: task.id,
          }
        )
        .catch((err) => console.error("FCM push error (task completed):", err));
    }

    return task;
  }

  /**
   * Delete task (Doctor only)
   */
  async deleteTask(taskId: string, doctorId: string) {
    const task = await Task.findByPk(taskId);

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
