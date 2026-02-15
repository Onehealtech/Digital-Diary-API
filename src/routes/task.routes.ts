import { Router } from "express";
import { taskController } from "../controllers/task.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();

/**
 * Task Management Routes
 * Doctor creates tasks and assigns to Assistants
 * Assistants execute tasks and mark them complete
 */

// Get all tasks (role-based: Doctor sees created, Assistant sees assigned)
router.get(
  "/",
  authCheck(["DOCTOR", "ASSISTANT"]),
  taskController.getAllTasks
);

// Get task by ID
router.get(
  "/:id",
  authCheck(["DOCTOR", "ASSISTANT"]),
  taskController.getTaskById
);

// Create new task (Doctor only)
router.post(
  "/",
  authCheck(["DOCTOR"]),
  taskController.createTask
);

// Update task
router.put(
  "/:id",
  authCheck(["DOCTOR", "ASSISTANT"]),
  taskController.updateTask
);

// Mark task as complete (Assistant only)
router.put(
  "/:id/complete",
  authCheck(["ASSISTANT"]),
  taskController.completeTask
);

// Delete task (Doctor only)
router.delete(
  "/:id",
  authCheck(["DOCTOR"]),
  taskController.deleteTask
);

export default router;
