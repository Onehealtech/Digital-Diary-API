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
    deactivatePatient,
    activatePatient,
    putPatientOnHold,
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
    updateLanguage,
} from "../controllers/patientProfile.controller";
import {
    getAccessInfo,
    getDiaryCatalog,
} from "../controllers/patientAccess.controller";
import {
    getOnboardingStatus,
    recordOnboardingView,
} from "../controllers/onboarding.controller";
import {
    getPatientReminders,
    markReminderAsRead,
    respondToReminder
} from "../controllers/reminder.controller";
import { authCheck, patientAuthCheck } from "../middleware/authMiddleware";
import { translateResponse } from "../middleware/translateResponse.middleware";
import { authCheck as newAuthCheck } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";
import { validate } from "../middleware/validate.middleware";
import { UserRole } from "../utils/constants";
import { createPatientSchema } from "../schemas/staff.schemas";

const router = Router();

// Legacy routes (Accessed by Doctors)
router.post("/", authCheck([UserRole.VENDOR]), validate({ body: createPatientSchema }), createPatient);
router.get("/getAllPatients", authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]), requirePermission('viewPatients'), getDoctorPatients);

// Patient access level & diary catalog (Accessed by Patients)
router.get("/access-info", patientAuthCheck, translateResponse(), getAccessInfo);
router.get("/diary-catalog", patientAuthCheck, translateResponse(), getDiaryCatalog);

// Patient language preference (Accessed by Patients)
router.patch("/language", patientAuthCheck, updateLanguage);

// Patient profile management (Accessed by Patients)
router.post("/request-edit-otp", patientAuthCheck, translateResponse(), requestEditOTP);
router.post("/update-profile", patientAuthCheck, translateResponse(), updateProfile);
router.get("/profile", patientAuthCheck, translateResponse(), getProfile);

// Onboarding instructions (Accessed by Patients)
router.get("/onboarding-status", patientAuthCheck, translateResponse(), getOnboardingStatus);
router.post("/onboarding-viewed", patientAuthCheck, translateResponse(), recordOnboardingView);

// Patient reminders (Accessed by Patients)
router.get("/reminders", patientAuthCheck, translateResponse(), getPatientReminders);
router.patch("/reminders/:id/read", patientAuthCheck, translateResponse(), markReminderAsRead);
router.patch("/reminders/:id/respond", patientAuthCheck, translateResponse(), respondToReminder);

// Patient FCM token (Accessed by Patients)
router.put("/fcm-token", patientAuthCheck, updateFcmToken);

// Patient notifications (Accessed by Patients)
router.get("/notifications/stats", patientAuthCheck, translateResponse(), getPatientNotificationStats);
router.get("/notifications", patientAuthCheck, translateResponse(), getPatientNotifications);
router.put("/notifications/mark-all-read", patientAuthCheck, translateResponse(), markAllPatientNotificationsAsRead);
router.put("/notifications/:id/read", patientAuthCheck, translateResponse(), markPatientNotificationAsRead);

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
    requirePermission('viewPatients'),
    getPatientById
);

// Update patient details
router.put(
    "/:id",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    updatePatient
);

// Deactivate patient
router.put(
    "/:id/deactivate",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    requirePermission('deactivatePatients'),
    deactivatePatient
);

// Activate patient
router.put(
    "/:id/activate",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    requirePermission('deactivatePatients'),
    activatePatient
);

// Put patient on hold
router.put(
    "/:id/on-hold",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    requirePermission('deactivatePatients'),
    putPatientOnHold
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
    requirePermission('callPatients'),
    logCallAttempt
);

// Get test progress
router.get(
    "/:id/test-progress",
    newAuthCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    getTestProgress
);

export default router;
