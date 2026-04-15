"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportController = void 0;
const export_service_1 = require("../service/export.service");
const response_1 = require("../utils/response");
class ExportController {
    /**
     * POST /api/v1/reports/patient-data
     * Export patient data
     */
    async exportPatientData(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only doctors and assistants can export patient data", 403);
            }
            const { patientId, format = "pdf", includeTestHistory, includeDiaryEntries } = req.body;
            if (!patientId) {
                return (0, response_1.sendError)(res, "patientId is required", 400);
            }
            if (!["pdf", "excel", "csv"].includes(format)) {
                return (0, response_1.sendError)(res, "format must be pdf, excel, or csv", 400);
            }
            const result = await export_service_1.exportService.exportPatientData({
                userId,
                patientId,
                format,
                includeTestHistory,
                includeDiaryEntries,
            });
            return (0, response_1.sendResponse)(res, result, "Patient data export queued successfully", 201);
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * POST /api/v1/reports/diary-pages
     * Export diary pages (images)
     */
    async exportDiaryPages(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only doctors and assistants can export diary pages", 403);
            }
            const { patientId, format = "pdf", startDate, endDate } = req.body;
            if (!patientId) {
                return (0, response_1.sendError)(res, "patientId is required", 400);
            }
            if (!["pdf", "zip"].includes(format)) {
                return (0, response_1.sendError)(res, "format must be pdf or zip", 400);
            }
            const result = await export_service_1.exportService.exportDiaryPages({
                userId,
                patientId,
                format,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            });
            return (0, response_1.sendResponse)(res, result, "Diary pages export queued successfully", 201);
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * POST /api/v1/reports/test-summary
     * Export test summary for a patient
     */
    async exportTestSummary(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["DOCTOR", "ASSISTANT"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only doctors and assistants can export test summaries", 403);
            }
            const { patientId, format = "pdf" } = req.body;
            if (!patientId) {
                return (0, response_1.sendError)(res, "patientId is required", 400);
            }
            if (!["pdf", "excel"].includes(format)) {
                return (0, response_1.sendError)(res, "format must be pdf or excel", 400);
            }
            const result = await export_service_1.exportService.exportTestSummary({
                userId,
                patientId,
                format,
            });
            return (0, response_1.sendResponse)(res, result, "Test summary export queued successfully", 201);
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/reports/exports
     * Get all exports for the logged-in user
     */
    async getUserExports(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { page = 1, limit = 20 } = req.query;
            const result = await export_service_1.exportService.getUserExports(userId, Number(page), Number(limit));
            return (0, response_1.sendResponse)(res, result, "Exports fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/reports/exports/:id/download
     * Get download URL for an export
     */
    async downloadExport(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const exportRecord = await export_service_1.exportService.getExportById(id, userId);
            if (exportRecord.status === "expired") {
                return (0, response_1.sendError)(res, "This export has expired", 410); // 410 Gone
            }
            return (0, response_1.sendResponse)(res, exportRecord, "Export details fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * DELETE /api/v1/reports/exports/:id
     * Delete an export
     */
    async deleteExport(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            if (!userId) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const result = await export_service_1.exportService.deleteExport(id, userId);
            return (0, response_1.sendResponse)(res, result, "Export deleted successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * GET /api/v1/reports/analytics/patient/:id
     * Get advanced analytics for a patient
     */
    async getPatientAnalytics(req, res) {
        try {
            const id = req.params.id;
            const requesterId = req.user?.id;
            const role = req.user?.role;
            if (!requesterId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const analytics = await export_service_1.exportService.getPatientAnalytics(id, requesterId, role);
            return (0, response_1.sendResponse)(res, analytics, "Patient analytics fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
}
exports.exportController = new ExportController();
