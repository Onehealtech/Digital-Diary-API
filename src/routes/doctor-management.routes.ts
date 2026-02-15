import { Router } from "express";
import { staffController } from "../controllers/staff.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();

/**
 * Doctor Management Routes
 * Super Admin can manage all doctors
 */

// Get all doctors
router.get(
  "/",
  authCheck(["SUPER_ADMIN"]),
  staffController.getAllDoctors
);

// Get doctor by ID
router.get(
  "/:id",
  authCheck(["SUPER_ADMIN"]),
  staffController.getDoctorById
);

// Update doctor
router.put(
  "/:id",
  authCheck(["SUPER_ADMIN"]),
  staffController.updateDoctor
);

// Delete doctor
router.delete(
  "/:id",
  authCheck(["SUPER_ADMIN"]),
  staffController.deleteDoctor
);

export default router;
