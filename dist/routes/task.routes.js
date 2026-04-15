"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const task_controller_1 = require("../controllers/task.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
/**
 * Task Management Routes
 * Doctor creates tasks and assigns to Assistants
 * Assistants execute tasks and mark them complete
 */
// Get all tasks (role-based: Doctor sees created, Assistant sees assigned)
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), task_controller_1.taskController.getAllTasks);
// Get task by ID
router.get("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), task_controller_1.taskController.getTaskById);
// Create new task (Doctor only)
router.post("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR]), task_controller_1.taskController.createTask);
// Update task
router.put("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), task_controller_1.taskController.updateTask);
// Mark task as complete (Assistant only)
router.put("/:id/complete", (0, authMiddleware_1.authCheck)([constants_1.UserRole.ASSISTANT]), task_controller_1.taskController.completeTask);
// Delete task (Doctor only)
router.delete("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR]), task_controller_1.taskController.deleteTask);
exports.default = router;
