import { Response } from "express";
import { exportService } from "../service/export.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";

class ExportController {
  /**
   * POST /api/v1/reports/patient-data
   * Export patient data
   */
  async exportPatientData(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
        return sendError(res, "Only doctors and assistants can export patient data", 403);
      }

      const { patientId, format = "pdf", includeTestHistory, includeDiaryEntries } = req.body;

      if (!patientId) {
        return sendError(res, "patientId is required", 400);
      }

      if (!["pdf", "excel", "csv"].includes(format)) {
        return sendError(res, "format must be pdf, excel, or csv", 400);
      }

      const result = await exportService.exportPatientData({
        userId,
        patientId,
        format,
        includeTestHistory,
        includeDiaryEntries,
      });

      return sendResponse(res, result, "Patient data export queued successfully", 201);
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/reports/diary-pages
   * Export diary pages (images)
   */
  async exportDiaryPages(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
        return sendError(res, "Only doctors and assistants can export diary pages", 403);
      }

      const { patientId, format = "pdf", startDate, endDate } = req.body;

      if (!patientId) {
        return sendError(res, "patientId is required", 400);
      }

      if (!["pdf", "zip"].includes(format)) {
        return sendError(res, "format must be pdf or zip", 400);
      }

      const result = await exportService.exportDiaryPages({
        userId,
        patientId,
        format,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      return sendResponse(res, result, "Diary pages export queued successfully", 201);
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/reports/test-summary
   * Export test summary for a patient
   */
  async exportTestSummary(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
        return sendError(res, "Only doctors and assistants can export test summaries", 403);
      }

      const { patientId, format = "pdf" } = req.body;

      if (!patientId) {
        return sendError(res, "patientId is required", 400);
      }

      if (!["pdf", "excel"].includes(format)) {
        return sendError(res, "format must be pdf or excel", 400);
      }

      const result = await exportService.exportTestSummary({
        userId,
        patientId,
        format,
      });

      return sendResponse(res, result, "Test summary export queued successfully", 201);
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/reports/exports
   * Get all exports for the logged-in user
   */
  async getUserExports(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const { page = 1, limit = 20 } = req.query;

      const result = await exportService.getUserExports(
        userId,
        Number(page),
        Number(limit)
      );

      return sendResponse(res, result, "Exports fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/reports/exports/:id/download
   * Get download URL for an export
   */
  async downloadExport(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const exportRecord = await exportService.getExportById(id, userId);

      if (exportRecord.status === "expired") {
        return sendError(res, "This export has expired", 410); // 410 Gone
      }

      return sendResponse(res, exportRecord, "Export details fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * DELETE /api/v1/reports/exports/:id
   * Delete an export
   */
  async deleteExport(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const result = await exportService.deleteExport(id, userId);

      return sendResponse(res, result, "Export deleted successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * GET /api/v1/reports/analytics/patient/:id
   * Get advanced analytics for a patient
   */
  async getPatientAnalytics(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const requesterId = req.user?.id;
      const role = req.user?.role;

      if (!requesterId || !role) {
        return sendError(res, "Unauthorized", 401);
      }

      const analytics = await exportService.getPatientAnalytics(id, requesterId, role);

      return sendResponse(res, analytics, "Patient analytics fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }
}

export const exportController = new ExportController();
