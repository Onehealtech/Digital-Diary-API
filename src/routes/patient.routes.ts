import { Router } from "express";
import {
    createPatient,
    getDoctorPatients,
    getPatientById,
    updatePatient,
    prescribeTests,
    updateTestStatus,
    logCallAttempt,
    getTestProgress,
    getPatientsNeedingFollowUp,
} from "../controllers/patient.controller";
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
import { authCheck as newAuthCheck } from "../middleware/authMiddleware";

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

// Enhanced Patient APIs (Doctor/Assistant access)
// Get patients needing follow-up (must be before /:id to avoid route conflict)
router.get(
    "/follow-up",
    newAuthCheck(["DOCTOR"]),
    getPatientsNeedingFollowUp
);

// Get patient by ID with full details
router.get(
    "/:id",
    newAuthCheck(["DOCTOR", "ASSISTANT", "VENDOR"]),
    getPatientById
);

// Update patient details
router.put(
    "/:id",
    newAuthCheck(["DOCTOR", "ASSISTANT"]),
    updatePatient
);

// Prescribe tests to patient
router.post(
    "/:id/tests",
    newAuthCheck(["DOCTOR"]),
    prescribeTests
);

// Update test status
router.put(
    "/:id/tests/:testName",
    newAuthCheck(["DOCTOR"]),
    updateTestStatus
);

// Log call attempt
router.post(
    "/:id/call",
    newAuthCheck(["DOCTOR", "ASSISTANT"]),
    logCallAttempt
);

// Get test progress
router.get(
    "/:id/test-progress",
    newAuthCheck(["DOCTOR", "ASSISTANT"]),
    getTestProgress
);

export default router;
