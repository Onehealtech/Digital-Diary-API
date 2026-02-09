import express from "express";
import * as clinicController from "../controllers/clinic.controller";
import { createReminder } from "../controllers/reminder.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = express.Router();

// Doctor and Assistant can register patients
router.post(
    "/register-patient",
    authCheck(["DOCTOR", "ASSISTANT"]),
    clinicController.registerPatient
);

// Doctor and Assistant can create reminders
router.post(
    "/create-reminder",
    authCheck(["DOCTOR", "ASSISTANT"]),
    createReminder
);

export default router;
