import express from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { getDashboardReminders } from "../controllers/reminder.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = express.Router();

// Doctor, Assistant, and Vendor can view patients
router.get(
    "/patients",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
    dashboardController.getPatients
);

// Doctor and Assistant can view their created reminders
router.get(
    "/reminders",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    getDashboardReminders
);

// Super Admin dashboard statistics
router.get(
    "/super-admin",
    authCheck([UserRole.SUPER_ADMIN]),
    dashboardController.getSuperAdminDashboard
);
router.get(
    "/super-admin",
    authCheck([UserRole.SUPER_ADMIN]),
    dashboardController.getSuperAdminDashboard
);

router.get(
    "/getAllSuperAdmins",
    authCheck([UserRole.SUPER_ADMIN]),
    dashboardController.getAllSuperAdmins
);
// Vendor dashboard statistics
router.get(
    "/vendor",
    authCheck([UserRole.VENDOR]),
    dashboardController.getVendorDashboard
);

// Doctor dashboard statistics
router.get(
    "/doctor",
    authCheck([UserRole.DOCTOR]),
    dashboardController.getDoctorDashboard
);

// Assistant dashboard statistics
router.get(
    "/assistant",
    authCheck([UserRole.ASSISTANT]),
    dashboardController.getAssistantDashboard
);

export default router;
