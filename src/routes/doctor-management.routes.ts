import { Router } from "express";
import { staffController } from "../controllers/staff.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

/**
 * Doctor Management Routes
 * Super Admin can manage all doctors
 */

// Get all doctors
router.get(
  "/",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.getAllDoctors
);

// Get doctor by ID
router.get(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.getDoctorById
);

// Update doctor
router.put(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.updateDoctor
);

// Delete doctor
router.delete(
  "/:id",
  authCheck([UserRole.SUPER_ADMIN]),
  staffController.deleteDoctor
);

export default router;
