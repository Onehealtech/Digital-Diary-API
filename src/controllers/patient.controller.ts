import { Request, Response } from "express";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppUser } from "../models/Appuser";
import { patientService } from "../service/patient.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";

export const createPatient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorId = req.user?.id as string; // from auth middleware
    const role = req.user.role;

    if (role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can create patients" });
    }

    const { fullName, age, gender, phone } = req.body;

    const patient = await Patient.create({
      fullName,
      age,
      gender,
      phone,
      doctorId,
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
    const doctorId = req.user?.id as string;

    const doctor = await AppUser.findByPk(doctorId, {
      attributes: ["id", "fullName", "email"],
      include: [
        {
          model: Patient,
          attributes: ["patientCode", "fullName", "age", "gender"],
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
