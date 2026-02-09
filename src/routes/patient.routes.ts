import { Router } from "express";
import { createPatient, getDoctorPatients } from "../controllers/patient.controller";
import {
    requestEditOTP,
    updateProfile,
    getProfile,
} from "../controllers/patientProfile.controller";
import {
    getPatientReminders,
    markReminderAsRead,
} from "../controllers/reminder.controller";
import { authCheck, patientAuthCheck } from "../middleware/authMiddleware";

const router = Router();

// Legacy routes (Accessed by Doctors)
router.post("/", authCheck(["doctor"]), createPatient);
router.get("/getAllPatients", authCheck(["doctor"]), getDoctorPatients);

// Patient profile management (Accessed by Patients)
router.post("/request-edit-otp", patientAuthCheck, requestEditOTP);
router.post("/update-profile", patientAuthCheck, updateProfile);
router.get("/profile", patientAuthCheck, getProfile);

// Patient reminders (Accessed by Patients)
router.get("/reminders", patientAuthCheck, getPatientReminders);
router.patch("/reminders/:id/read", patientAuthCheck, markReminderAsRead);

export default router;
