"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskController = void 0;
const task_service_1 = require("../service/task.service");
const response_1 = require("../utils/response");
const taskService = new task_service_1.TaskService();
class TaskController {
    /**
     * GET /api/v1/tasks
     * Get all tasks (role-based filtering)
     * Doctor: sees tasks they created
     * Assistant: sees tasks assigned to them
     */
    async getAllTasks(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { page = 1, limit = 20, status, priority, taskType } = req.query;
            const tasks = await taskService.getAllTasks({
                userId,
                userRole: role,
                page: Number(page),
                limit: Number(limit),
                status: status,
                priority: priority,
            });
            return (0, response_1.sendResponse)(res, tasks, "Tasks fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/tasks/:id
     * Get task by ID with related patients
     */
    async getTaskById(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const task = await taskService.getTaskById(id);
            return (0, response_1.sendResponse)(res, task, "Task fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * POST /api/v1/tasks
     * Create new task (Doctor only)
     */
    async createTask(req, res) {
        try {
            const doctorId = req.user?.id;
            const role = req.user?.role;
            if (!doctorId || role !== "DOCTOR") {
                return (0, response_1.sendError)(res, "Only doctors can create tasks", 403);
            }
            const { assignedTo, title, description, taskType, priority, dueDate, relatedPatients, } = req.body;
            // Validation
            if (!assignedTo || !title || !taskType) {
                return (0, response_1.sendError)(res, "assignedTo, title, and taskType are required", 400);
            }
            const task = await taskService.createTask({
                createdBy: doctorId,
                assignedTo,
                title,
                description,
                taskType,
                priority: priority || "medium",
                dueDate,
                relatedPatientIds: relatedPatients || [],
            });
            return (0, response_1.sendResponse)(res, task, "Task created successfully", 201);
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * PUT /api/v1/tasks/:id
     * Update task
     * Doctor: can update all fields
     * Assistant: can only update status and notes
     */
    async updateTask(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const updates = req.body;
            const task = await taskService.updateTask(id, userId, role, updates);
            return (0, response_1.sendResponse)(res, task, "Task updated successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 403);
        }
    }
    /**
     * PUT /api/v1/tasks/:id/complete
     * Mark task as complete (Assistant only)
     */
    async completeTask(req, res) {
        try {
            const id = req.params.id;
            const assistantId = req.user?.id;
            const role = req.user?.role;
            if (!assistantId || role !== "ASSISTANT") {
                return (0, response_1.sendError)(res, "Only assistants can complete tasks", 403);
            }
            const { notes } = req.body;
            const task = await taskService.completeTask(id, assistantId, notes);
            return (0, response_1.sendResponse)(res, task, "Task marked as complete");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 403);
        }
    }
    /**
     * DELETE /api/v1/tasks/:id
     * Delete task (Doctor only)
     */
    async deleteTask(req, res) {
        try {
            const id = req.params.id;
            const doctorId = req.user?.id;
            const role = req.user?.role;
            if (!doctorId || role !== "DOCTOR") {
                return (0, response_1.sendError)(res, "Only doctors can delete tasks", 403);
            }
            await taskService.deleteTask(id, doctorId);
            return (0, response_1.sendResponse)(res, null, "Task deleted successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 403);
        }
    }
}
exports.taskController = new TaskController();
