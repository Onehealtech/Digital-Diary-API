"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvancedAnalysisCount = exports.getAdvancedAnalysisPatients = void 0;
const advancedAnalysisService_1 = require("../service/advancedAnalysisService");
const advancedAnalysisTypes_1 = require("../service/advancedAnalysisTypes");
const AppError_1 = require("../utils/AppError");
const response_1 = require("../utils/response");
const activityLogger_1 = require("../utils/activityLogger");
const getAdvancedAnalysisPatients = async (req, res) => {
    try {
        const authReq = req;
        const doctorId = authReq.user.id;
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
const getAdvancedAnalysisCount = async (req, res) => {
    try {
        const authReq = req;
        const doctorId = authReq.user.id;
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
