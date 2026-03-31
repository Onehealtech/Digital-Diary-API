import { Request, Response } from "express";
import { z } from "zod";
import { advancedAnalysisService } from "../service/advancedAnalysisService";
import { AdvancedAnalysisFilterSchema } from "../service/advancedAnalysisTypes";
import { googleSheetsService } from "../service/googleSheets.service";
import { AppError } from "../utils/AppError";
import { AppUser } from "../models/Appuser";
import { sendResponse, sendError } from "../utils/response";
import { logActivity } from "../utils/activityLogger";
import { CustomRequest } from "../middleware/authMiddleware";

/**
 * Resolves the effective doctor ID.
 * For assistants, looks up parentId directly from DB to avoid raw-query mapping issues.
 * For doctors, returns their own ID.
 */
async function resolveDoctorId(authReq: CustomRequest): Promise<string> {
  const user = authReq.user!;
  if (user.role === "ASSISTANT") {
    // Always fetch fresh from DB — the auth middleware uses raw:true which can
    // miss camelCase FK columns on self-referencing associations.
    const assistant = await AppUser.findByPk(user.id, {
      attributes: ["id", "parentId"],
    });
    const parentId = assistant?.parentId;
    if (!parentId) throw new AppError(403, "Assistant is not linked to a doctor");
    return parentId;
  }
  return user.id;
}

export const getAdvancedAnalysisPatients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as CustomRequest;
    const doctorId = await resolveDoctorId(authReq);
    const userRole = authReq.user!.role;

    const parsed = AdvancedAnalysisFilterSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0].message, 400);
      return;
    }

    const filter = parsed.data;
    const result = await advancedAnalysisService.getPatients(doctorId, filter);

    logActivity({
      req,
      userId: doctorId,
      userRole,
      action: "ADVANCED_ANALYSIS_FETCH",
      details: { page: filter.page, totalReturned: result.patients.length },
    });

    sendResponse(res, result, "Patients fetched successfully");
  } catch (error: unknown) {
    console.error("[AdvancedAnalysis]", error);
    if (error instanceof AppError) {
      sendError(res, error.message, error.statusCode);
    } else {
      const msg = error instanceof Error ? error.message : "Internal server error";
      sendError(res, msg, 500);
    }
  }
};

const SyncSheetBodySchema = z.object({
  filter: AdvancedAnalysisFilterSchema,
  sheetId: z.string().optional(),
});

export const syncAnalyticsGoogleSheet = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as CustomRequest;
    const doctorId = authReq.user!.id;

    const parsed = SyncSheetBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0].message, 400);
      return;
    }

    const { filter, sheetId } = parsed.data;
    const result = await googleSheetsService.syncAnalyticsSheet(
      doctorId,
      filter,
      sheetId
    );

    logActivity({
      req,
      userId: doctorId,
      userRole: authReq.user!.role,
      action: sheetId ? "ANALYTICS_SHEET_UPDATED" : "ANALYTICS_SHEET_CREATED",
      details: { sheetId: result.sheetId },
    });

    sendResponse(res, result, sheetId ? "Sheet updated" : "Sheet created");
  } catch (error: unknown) {
    console.error("[AnalyticsSyncSheet]", error);
    if (error instanceof AppError) {
      sendError(res, error.message, error.statusCode);
    } else {
      const msg = error instanceof Error ? error.message : "Internal server error";
      sendError(res, msg, 500);
    }
  }
};

export const getAdvancedAnalysisCount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as CustomRequest;
    const doctorId = await resolveDoctorId(authReq);

    const parsed = AdvancedAnalysisFilterSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0].message, 400);
      return;
    }

    const count = await advancedAnalysisService.getCount(doctorId, parsed.data);
    sendResponse(res, { total: count }, "Count fetched successfully");
  } catch (error: unknown) {
    console.error("[AdvancedAnalysis]", error);
    if (error instanceof AppError) {
      sendError(res, error.message, error.statusCode);
    } else {
      const msg = error instanceof Error ? error.message : "Internal server error";
      sendError(res, msg, 500);
    }
  }
};
