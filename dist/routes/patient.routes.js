"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patient_controller_1 = require("../controllers/patient.controller");
const patientProfile_controller_1 = require("../controllers/patientProfile.controller");
const patientAccess_controller_1 = require("../controllers/patientAccess.controller");
const reminder_controller_1 = require("../controllers/reminder.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const authMiddleware_2 = require("../middleware/authMiddleware");
const permissionMiddleware_1 = require("../middleware/permissionMiddleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const constants_1 = require("../utils/constants");
const staff_schemas_1 = require("../schemas/staff.schemas");
const router = (0, express_1.Router)();
// Legacy routes (Accessed by Doctors)
router.post("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), (0, validate_middleware_1.validate)({ body: staff_schemas_1.createPatientSchema }), patient_controller_1.createPatient);
router.get("/getAllPatients", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('viewPatients'), patient_controller_1.getDoctorPatients);
// Patient access level & diary catalog (Accessed by Patients)
router.get("/access-info", authMiddleware_1.patientAuthCheck, patientAccess_controller_1.getAccessInfo);
router.get("/diary-catalog", authMiddleware_1.patientAuthCheck, patientAccess_controller_1.getDiaryCatalog);
// Patient profile management (Accessed by Patients)
router.post("/request-edit-otp", authMiddleware_1.patientAuthCheck, patientProfile_controller_1.requestEditOTP);
router.post("/update-profile", authMiddleware_1.patientAuthCheck, patientProfile_controller_1.updateProfile);
router.get("/profile", authMiddleware_1.patientAuthCheck, patientProfile_controller_1.getProfile);
// Patient reminders (Accessed by Patients)
router.get("/reminders", authMiddleware_1.patientAuthCheck, reminder_controller_1.getPatientReminders);
router.patch("/reminders/:id/read", authMiddleware_1.patientAuthCheck, reminder_controller_1.markReminderAsRead);
router.patch("/reminders/:id/respond", authMiddleware_1.patientAuthCheck, reminder_controller_1.respondToReminder);
// Patient FCM token (Accessed by Patients)
router.put("/fcm-token", authMiddleware_1.patientAuthCheck, patient_controller_1.updateFcmToken);
// Patient notifications (Accessed by Patients)
router.get("/notifications/stats", authMiddleware_1.patientAuthCheck, patient_controller_1.getPatientNotificationStats);
router.get("/notifications", authMiddleware_1.patientAuthCheck, patient_controller_1.getPatientNotifications);
router.put("/notifications/mark-all-read", authMiddleware_1.patientAuthCheck, patient_controller_1.markAllPatientNotificationsAsRead);
router.put("/notifications/:id/read", authMiddleware_1.patientAuthCheck, patient_controller_1.markPatientNotificationAsRead);
// Enhanced Patient APIs (Doctor/Assistant access)
// Get patients needing follow-up (must be before /:id to avoid route conflict)
router.get("/follow-up", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR]), patient_controller_1.getPatientsNeedingFollowUp);
// Get patient by ID with full details
router.get("/:id", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), (0, permissionMiddleware_1.requirePermission)('viewPatients'), patient_controller_1.getPatientById);
// Update patient details
router.put("/:id", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), patient_controller_1.updatePatient);
// Deactivate patient
router.put("/:id/deactivate", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('deactivatePatients'), patient_controller_1.deactivatePatient);
// Activate patient
router.put("/:id/activate", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('deactivatePatients'), patient_controller_1.activatePatient);
// Put patient on hold
router.put("/:id/on-hold", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('deactivatePatients'), patient_controller_1.putPatientOnHold);
// Update test status
router.put("/:id/tests/:testName", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR]), patient_controller_1.updateTestStatus);
// Log call attempt
router.post("/:id/call", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('callPatients'), patient_controller_1.logCallAttempt);
// Get test progress
router.get("/:id/test-progress", (0, authMiddleware_2.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), patient_controller_1.getTestProgress);
exports.default = router;
