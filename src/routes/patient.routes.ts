import { Router } from "express";
import {
    createPatient,
    getDoctorPatients,
    getPatientById,
    updatePatient,
    updateTestStatus,
    logCallAttempt,
    getTestProgress,
    getPatientsNeedingFollowUp,
    updateFcmToken,
    getPatientNotifications,
    getPatientNotificationStats,
    markPatientNotificationAsRead,
    markAllPatientNotificationsAsRead,
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
import { UserRole } from "../utils/constants";

const router = Router();

// Legacy routes (Accessed by Doctors)
router.post("/", authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]), createPatient);
router.get("/getAllPatients", authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]), getDoctorPatients);

// Patient profile management (Accessed by Patients)
router.post("/request-edit-otp", patientAuthCheck, requestEditOTP);
router.post("/update-profile", patientAuthCheck, updateProfile);
router.get("/profile", patientAuthCheck, getProfile);

// Patient reminders (Accessed by Patients)
router.get("/reminders", patientAuthCheck, getPatientReminders);
router.patch("/reminders/:id/read", patientAuthCheck, markReminderAsRead);

// Patient FCM token (Accessed by Patients)
router.put("/fcm-token", patientAuthCheck, updateFcmToken);

// Patient notifications (Accessed by Patients)
router.get("/notifications/stats", patientAuthCheck, getPatientNotificationStats);
router.get("/notifications", patientAuthCheck, getPatientNotifications);
router.put("/notifications/mark-all-read", patientAuthCheck, markAllPatientNotificationsAsRead);
router.put("/notifications/:id/read", patientAuthCheck, markPatientNotificationAsRead);

// Enhanced Patient APIs (Doctor/Assistant access)
// Get patients needing follow-up (must be before /:id to avoid route conflict)
router.get(
    "/follow-up",
    newAuthCheck([UserRole.DOCTOR]),
    getPatientsNeedingFollowUp
);

// Get patient by ID with full details
router.get(
    "/:id",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
    getPatientById
);

// Update patient details
router.put(
    "/:id",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    updatePatient
);



// Update test status
router.put(
    "/:id/tests/:testName",
    newAuthCheck([UserRole.DOCTOR]),
    updateTestStatus
);

// Log call attempt
router.post(
    "/:id/call",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    logCallAttempt
);

// Get test progress
router.get(
    "/:id/test-progress",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    getTestProgress
);

export default router;
