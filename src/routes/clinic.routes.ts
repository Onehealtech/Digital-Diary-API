import express from "express";
import * as clinicController from "../controllers/clinic.controller";
import { createReminder } from "../controllers/reminder.controller";
import { authCheck } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate.middleware";
import { UserRole } from "../utils/constants";
import { registerPatientSchema } from "../schemas/staff.schemas";

const router = express.Router();

// Doctor and Assistant can register patients
router.post(
    "/register-patient",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    validate({ body: registerPatientSchema }),
    clinicController.registerPatient
);

// Doctor and Assistant can create reminders
router.post(
    "/create-reminder",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    createReminder
);

export default router;
