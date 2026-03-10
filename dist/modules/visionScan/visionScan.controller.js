"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllVisionScans = exports.reviewVisionScan = exports.retryVisionScan = exports.getVisionScanById = exports.getVisionScanHistory = exports.manualSubmitVisionScan = exports.uploadVisionScan = void 0;
const visionScan_service_1 = require("./visionScan.service");
const response_1 = require("../../utils/response");
const constants_1 = require("../../utils/constants");
const AppError_1 = require("../../utils/AppError");
const uploadVisionScan = async (req, res) => {
    try {
        const { pageNumber } = req.body;
        const patientId = req.user.id;
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(req.user?.caseType);
        if (!req.file) {
            (0, response_1.sendError)(res, 400, "Image file is required");
            return;
        }
        const result = await visionScan_service_1.visionScanService.processScan(patientId, pageNumber ?? undefined, req.file.buffer, req.file.mimetype, diaryType);
        if ("valid" in result) {
            (0, response_1.sendError)(res, 400, result.reason);
            return;
        }
        (0, response_1.sendResponse)(res, 202, "Scan accepted and queued for processing", result);
    }
    catch (error) {
        console.error("Vision scan upload error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to process vision scan");
    }
};
exports.uploadVisionScan = uploadVisionScan;
const manualSubmitVisionScan = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { pageNumber, answers } = req.body;
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(req.user?.caseType);
        const result = await visionScan_service_1.visionScanService.manualSubmit(patientId, pageNumber, answers, diaryType);
        (0, response_1.sendResponse)(res, 201, "Manual submission saved successfully", result);
    }
    catch (error) {
        console.error("Manual submit error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to save manual submission");
    }
};
exports.manualSubmitVisionScan = manualSubmitVisionScan;
const getVisionScanHistory = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { page, limit } = req.query;
        const result = await visionScan_service_1.visionScanService.getPatientScanHistory(patientId, page, limit);
        (0, response_1.sendResponse)(res, 200, "Scan history retrieved successfully", result);
    }
    catch (error) {
        console.error("Scan history error:", error);
        (0, response_1.sendError)(res, 500, error.message || "Failed to get scan history");
    }
};
exports.getVisionScanHistory = getVisionScanHistory;
const getVisionScanById = async (req, res) => {
    try {
        const result = await visionScan_service_1.visionScanService.getScanById(req.params.id);
        (0, response_1.sendResponse)(res, 200, "Scan result retrieved", result);
    }
    catch (error) {
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message);
    }
};
exports.getVisionScanById = getVisionScanById;
const retryVisionScan = async (req, res) => {
    try {
        const result = await visionScan_service_1.visionScanService.retryScan(req.params.id);
        (0, response_1.sendResponse)(res, 200, "Scan retry queued for processing", result);
    }
    catch (error) {
        console.error("Scan retry error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to retry scan");
    }
};
exports.retryVisionScan = retryVisionScan;
const reviewVisionScan = async (req, res) => {
    try {
        const doctorId = req.user?.id;
        if (!doctorId) {
            (0, response_1.sendError)(res, 401, "Authentication required");
            return;
        }
        const { doctorNotes, flagged, overrides } = req.body;
        const result = await visionScan_service_1.visionScanService.reviewScan(req.params.id, doctorId, { doctorNotes, flagged, overrides });
        (0, response_1.sendResponse)(res, 200, "Scan reviewed successfully", result);
    }
    catch (error) {
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message);
    }
};
exports.reviewVisionScan = reviewVisionScan;
const getAllVisionScans = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            (0, response_1.sendError)(res, 401, "Authentication required");
            return;
        }
        const { page, limit, processingStatus, patientId, startDate, endDate, reviewed, flagged, } = req.query;
        const result = await visionScan_service_1.visionScanService.getAllScans(userId, role, {
            page,
            limit,
            processingStatus,
            patientId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            reviewed,
            flagged,
        });
        (0, response_1.sendResponse)(res, 200, "Scans retrieved successfully", result);
    }
    catch (error) {
        console.error("Get all scans error:", error);
        (0, response_1.sendError)(res, 500, error.message || "Failed to get scans");
    }
};
exports.getAllVisionScans = getAllVisionScans;
