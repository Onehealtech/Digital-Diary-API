"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllPatientNotificationsAsRead = exports.markPatientNotificationAsRead = exports.getPatientNotificationStats = exports.getPatientNotifications = exports.updateFcmToken = exports.putPatientOnHold = exports.activatePatient = exports.deactivatePatient = exports.getPatientsNeedingFollowUp = exports.getTestProgress = exports.logCallAttempt = exports.updateTestStatus = exports.prescribeTests = exports.updatePatient = exports.getPatientById = exports.getDoctorPatients = exports.createPatient = void 0;
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const patient_service_1 = require("../service/patient.service");
const notification_service_1 = require("../service/notification.service");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const activityLogger_1 = require("../utils/activityLogger");
const createPatient = async (req, res) => {
    try {
        let vendorId = req.user.id; // from auth middleware
        const role = req.user.role;
        const { fullName, age, gender, phone, diaryId, doctorId } = req.body;
        if (role !== constants_1.UserRole.VENDOR) {
            return res.status(403).json({ message: "Only vendors can create patients" });
        }
        const patient = await Patient_1.Patient.create({
            fullName,
            age,
            gender,
            phone,
            doctorId,
            diaryId,
            vendorId,
            caseType: "PERI OPERATIVE",
        });
        (0, activityLogger_1.logActivity)({
            req,
            userId: vendorId,
            userRole: role,
            action: "PATIENT_CREATED",
            details: { patientId: patient.id, fullName, diaryId, doctorId },
        });
        return res.status(201).json({
            message: "Patient created successfully",
            data: patient,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.createPatient = createPatient;
const getDoctorPatients = async (req, res) => {
    try {
        let doctorId = req.user.id;
        const role = req.user.role;
        if (role !== constants_1.UserRole.DOCTOR && role !== constants_1.UserRole.ASSISTANT) {
            return res.status(403).json({ message: "Only doctors and assistants can view patients" });
        }
        const userData = await Appuser_1.AppUser.findByPk(req.user.id);
        if (userData?.role == constants_1.UserRole.ASSISTANT) {
            doctorId = userData.parentId;
        }
        const doctor = await Appuser_1.AppUser.findByPk(doctorId, {
            attributes: ["id", "fullName", "email"],
            include: [
                {
                    model: Patient_1.Patient,
                    attributes: ["id", "fullName", "age", "gender", "diaryId"],
                },
            ],
        });
        return res.json(doctor);
    }
    catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};
exports.getDoctorPatients = getDoctorPatients;
/**
 * GET /api/v1/patients/:id
 * Get patient by ID with full details (test status, diary info, scan logs)
 */
const getPatientById = async (req, res) => {
    try {
        const id = req.params.id;
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !role) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const patient = await patient_service_1.patientService.getPatientById(id, requesterId, role);
        (0, activityLogger_1.logActivity)({
            req,
            userId: requesterId,
            userRole: role,
            action: "PATIENT_VIEWED",
            details: { patientId: id },
        });
        return (0, response_1.sendResponse)(res, patient, "Patient details fetched successfully");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};
exports.getPatientById = getPatientById;
/**
 * PUT /api/v1/patients/:id
 * Update patient details
 */
const updatePatient = async (req, res) => {
    try {
        const id = req.params.id;
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !role) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const updates = req.body;
        const patient = await patient_service_1.patientService.updatePatient(id, requesterId, role, updates);
        (0, activityLogger_1.logActivity)({
            req,
            userId: requesterId,
            userRole: role,
            action: "PATIENT_UPDATED",
            details: { patientId: id, updatedFields: Object.keys(updates) },
        });
        return (0, response_1.sendResponse)(res, patient, "Patient updated successfully");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 403);
    }
};
exports.updatePatient = updatePatient;
/**
 * POST /api/v1/patients/:id/tests
 * Prescribe tests to a patient
 */
const prescribeTests = async (req, res) => {
    try {
        const id = req.params.id;
        const doctorId = req.user?.id;
        const role = req.user?.role;
        if (!doctorId || role !== "DOCTOR") {
            return (0, response_1.sendError)(res, "Only doctors can prescribe tests", 403);
        }
        const { tests } = req.body;
        if (!tests || !Array.isArray(tests) || tests.length === 0) {
            return (0, response_1.sendError)(res, "Tests array is required", 400);
        }
        const patient = await patient_service_1.patientService.prescribeTests(id, doctorId, tests);
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: "DOCTOR",
            action: "TESTS_PRESCRIBED",
            details: { patientId: id, tests },
        });
        return (0, response_1.sendResponse)(res, patient, "Tests prescribed successfully", 201);
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message);
    }
};
exports.prescribeTests = prescribeTests;
/**
 * PUT /api/v1/patients/:id/tests/:testName
 * Update test status (completed, report received)
 */
const updateTestStatus = async (req, res) => {
    try {
        const id = req.params.id;
        const testName = req.params.testName;
        const doctorId = req.user?.id;
        const role = req.user?.role;
        if (!doctorId || role !== "DOCTOR") {
            return (0, response_1.sendError)(res, "Only doctors can update test status", 403);
        }
        const { completed, completedDate, reportReceived, reportReceivedDate } = req.body;
        const patient = await patient_service_1.patientService.updateTestStatus(id, doctorId, {
            testName,
            completed,
            completedDate,
            reportReceived,
            reportReceivedDate,
        });
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: "DOCTOR",
            action: "TEST_STATUS_UPDATED",
            details: { patientId: id, testName, completed, reportReceived },
        });
        return (0, response_1.sendResponse)(res, patient, "Test status updated successfully");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message);
    }
};
exports.updateTestStatus = updateTestStatus;
/**
 * POST /api/v1/patients/:id/call
 * Log a call attempt to a patient
 */
const logCallAttempt = async (req, res) => {
    try {
        const id = req.params.id;
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
            return (0, response_1.sendError)(res, "Only doctors and assistants can log call attempts", 403);
        }
        const { callDate, outcome, notes, followUpRequired, followUpDate } = req.body;
        if (!outcome) {
            return (0, response_1.sendError)(res, "Call outcome is required", 400);
        }
        const callLog = await patient_service_1.patientService.logCallAttempt(id, requesterId, role, {
            callDate,
            outcome,
            notes,
            followUpRequired,
            followUpDate,
        });
        (0, activityLogger_1.logActivity)({
            req,
            userId: requesterId,
            userRole: role,
            action: "CALL_LOGGED",
            details: { patientId: id, outcome, followUpRequired },
        });
        return (0, response_1.sendResponse)(res, callLog, "Call logged successfully", 201);
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message);
    }
};
exports.logCallAttempt = logCallAttempt;
/**
 * GET /api/v1/patients/:id/test-progress
 * Get test progress for a patient
 */
const getTestProgress = async (req, res) => {
    try {
        const id = req.params.id;
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !role) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const progress = await patient_service_1.patientService.getTestProgress(id, requesterId, role);
        return (0, response_1.sendResponse)(res, progress, "Test progress fetched successfully");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};
exports.getTestProgress = getTestProgress;
/**
 * GET /api/v1/patients/follow-up
 * Get patients needing follow-up
 */
const getPatientsNeedingFollowUp = async (req, res) => {
    try {
        const doctorId = req.user?.id;
        const role = req.user?.role;
        if (!doctorId || role !== "DOCTOR") {
            return (0, response_1.sendError)(res, "Only doctors can view follow-up list", 403);
        }
        const patients = await patient_service_1.patientService.getPatientsNeedingFollowUp(doctorId);
        return (0, response_1.sendResponse)(res, patients, "Follow-up list fetched successfully");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message);
    }
};
exports.getPatientsNeedingFollowUp = getPatientsNeedingFollowUp;
/**
 * PUT /api/v1/patients/:id/deactivate
 * Deactivate a patient (set status to INACTIVE)
 */
const deactivatePatient = async (req, res) => {
    try {
        const id = req.params.id;
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !role) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const { reason } = req.body;
        if (!reason || typeof reason !== "string" || !reason.trim()) {
            return (0, response_1.sendError)(res, "Deactivation reason is required", 400);
        }
        const patient = await patient_service_1.patientService.deactivatePatient(id, requesterId, role, reason.trim());
        (0, activityLogger_1.logActivity)({
            req,
            userId: requesterId,
            userRole: role,
            action: "PATIENT_DEACTIVATED",
            details: { patientId: id, reason: reason.trim() },
        });
        return (0, response_1.sendResponse)(res, patient, "Patient deactivated successfully");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return (0, response_1.sendError)(res, message, message.includes("not found") ? 404 : 400);
    }
};
exports.deactivatePatient = deactivatePatient;
/**
 * PUT /api/v1/patients/:id/activate
 * Reactivate an inactive patient
 */
const activatePatient = async (req, res) => {
    try {
        const id = req.params.id;
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !role) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const patient = await patient_service_1.patientService.activatePatient(id, requesterId, role);
        (0, activityLogger_1.logActivity)({
            req,
            userId: requesterId,
            userRole: role,
            action: "PATIENT_ACTIVATED",
            details: { patientId: id },
        });
        return (0, response_1.sendResponse)(res, patient, "Patient activated successfully");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return (0, response_1.sendError)(res, message, message.includes("not found") ? 404 : 400);
    }
};
exports.activatePatient = activatePatient;
/**
 * PUT /api/v1/patients/:id/on-hold
 * Put a patient on hold (no reason required)
 */
const putPatientOnHold = async (req, res) => {
    try {
        const id = req.params.id;
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !role) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const patient = await patient_service_1.patientService.putPatientOnHold(id, requesterId, role);
        (0, activityLogger_1.logActivity)({
            req,
            userId: requesterId,
            userRole: role,
            action: "PATIENT_ON_HOLD",
            details: { patientId: id },
        });
        return (0, response_1.sendResponse)(res, patient, "Patient put on hold successfully");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return (0, response_1.sendError)(res, message, message.includes("not found") ? 404 : 400);
    }
};
exports.putPatientOnHold = putPatientOnHold;
// =========================================================================
// PATIENT FCM & NOTIFICATION ENDPOINTS (accessed by patients via patientAuthCheck)
// =========================================================================
/**
 * PUT /api/v1/patient/fcm-token
 * Save/update patient's FCM token for push notifications
 */
const updateFcmToken = async (req, res) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const { fcmToken } = req.body;
        if (!fcmToken) {
            return (0, response_1.sendError)(res, "fcmToken is required", 400);
        }
        await Patient_1.Patient.update({ fcmToken }, { where: { id: patientId } });
        return (0, response_1.sendResponse)(res, { success: true }, "FCM token updated successfully");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message);
    }
};
exports.updateFcmToken = updateFcmToken;
/**
 * GET /api/v1/patient/notifications
 * Get all notifications for the logged-in patient
 */
const getPatientNotifications = async (req, res) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const { page = 1, limit = 20, type, read, severity } = req.query;
        const result = await notification_service_1.notificationService.getAllNotifications(patientId, "patient", {
            page: Number(page),
            limit: Number(limit),
            type: type,
            read: read === "true" ? true : read === "false" ? false : undefined,
            severity: severity,
        });
        return (0, response_1.sendResponse)(res, result, "Notifications fetched successfully");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message);
    }
};
exports.getPatientNotifications = getPatientNotifications;
/**
 * GET /api/v1/patient/notifications/stats
 * Get notification stats for the logged-in patient
 */
const getPatientNotificationStats = async (req, res) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const stats = await notification_service_1.notificationService.getNotificationStats(patientId, "patient");
        return (0, response_1.sendResponse)(res, stats, "Notification stats fetched successfully");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message);
    }
};
exports.getPatientNotificationStats = getPatientNotificationStats;
/**
 * PUT /api/v1/patient/notifications/:id/read
 * Mark a notification as read
 */
const markPatientNotificationAsRead = async (req, res) => {
    try {
        const patientId = req.user?.id;
        const notificationId = req.params.id;
        if (!patientId) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const notification = await notification_service_1.notificationService.markAsRead(notificationId, patientId);
        return (0, response_1.sendResponse)(res, notification, "Notification marked as read");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};
exports.markPatientNotificationAsRead = markPatientNotificationAsRead;
/**
 * PUT /api/v1/patient/notifications/mark-all-read
 * Mark all notifications as read for the patient
 */
const markAllPatientNotificationsAsRead = async (req, res) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            return (0, response_1.sendError)(res, "Unauthorized", 401);
        }
        const result = await notification_service_1.notificationService.markAllAsRead(patientId, "patient");
        return (0, response_1.sendResponse)(res, result, "All notifications marked as read");
    }
    catch (error) {
        return (0, response_1.sendError)(res, error.message);
    }
};
exports.markAllPatientNotificationsAsRead = markAllPatientNotificationsAsRead;
