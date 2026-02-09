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

export default router;
