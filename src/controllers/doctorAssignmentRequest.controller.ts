import { Request, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../utils/constants";
import { responseMiddleware } from "../utils/response";
import { logActivity } from "../utils/activityLogger";
import * as requestService from "../service/doctorAssignmentRequest.service";
import { getPatientLanguage, translateArrayFields } from "../utils/translations";

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
 * Patient views their own requests — translates doctor names for Hindi patients
 */
export const getMyRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = req.user ? (req.user as { id: string }).id : null;
    const requests = await requestService.getRequestsForPatient(patientId);

    let data = requests.map((r: any) => (r.toJSON ? r.toJSON() : r));

    // Translate doctor names, specialization, hospital for Hindi patients
    if (patientId) {
      const lang = await getPatientLanguage(patientId);
      if (lang === "hi") {
        data = await translateArrayFields(
          data,
          ["AppUser.specialization", "AppUser.hospital", "AppUser.location"],
          lang,
          ["AppUser.fullName"]  // names → transliterate (phonetic)
        );
      }
    }

    responseMiddleware(res, HTTP_STATUS.OK, "Requests fetched", data);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch requests");
  }
};

/**
 * PUT /api/v1/doctor-requests/:id/cancel
 * Patient cancels their own pending request
 */
export const cancelRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = req.user ? (req.user as { id: string }).id : null;
    const requestId = req.params.id as string;

    const result = await requestService.cancelRequest(requestId, patientId!);

    responseMiddleware(res, HTTP_STATUS.OK, "Request cancelled successfully", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to cancel request";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

// ── Doctor/Assistant-facing endpoints (called from web dashboard) ────────

/** Resolve the actual doctorId — assistants act on behalf of their parent doctor */
function resolveDoctorId(req: AuthenticatedRequest): string {
  const user = req.user as { id: string; role: string; parentId?: string };
  if (user.role === "ASSISTANT") {
    if (!user.parentId) throw new AppError(403, "Assistant is not assigned to a doctor");
    return user.parentId;
  }
  return user.id;
}

/**
 * GET /api/v1/doctor-requests
 * Doctor/Assistant views assignment requests (optionally filtered by status)
 */
export const getRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const doctorId = resolveDoctorId(req);
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
 * Doctor/Assistant accepts a patient request
 */
export const acceptRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const doctorId = resolveDoctorId(req);
    const requestId = req.params.id as string;

    const result = await requestService.acceptRequest(requestId, doctorId);

    logActivity({
      req,
      userId: req.user!.id,
      userRole: req.user!.role || "DOCTOR",
      action: "PATIENT_REQUEST_ACCEPTED",
      details: { requestId, patientId: result.patientId, actingAs: doctorId },
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
 * Doctor/Assistant rejects a patient request
 */
export const rejectRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const doctorId = resolveDoctorId(req);
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
      userId: req.user!.id,
      userRole: req.user!.role || "DOCTOR",
      action: "PATIENT_REQUEST_REJECTED",
      details: { requestId, patientId: result.patientId, reason: parsed.data.rejectionReason, actingAs: doctorId },
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
