import { Request, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../utils/constants";
import { responseMiddleware } from "../utils/response";
import { logActivity } from "../utils/activityLogger";
import * as requestService from "../service/doctorAssignmentRequest.service";

// ── Zod Schemas ──────────────────────────────────────────────────────────

const createRequestSchema = z.object({
  doctorId: z.string().uuid("Invalid doctor ID"),
});

const rejectRequestSchema = z.object({
  rejectionReason: z.string().max(500).optional(),
});

// ── Patient-facing endpoints (called from mobile app) ────────────────────

/**
 * POST /api/v1/doctor-requests
 * Patient sends a request to a doctor (max 2 per doctor)
 */
export const createRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
  const patientId = req.user ? (req.user as { id: string }).id : null;
    const { doctorId } = req.body;

    const request = await requestService.createRequest(patientId, doctorId);

    responseMiddleware(res, HTTP_STATUS.CREATED, "Request sent to doctor successfully", request);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to create request";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

/**
 * GET /api/v1/doctor-requests/my-requests
 * Patient views their own requests
 */
export const getMyRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = req.user ? (req.user as { id: string }).id : null;
    const requests = await requestService.getRequestsForPatient(patientId);
    responseMiddleware(res, HTTP_STATUS.OK, "Requests fetched", requests);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch requests");
  }
};

// ── Doctor-facing endpoints (called from web dashboard) ──────────────────

/**
 * GET /api/v1/doctor-requests
 * Doctor views assignment requests (optionally filtered by status)
 */
export const getRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const status = req.query.status as string | undefined;
    const requests = await requestService.getRequestsForDoctor(doctorId, status);
    responseMiddleware(res, HTTP_STATUS.OK, "Requests fetched", requests);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch requests");
  }
};

/**
 * PUT /api/v1/doctor-requests/:id/accept
 * Doctor accepts a patient request
 */
export const acceptRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const requestId = req.params.id as string;

    const result = await requestService.acceptRequest(requestId, doctorId);

    logActivity({
      req,
      userId: doctorId,
      userRole: "DOCTOR",
      action: "PATIENT_REQUEST_ACCEPTED",
      details: { requestId, patientId: result.patientId },
    });

    responseMiddleware(res, HTTP_STATUS.OK, "Patient request accepted", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to accept request");
  }
};

/**
 * PUT /api/v1/doctor-requests/:id/reject
 * Doctor rejects a patient request
 */
export const rejectRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const requestId = req.params.id as string;

    const parsed = rejectRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await requestService.rejectRequest(
      requestId,
      doctorId,
      parsed.data.rejectionReason
    );

    logActivity({
      req,
      userId: doctorId,
      userRole: "DOCTOR",
      action: "PATIENT_REQUEST_REJECTED",
      details: { requestId, patientId: result.patientId, reason: parsed.data.rejectionReason },
    });

    responseMiddleware(res, HTTP_STATUS.OK, "Patient request rejected", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reject request");
  }
};
