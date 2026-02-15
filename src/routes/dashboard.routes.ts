import express from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { getDashboardReminders } from "../controllers/reminder.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = express.Router();

// Doctor, Assistant, and Pharmacist can view patients
router.get(
    "/patients",
    authCheck(["DOCTOR", "ASSISTANT", "PHARMACIST"]),
    dashboardController.getPatients
);

// Doctor and Assistant can view their created reminders
router.get(
    "/reminders",
    authCheck(["DOCTOR", "ASSISTANT"]),
    getDashboardReminders
);

// Super Admin dashboard statistics
router.get(
    "/super-admin",
    authCheck(["SUPER_ADMIN"]),
    dashboardController.getSuperAdminDashboard
);

// Vendor dashboard statistics
router.get(
    "/vendor",
    authCheck(["VENDOR"]),
    dashboardController.getVendorDashboard
);

// Doctor dashboard statistics
router.get(
    "/doctor",
    authCheck(["DOCTOR"]),
    dashboardController.getDoctorDashboard
);

// Assistant dashboard statistics
router.get(
    "/assistant",
    authCheck(["ASSISTANT"]),
    dashboardController.getAssistantDashboard
);

export default router;
