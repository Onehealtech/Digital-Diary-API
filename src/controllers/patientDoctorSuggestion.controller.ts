// src/controllers/patientDoctorSuggestion.controller.ts

import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";
import { AppError } from "../utils/AppError";
import { logActivity } from "../utils/activityLogger";
import * as suggestionService from "../service/patientDoctorSuggestion.service";

// ── Zod Schemas ──────────────────────────────────────────────────────────

const createSuggestionSchema = z.object({
  doctorName: z.string().min(2, "Doctor name is required").max(255),
  doctorPhone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits").optional(),
  doctorEmail: z.string().email("Invalid email").optional(),
  hospital: z.string().max(255).optional(),
  specialization: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  additionalNotes: z.string().max(1000).optional(),
});

const approveSuggestionSchema = z.object({
  onboardedDoctorId: z.string().uuid("Invalid doctor ID").optional(),
  newDoctor: z.object({
    fullName: z.string().min(1, "Doctor name is required").max(100),
    email: z.string().email("Invalid email"),
    phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits").optional(),
    hospital: z.string().max(100).optional(),
    specialization: z.string().max(100).optional(),
    license: z.string().max(30).optional(),
    address: z.string().max(500).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
  }).optional(),
});

const rejectSuggestionSchema = z.object({
  rejectionReason: z.string().max(500).optional(),
});

// ── Patient-facing endpoints ─────────────────────────────────────────────

/**
 * POST /api/v1/doctor-requests/suggest-doctor
 * Patient suggests a doctor not found in the system
 */
export const createSuggestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = (req.user as { id: string }).id;

    const parsed = createSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await suggestionService.createSuggestion(patientId, parsed.data);
    responseMiddleware(res, HTTP_STATUS.CREATED, "Doctor suggestion submitted successfully", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to submit suggestion";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

/**
 * GET /api/v1/doctor-requests/my-suggestions
 * Patient views their own suggestions
 */
export const getMySuggestions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = (req.user as { id: string }).id;
    const suggestions = await suggestionService.getMySuggestions(patientId);
    responseMiddleware(res, HTTP_STATUS.OK, "Suggestions fetched", suggestions);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch suggestions");
  }
};

// ── Super Admin-facing endpoints ─────────────────────────────────────────

/**
 * GET /api/v1/doctor-requests/suggestions
 * Super Admin views all doctor suggestions with pagination
 */
export const getAllSuggestions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;

    const result = await suggestionService.getAllSuggestions({ page, limit, status });
    responseMiddleware(res, HTTP_STATUS.OK, "Suggestions fetched", result);
  } catch (error: unknown) {
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch suggestions");
  }
};

/**
 * GET /api/v1/doctor-requests/suggestions/:id
 * Super Admin views single suggestion detail
 */
export const getSuggestionById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await suggestionService.getSuggestionById(req.params.id as string);
    responseMiddleware(res, HTTP_STATUS.OK, "Suggestion fetched", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch suggestion");
  }
};

/**
 * POST /api/v1/doctor-requests/suggestions/:id/approve
 * Super Admin approves a patient doctor suggestion
 */
export const approveSuggestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = approveSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await suggestionService.approveSuggestion(
      req.params.id as string,
      req.user!.id,
      parsed.data.onboardedDoctorId,
      parsed.data.newDoctor
    );

    const message = result.doctorCreated
      ? "Doctor suggestion approved and new doctor profile created"
      : "Doctor suggestion approved";

    logActivity({
      req,
      userId: req.user!.id,
      userRole: "SUPER_ADMIN",
      action: "DOCTOR_SUGGESTION_APPROVED",
      details: {
        suggestionId: req.params.id as string,
        onboardedDoctorId: result.suggestion.onboardedDoctorId,
        doctorCreated: result.doctorCreated,
      },
    });

    responseMiddleware(res, HTTP_STATUS.OK, message, result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to approve suggestion");
  }
};

/**
 * POST /api/v1/doctor-requests/suggestions/:id/reject
 * Super Admin rejects a patient doctor suggestion
 */
export const rejectSuggestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = rejectSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
      return;
    }

    const result = await suggestionService.rejectSuggestion(
      req.params.id as string,
      req.user!.id,
      parsed.data.rejectionReason
    );

    logActivity({
      req,
      userId: req.user!.id,
      userRole: "SUPER_ADMIN",
      action: "DOCTOR_SUGGESTION_REJECTED",
      details: { suggestionId: req.params.id as string, reason: parsed.data.rejectionReason },
    });

    responseMiddleware(res, HTTP_STATUS.OK, "Doctor suggestion rejected", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reject suggestion");
  }
};
