import { Router } from "express";
import { staffController } from "../controllers/staff.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

/**
 * User Management Routes (Super Admin only)
 * View, edit, archive/restore users with roles: SUPER_ADMIN, DOCTOR, VENDOR
 */

// Get all archived users
router.get(
  "/archived",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.getArchivedUsers
);

// Self-registered doctors awaiting approval — must be before /:id
router.get(
  "/pending-registrations",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.getPendingRegistrations
);

// Get user details by ID
router.get(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR]),
  staffController.getUserById
);

// Update user details
router.put(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.updateUser
);

// Toggle active/inactive status
router.put(
  "/:id/toggle-status",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.toggleUserStatus
);

// Restore an archived user
router.post(
  "/:id/restore",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.restoreUser
);

// Archive (soft-delete) a user
router.delete(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.archiveUser
);

router.post(
  "/:id/approve-registration",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.approveRegistration
);

router.post(
  "/:id/reject-registration",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.rejectRegistration
);

export default router;

