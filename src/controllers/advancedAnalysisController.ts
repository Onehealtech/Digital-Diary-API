import { Request, Response } from "express";
import { z } from "zod";
import { advancedAnalysisService } from "../service/advancedAnalysisService";
import { AdvancedAnalysisFilterSchema } from "../service/advancedAnalysisTypes";
import { googleSheetsService } from "../service/googleSheets.service";
import { AppError } from "../utils/AppError";
import { sendResponse, sendError } from "../utils/response";
import { logActivity } from "../utils/activityLogger";
import { CustomRequest } from "../middleware/authMiddleware";

export const getAdvancedAnalysisPatients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as CustomRequest;
    const doctorId = authReq.user!.id;
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
    const doctorId = authReq.user!.id;

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
