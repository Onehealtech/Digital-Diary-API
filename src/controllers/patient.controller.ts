import { Request, Response } from "express";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest, CustomRequest } from "../middleware/authMiddleware";
import { AppUser } from "../models/Appuser";
import { patientService } from "../service/patient.service";
import { notificationService } from "../service/notification.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

export const createPatient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let doctorId = req.user.id; // from auth middleware
    const role = req.user.role;

    if (role !== UserRole.DOCTOR && role !== UserRole.ASSISTANT) {
      return res.status(403).json({ message: "Only doctors and assistants can create patients" });
    }
    const userData = await AppUser.findByPk(req.user.id);
    if (userData?.role == UserRole.ASSISTANT) {
      doctorId = userData.parentId;
    }
    const { fullName, age, gender, phone, diaryId } = req.body;

    const patient = await Patient.create({
      fullName,
      age,
      gender,
      phone,
      doctorId,
      diaryId,
    });

    return res.status(201).json({
      message: "Patient created successfully",
      data: patient,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getDoctorPatients = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let doctorId = req.user.id;
    const role = req.user.role;

    if (role !== UserRole.DOCTOR && role !== UserRole.ASSISTANT) {
      return res.status(403).json({ message: "Only doctors and assistants can view patients" });
    }
    const userData = await AppUser.findByPk(req.user.id);
    if (userData?.role == UserRole.ASSISTANT) {
      doctorId = userData.parentId;
    }

    const doctor = await AppUser.findByPk(doctorId, {
      attributes: ["id", "fullName", "email"],
      include: [
        {
          model: Patient,
          attributes: ["id", "fullName", "age", "gender", "diaryId"],
        },
      ],
    });

    return res.json(doctor);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/v1/patients/:id
 * Get patient by ID with full details (test status, diary info, scan logs)
 */
export const getPatientById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const requesterId = req.user?.id;
    const role = req.user?.role;

    if (!requesterId || !role) {
      return sendError(res, "Unauthorized", 401);
    }

    const patient = await patientService.getPatientById(id, requesterId, role);

    return sendResponse(res, patient, "Patient details fetched successfully");
  } catch (error: any) {
    return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
  }
};

/**
 * PUT /api/v1/patients/:id
 * Update patient details
 */
export const updatePatient = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const requesterId = req.user?.id;
    const role = req.user?.role;

    if (!requesterId || !role) {
      return sendError(res, "Unauthorized", 401);
    }

    const updates = req.body;

    const patient = await patientService.updatePatient(id, requesterId, role, updates);

    return sendResponse(res, patient, "Patient updated successfully");
  } catch (error: any) {
    return sendError(res, error.message, error.message.includes("not found") ? 404 : 403);
  }
};

/**
 * POST /api/v1/patients/:id/tests
 * Prescribe tests to a patient
 */
export const prescribeTests = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const doctorId = req.user?.id;
    const role = req.user?.role;

    if (!doctorId || role !== "DOCTOR") {
      return sendError(res, "Only doctors can prescribe tests", 403);
    }

    const { tests } = req.body;

    if (!tests || !Array.isArray(tests) || tests.length === 0) {
      return sendError(res, "Tests array is required", 400);
    }

    const patient = await patientService.prescribeTests(id, doctorId, tests);

    return sendResponse(res, patient, "Tests prescribed successfully", 201);
  } catch (error: any) {
    return sendError(res, error.message);
  }
};

/**
 * PUT /api/v1/patients/:id/tests/:testName
 * Update test status (completed, report received)
 */
export const updateTestStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const testName = req.params.testName as string;
    const doctorId = req.user?.id as string;
    const role = req.user?.role;

    if (!doctorId || role !== "DOCTOR") {
      return sendError(res, "Only doctors can update test status", 403);
    }

    const { completed, completedDate, reportReceived, reportReceivedDate } = req.body;

    const patient = await patientService.updateTestStatus(id, doctorId, {
      testName,
      completed,
      completedDate,
      reportReceived,
      reportReceivedDate,
    });

    return sendResponse(res, patient, "Test status updated successfully");
  } catch (error: any) {
    return sendError(res, error.message);
  }
};

/**
 * POST /api/v1/patients/:id/call
 * Log a call attempt to a patient
 */
export const logCallAttempt = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const requesterId = req.user?.id;
    const role = req.user?.role;

    if (!requesterId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
      return sendError(res, "Only doctors and assistants can log call attempts", 403);
    }

    const { callDate, outcome, notes, followUpRequired, followUpDate } = req.body;

    if (!outcome) {
      return sendError(res, "Call outcome is required", 400);
    }

    const callLog = await patientService.logCallAttempt(id, requesterId, role, {
      callDate,
      outcome,
      notes,
      followUpRequired,
      followUpDate,
    });

    return sendResponse(res, callLog, "Call logged successfully", 201);
  } catch (error: any) {
    return sendError(res, error.message);
  }
};

/**
 * GET /api/v1/patients/:id/test-progress
 * Get test progress for a patient
 */
export const getTestProgress = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const requesterId = req.user?.id;
    const role = req.user?.role;

    if (!requesterId || !role) {
      return sendError(res, "Unauthorized", 401);
    }

    const progress = await patientService.getTestProgress(id, requesterId, role);

    return sendResponse(res, progress, "Test progress fetched successfully");
  } catch (error: any) {
    return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
  }
};

/**
 * GET /api/v1/patients/follow-up
 * Get patients needing follow-up
 */
export const getPatientsNeedingFollowUp = async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.user?.id;
    const role = req.user?.role;

    if (!doctorId || role !== "DOCTOR") {
      return sendError(res, "Only doctors can view follow-up list", 403);
    }

    const patients = await patientService.getPatientsNeedingFollowUp(doctorId);

    return sendResponse(res, patients, "Follow-up list fetched successfully");
  } catch (error: any) {
    return sendError(res, error.message);
  }
};

// =========================================================================
// PATIENT FCM & NOTIFICATION ENDPOINTS (accessed by patients via patientAuthCheck)
// =========================================================================

/**
 * PUT /api/v1/patient/fcm-token
 * Save/update patient's FCM token for push notifications
 */
export const updateFcmToken = async (req: CustomRequest, res: Response) => {
  try {
    const patientId = req.user?.id;

    if (!patientId) {
      return sendError(res, "Unauthorized", 401);
    }

    const { fcmToken } = req.body;

    if (!fcmToken) {
      return sendError(res, "fcmToken is required", 400);
    }

    await Patient.update({ fcmToken }, { where: { id: patientId } });

    return sendResponse(res, { success: true }, "FCM token updated successfully");
  } catch (error: any) {
    return sendError(res, error.message);
  }
};

/**
 * GET /api/v1/patient/notifications
 * Get all notifications for the logged-in patient
 */
export const getPatientNotifications = async (req: CustomRequest, res: Response) => {
  try {
    const patientId = req.user?.id;

    if (!patientId) {
      return sendError(res, "Unauthorized", 401);
    }

    const { page = 1, limit = 20, type, read, severity } = req.query;

    const result = await notificationService.getAllNotifications(
      patientId,
      "patient",
      {
        page: Number(page),
        limit: Number(limit),
        type: type as string,
        read: read === "true" ? true : read === "false" ? false : undefined,
        severity: severity as string,
      }
    );

    return sendResponse(res, result, "Notifications fetched successfully");
  } catch (error: any) {
    return sendError(res, error.message);
  }
};

/**
 * GET /api/v1/patient/notifications/stats
 * Get notification stats for the logged-in patient
 */
export const getPatientNotificationStats = async (req: CustomRequest, res: Response) => {
  try {
    const patientId = req.user?.id;

    if (!patientId) {
      return sendError(res, "Unauthorized", 401);
    }

    const stats = await notificationService.getNotificationStats(patientId, "patient");

    return sendResponse(res, stats, "Notification stats fetched successfully");
  } catch (error: any) {
    return sendError(res, error.message);
  }
};

/**
 * PUT /api/v1/patient/notifications/:id/read
 * Mark a notification as read
 */
export const markPatientNotificationAsRead = async (req: CustomRequest, res: Response) => {
  try {
    const patientId = req.user?.id;
    const notificationId = req.params.id as string;

    if (!patientId) {
      return sendError(res, "Unauthorized", 401);
    }

    const notification = await notificationService.markAsRead(notificationId, patientId);

    return sendResponse(res, notification, "Notification marked as read");
  } catch (error: any) {
    return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
  }
};

/**
 * PUT /api/v1/patient/notifications/mark-all-read
 * Mark all notifications as read for the patient
 */
export const markAllPatientNotificationsAsRead = async (req: CustomRequest, res: Response) => {
  try {
    const patientId = req.user?.id;

    if (!patientId) {
      return sendError(res, "Unauthorized", 401);
    }

    const result = await notificationService.markAllAsRead(patientId, "patient");

    return sendResponse(res, result, "All notifications marked as read");
  } catch (error: any) {
    return sendError(res, error.message);
  }
};
