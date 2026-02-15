import { Router } from "express";
import { staffController } from "../controllers/staff.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();

/**
 * Assistant Management Routes
 * Super Admin can manage all assistants
 * Doctor can manage their own assistants
 */

// Get all assistants (Super Admin sees all, Doctor sees their own)
router.get(
  "/",
  authCheck(["SUPER_ADMIN", "DOCTOR"]),
  staffController.getAllAssistants
);

// Get assistant by ID
router.get(
  "/:id",
  authCheck(["SUPER_ADMIN", "DOCTOR"]),
  staffController.getAssistantById
);

// Update assistant
router.put(
  "/:id",
  authCheck(["SUPER_ADMIN", "DOCTOR"]),
  staffController.updateAssistant
);

// Delete assistant
router.delete(
  "/:id",
  authCheck(["SUPER_ADMIN", "DOCTOR"]),
  staffController.deleteAssistant
);

export default router;
