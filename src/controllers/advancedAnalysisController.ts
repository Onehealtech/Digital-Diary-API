import { Request, Response } from "express";
import { z } from "zod";
import { advancedAnalysisService } from "../service/advancedAnalysisService";
import { AdvancedAnalysisFilterSchema } from "../service/advancedAnalysisTypes";
import { googleSheetsService } from "../service/googleSheets.service";
import { AppError } from "../utils/AppError";
import { sendResponse, sendError } from "../utils/response";
import { logActivity } from "../utils/activityLogger";
import { CustomRequest } from "../middleware/authMiddleware";
import { resolveAssistantPatientScope } from "../service/patientAccess.service";

/**
 * Resolves the effective doctor scope.
 * Assistants are restricted to assigned patients when patient access is set to
 * "selected".
 */
async function resolveDoctorScope(authReq: CustomRequest): Promise<{
  doctorId: string;
  allowedPatientIds?: string[];
}> {
  const user = authReq.user!;
  return resolveAssistantPatientScope({ id: user.id, role: user.role });
}

const DateRangeSchema = z.enum(["7d", "30d", "90d", "all"]).default("30d");

export const getAdvancedAnalyticsDashboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as CustomRequest;
    const { doctorId, allowedPatientIds } = await resolveDoctorScope(authReq);
    const userRole = authReq.user!.role;

    const parsedRange = DateRangeSchema.safeParse(req.query.dateRange ?? req.body?.dateRange);
    const dateRange = parsedRange.success ? parsedRange.data : "30d";

    // Parse optional filter (same schema as patient list) - applies to analytics too
    const parsedFilter = AdvancedAnalysisFilterSchema.safeParse(req.body?.filter ?? {});
    const filter = parsedFilter.success ? parsedFilter.data : undefined;

    const data = await advancedAnalysisService.getAnalytics(
      doctorId,
      dateRange,
      filter,
      allowedPatientIds
    );

    logActivity({
      req,
      userId: doctorId,
      userRole,
      action: "ADVANCED_ANALYTICS_DASHBOARD_VIEW",
      details: { totalPatients: data.kpi.totalActivePatients },
    });

    sendResponse(res, data, "Analytics fetched successfully");
  } catch (error: unknown) {
    console.error("[AdvancedAnalyticsDashboard]", error);
    if (error instanceof AppError) {
      sendError(res, error.message, error.statusCode);
    } else {
      const msg = error instanceof Error ? error.message : "Internal server error";
      sendError(res, msg, 500);
    }
  }
};

export const getAdvancedAnalysisPatients = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as CustomRequest;
    const { doctorId, allowedPatientIds } = await resolveDoctorScope(authReq);
    const userRole = authReq.user!.role;

    const parsed = AdvancedAnalysisFilterSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0].message, 400);
      return;
    }

    const filter = parsed.data;
    const result = await advancedAnalysisService.getPatients(
      doctorId,
      filter,
      allowedPatientIds
    );

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
    const { doctorId, allowedPatientIds } = await resolveDoctorScope(authReq);

    const parsed = SyncSheetBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0].message, 400);
      return;
    }

    const { filter, sheetId } = parsed.data;
    const result = await googleSheetsService.syncAnalyticsSheet(
      doctorId,
      filter,
      sheetId,
      allowedPatientIds
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
    const { doctorId, allowedPatientIds } = await resolveDoctorScope(authReq);

    const parsed = AdvancedAnalysisFilterSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0].message, 400);
      return;
    }

    const count = await advancedAnalysisService.getCount(
      doctorId,
      parsed.data,
      allowedPatientIds
    );
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
