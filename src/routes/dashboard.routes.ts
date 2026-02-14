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

export default router;
