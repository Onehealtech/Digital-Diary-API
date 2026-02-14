import express from "express";
import * as clinicController from "../controllers/clinic.controller";
import { createReminder } from "../controllers/reminder.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = express.Router();

// Doctor and Assistant can register patients
router.post(
    "/register-patient",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    clinicController.registerPatient
);

// Doctor and Assistant can create reminders
router.post(
    "/create-reminder",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    createReminder
);

export default router;
