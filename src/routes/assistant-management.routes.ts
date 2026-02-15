import { Router } from "express";
import { staffController } from "../controllers/staff.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

/**
 * Assistant Management Routes
 * Super Admin can manage all assistants
 * Doctor can manage their own assistants
 */

// Get all assistants (Super Admin sees all, Doctor sees their own)
router.get(
  "/",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR]),
  staffController.getAllAssistants
);

// Get assistant by ID
router.get(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR]),
  staffController.getAssistantById
);

// Update assistant
router.put(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR]),
  staffController.updateAssistant
);

// Delete assistant
router.delete(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR]),
  staffController.deleteAssistant
);

export default router;
