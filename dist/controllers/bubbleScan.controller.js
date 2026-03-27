"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllBubbleScans = exports.reviewBubbleScan = exports.editBubbleScan = exports.retryBubbleScan = exports.getBubbleScanById = exports.getAvailableTemplates = exports.getBubbleScanHistory = exports.uploadBubbleScan = exports.manualSubmitBubbleScan = void 0;
const bubbleScan_service_1 = require("../service/bubbleScan.service");
const visionScan_service_1 = require("../modules/visionScan/visionScan.service");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const DiaryPage_1 = require("../models/DiaryPage");
const AppError_1 = require("../utils/AppError");
const activityLogger_1 = require("../utils/activityLogger");
/**
 * POST /api/v1/bubble-scan/manual
 * Patient submits diary answers manually (for non-scan mode)
 */
const manualSubmitBubbleScan = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { pageNumber, answers } = req.body;
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(req.user?.caseType);
        if (!pageNumber || typeof pageNumber !== "number") {
            (0, response_1.sendError)(res, 400, "pageNumber (number) is required");
            return;
        }
        if (!answers || typeof answers !== "object") {
            (0, response_1.sendError)(res, 400, "answers (object) is required");
            return;
        }
        const result = await bubbleScan_service_1.bubbleScanService.manualSubmit(patientId, pageNumber, answers, diaryType);
        (0, activityLogger_1.logActivity)({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "MANUAL_ENTRY_SUBMITTED",
            details: { patientId, pageNumber },
        });
        (0, response_1.sendResponse)(res, 201, "Manual submission saved successfully", result);
    }
    catch (error) {
        console.error("Manual submit error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to save manual submission");
    }
};
exports.manualSubmitBubbleScan = manualSubmitBubbleScan;
/**
 * POST /api/v1/bubble-scan/upload
 * Patient uploads a diary page photo for AI vision scanning
 */
const uploadBubbleScan = async (req, res) => {
    try {
        const { pageNumber } = req.body;
        const patientId = req.user.id;
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(req.user?.caseType);
        if (!req.file) {
            (0, response_1.sendError)(res, 400, "Image file is required");
            return;
        }
        const result = await visionScan_service_1.visionScanService.processScan(patientId, pageNumber ? Number(pageNumber) : undefined, req.file.buffer, req.file.mimetype, diaryType);
        if ("valid" in result) {
            (0, response_1.sendError)(res, 400, result.reason);
            return;
        }
        (0, activityLogger_1.logActivity)({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "BUBBLE_SCAN_UPLOADED",
            details: { patientId, pageNumber, processingStatus: result.processingStatus },
        });
        if (result.processingStatus === "completed") {
            (0, response_1.sendResponse)(res, 200, "Scan completed successfully", result);
        }
        else {
            (0, response_1.sendResponse)(res, 202, "Scan processing did not complete successfully", result);
        }
    }
    catch (error) {
        console.error("Bubble scan upload error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to process bubble scan");
    }
};
exports.uploadBubbleScan = uploadBubbleScan;
/**
 * GET /api/v1/bubble-scan/history
 * Patient gets their bubble scan history
 */
const getBubbleScanHistory = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const result = await bubbleScan_service_1.bubbleScanService.getPatientScanHistory(patientId, Number(page), Number(limit));
        (0, response_1.sendResponse)(res, 200, "Bubble scan history retrieved successfully", result);
    }
    catch (error) {
        console.error("Bubble scan history error:", error);
        (0, response_1.sendError)(res, 500, error.message || "Failed to get scan history");
    }
};
exports.getBubbleScanHistory = getBubbleScanHistory;
/**
 * GET /api/v1/bubble-scan/templates
 * Get list of available diary pages from DB
 */
const getAvailableTemplates = async (req, res) => {
    try {
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(req.user?.caseType);
        const pages = await DiaryPage_1.DiaryPage.findAll({
            where: { diaryType, isActive: true },
            attributes: ["pageNumber", "title", "layoutType"],
            order: [["pageNumber", "ASC"]],
            raw: true,
        });
        (0, response_1.sendResponse)(res, 200, "Available templates retrieved", pages);
    }
    catch (error) {
        console.error("Get templates error:", error);
        (0, response_1.sendError)(res, 500, error.message || "Failed to get templates");
    }
};
exports.getAvailableTemplates = getAvailableTemplates;
/**
 * GET /api/v1/bubble-scan/:id
 * Get single bubble scan result
 */
const getBubbleScanById = async (req, res) => {
    try {
        const result = await bubbleScan_service_1.bubbleScanService.getScanById(req.params.id);
        (0, response_1.sendResponse)(res, 200, "Bubble scan result retrieved", result);
    }
    catch (error) {
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message);
    }
};
exports.getBubbleScanById = getBubbleScanById;
/**
 * POST /api/v1/bubble-scan/:id/retry
 * Retry a failed scan (downloads image from S3 and reprocesses)
 */
const retryBubbleScan = async (req, res) => {
    try {
        const result = await visionScan_service_1.visionScanService.retryScan(req.params.id);
        (0, response_1.sendResponse)(res, 200, "Scan retry queued for processing", result);
    }
    catch (error) {
        console.error("Bubble scan retry error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to retry scan");
    }
};
exports.retryBubbleScan = retryBubbleScan;
/**
 * PUT /api/v1/bubble-scan/:id/edit
 * Patient edits a scan entry's answers (only submissionType: "scan" allowed)
 */
const editBubbleScan = async (req, res) => {
    try {
        const patientId = req.user.id;
        const scanId = req.params.id;
        const { answers } = req.body;
        if (!answers || typeof answers !== "object") {
            (0, response_1.sendError)(res, 400, "answers (object) is required");
            return;
        }
        const result = await bubbleScan_service_1.bubbleScanService.editScanEntry(scanId, patientId, answers);
        (0, activityLogger_1.logActivity)({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "SCAN_ENTRY_EDITED",
            details: { scanId, editedFields: Object.keys(answers) },
        });
        (0, response_1.sendResponse)(res, 200, "Scan entry updated successfully", result);
    }
    catch (error) {
        console.error("Edit scan entry error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to edit scan entry");
    }
};
exports.editBubbleScan = editBubbleScan;
/**
 * PUT /api/v1/bubble-scan/:id/review
 * Doctor reviews and optionally overrides bubble scan results
 */
const reviewBubbleScan = async (req, res) => {
    try {
        const doctorId = req.user?.id;
        if (!doctorId) {
            (0, response_1.sendError)(res, 401, "Authentication required");
            return;
        }
        const { doctorNotes, flagged, overrides } = req.body;
        const result = await bubbleScan_service_1.bubbleScanService.reviewBubbleScan(req.params.id, doctorId, { doctorNotes, flagged, overrides });
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: req.user?.role || "DOCTOR",
            action: "BUBBLE_SCAN_REVIEWED",
            details: { scanId: req.params.id, flagged },
        });
        (0, response_1.sendResponse)(res, 200, "Bubble scan reviewed successfully", result);
    }
    catch (error) {
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message);
    }
};
exports.reviewBubbleScan = reviewBubbleScan;
/**
 * GET /api/v1/bubble-scan/doctor/all
 * Doctor/Assistant gets all bubble scans for their patients
 */
const getAllBubbleScans = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            (0, response_1.sendError)(res, 401, "Authentication required");
            return;
        }
        const { page, limit, templateName, processingStatus, patientId, startDate, endDate, reviewed, flagged, } = req.query;
        const result = await bubbleScan_service_1.bubbleScanService.getAllBubbleScans(userId, role, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            templateName: templateName,
            processingStatus: processingStatus,
            patientId: patientId,
            startDate: startDate
                ? new Date(startDate)
                : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            reviewed: reviewed !== undefined
                ? reviewed === "true"
                : undefined,
            flagged: flagged !== undefined ? flagged === "true" : undefined,
        });
        (0, response_1.sendResponse)(res, 200, "Bubble scans retrieved successfully", result);
    }
    catch (error) {
        console.error("Get all bubble scans error:", error);
        (0, response_1.sendError)(res, 500, error.message || "Failed to get bubble scans");
    }
};
exports.getAllBubbleScans = getAllBubbleScans;
