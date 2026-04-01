"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvancedAnalysisCount = exports.syncAnalyticsGoogleSheet = exports.getAdvancedAnalysisPatients = void 0;
const zod_1 = require("zod");
const advancedAnalysisService_1 = require("../service/advancedAnalysisService");
const advancedAnalysisTypes_1 = require("../service/advancedAnalysisTypes");
const googleSheets_service_1 = require("../service/googleSheets.service");
const AppError_1 = require("../utils/AppError");
const Appuser_1 = require("../models/Appuser");
const response_1 = require("../utils/response");
const activityLogger_1 = require("../utils/activityLogger");
/**
 * Resolves the effective doctor ID.
 * For assistants, looks up parentId directly from DB to avoid raw-query mapping issues.
 * For doctors, returns their own ID.
 */
async function resolveDoctorId(authReq) {
    const user = authReq.user;
    if (user.role === "ASSISTANT") {
        // Always fetch fresh from DB — the auth middleware uses raw:true which can
        // miss camelCase FK columns on self-referencing associations.
        const assistant = await Appuser_1.AppUser.findByPk(user.id, {
            attributes: ["id", "parentId"],
        });
        const parentId = assistant?.parentId;
        if (!parentId)
            throw new AppError_1.AppError(403, "Assistant is not linked to a doctor");
        return parentId;
    }
    return user.id;
}
const getAdvancedAnalysisPatients = async (req, res) => {
    try {
        const authReq = req;
        const doctorId = await resolveDoctorId(authReq);
        const userRole = authReq.user.role;
        const parsed = advancedAnalysisTypes_1.AdvancedAnalysisFilterSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.sendError)(res, parsed.error.issues[0].message, 400);
            return;
        }
        const filter = parsed.data;
        const result = await advancedAnalysisService_1.advancedAnalysisService.getPatients(doctorId, filter);
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole,
            action: "ADVANCED_ANALYSIS_FETCH",
            details: { page: filter.page, totalReturned: result.patients.length },
        });
        (0, response_1.sendResponse)(res, result, "Patients fetched successfully");
    }
    catch (error) {
        console.error("[AdvancedAnalysis]", error);
        if (error instanceof AppError_1.AppError) {
            (0, response_1.sendError)(res, error.message, error.statusCode);
        }
        else {
            const msg = error instanceof Error ? error.message : "Internal server error";
            (0, response_1.sendError)(res, msg, 500);
        }
    }
};
exports.getAdvancedAnalysisPatients = getAdvancedAnalysisPatients;
const SyncSheetBodySchema = zod_1.z.object({
    filter: advancedAnalysisTypes_1.AdvancedAnalysisFilterSchema,
    sheetId: zod_1.z.string().optional(),
});
const syncAnalyticsGoogleSheet = async (req, res) => {
    try {
        const authReq = req;
        const doctorId = authReq.user.id;
        const parsed = SyncSheetBodySchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.sendError)(res, parsed.error.issues[0].message, 400);
            return;
        }
        const { filter, sheetId } = parsed.data;
        const result = await googleSheets_service_1.googleSheetsService.syncAnalyticsSheet(doctorId, filter, sheetId);
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: authReq.user.role,
            action: sheetId ? "ANALYTICS_SHEET_UPDATED" : "ANALYTICS_SHEET_CREATED",
            details: { sheetId: result.sheetId },
        });
        (0, response_1.sendResponse)(res, result, sheetId ? "Sheet updated" : "Sheet created");
    }
    catch (error) {
        console.error("[AnalyticsSyncSheet]", error);
        if (error instanceof AppError_1.AppError) {
            (0, response_1.sendError)(res, error.message, error.statusCode);
        }
        else {
            const msg = error instanceof Error ? error.message : "Internal server error";
            (0, response_1.sendError)(res, msg, 500);
        }
    }
};
exports.syncAnalyticsGoogleSheet = syncAnalyticsGoogleSheet;
const getAdvancedAnalysisCount = async (req, res) => {
    try {
        const authReq = req;
        const doctorId = await resolveDoctorId(authReq);
        const parsed = advancedAnalysisTypes_1.AdvancedAnalysisFilterSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.sendError)(res, parsed.error.issues[0].message, 400);
            return;
        }
        const count = await advancedAnalysisService_1.advancedAnalysisService.getCount(doctorId, parsed.data);
        (0, response_1.sendResponse)(res, { total: count }, "Count fetched successfully");
    }
    catch (error) {
        console.error("[AdvancedAnalysis]", error);
        if (error instanceof AppError_1.AppError) {
            (0, response_1.sendError)(res, error.message, error.statusCode);
        }
        else {
            const msg = error instanceof Error ? error.message : "Internal server error";
            (0, response_1.sendError)(res, msg, 500);
        }
    }
};
exports.getAdvancedAnalysisCount = getAdvancedAnalysisCount;
