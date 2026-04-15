"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorFillReport = exports.removeQuestionReportFile = exports.attachQuestionReportFiles = exports.removeReportFile = exports.attachReportFiles = exports.getDiaryFilteredPatients = exports.getAllBubbleScans = exports.reviewBubbleScan = exports.editBubbleScan = exports.retryBubbleScan = exports.getBubbleScanById = exports.getAvailableTemplates = exports.getBubbleScanHistory = exports.uploadBubbleScan = exports.manualSubmitBubbleScan = void 0;
const bubbleScan_service_1 = require("../service/bubbleScan.service");
const visionScan_service_1 = require("../modules/visionScan/visionScan.service");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const DiaryPage_1 = require("../models/DiaryPage");
const AppError_1 = require("../utils/AppError");
const activityLogger_1 = require("../utils/activityLogger");
/**
 * POST /api/v1/bubble-scan/manual
 * Patient submits diary answers manually, optionally with per-question report files.
 *
 * Send as multipart/form-data:
 *   pageNumber  (text)          — e.g. "5"
 *   answers     (text, JSON)    — e.g. {"q1":"yes","q2":"no"}
 *   questionId  (text, repeat)  — one per file, e.g. "Q1", "Q2"
 *   reports     (file, repeat)  — report files matched to questionId by position
 *
 * Files and questionIds are optional — the endpoint still works as pure JSON
 * if no files are attached (Content-Type: application/json or multipart with no files).
 */
const manualSubmitBubbleScan = async (req, res) => {
    try {
        const patientId = req.user.id;
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(req.user?.caseType);
        // pageNumber — accept string (multipart) or number (JSON)
        const rawPage = req.body.pageNumber;
        const pageNumber = typeof rawPage === "string" ? Number(rawPage) : rawPage;
        if (!pageNumber || isNaN(pageNumber)) {
            (0, response_1.sendError)(res, 400, "pageNumber is required");
            return;
        }
        // answers — accept JSON string (multipart) or object (JSON body)
        let answers = req.body.answers;
        if (typeof answers === "string") {
            try {
                answers = JSON.parse(answers);
            }
            catch {
                (0, response_1.sendError)(res, 400, "answers must be a valid JSON object");
                return;
            }
        }
        if (!answers || typeof answers !== "object") {
            (0, response_1.sendError)(res, 400, "answers (object) is required");
            return;
        }
        // Build question-report pairs from optional files
        const files = req.files ?? [];
        const raw = req.body.questionId;
        const questionIds = Array.isArray(raw)
            ? raw.map((q) => q.trim()).filter(Boolean)
            : typeof raw === "string" && raw.trim()
                ? [raw.trim()]
                : [];
        if (files.length > 0 && questionIds.length !== files.length) {
            (0, response_1.sendError)(res, 400, `Mismatch: ${questionIds.length} questionId(s) but ${files.length} file(s). ` +
                "Each report file must have a matching questionId at the same position.");
            return;
        }
        const questionReportPairs = files.map((file, i) => ({
            questionId: questionIds[i],
            file,
        }));
        const result = await bubbleScan_service_1.bubbleScanService.manualSubmit(patientId, pageNumber, answers, diaryType, questionReportPairs);
        (0, activityLogger_1.logActivity)({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "MANUAL_ENTRY_SUBMITTED",
            details: { patientId, pageNumber, reportCount: files.length },
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
        else if (result.processingStatus === "failed") {
            (0, response_1.sendResponse)(res, 200, "Scan processing failed", result);
        }
        else {
            (0, response_1.sendResponse)(res, 202, "Scan uploaded and processing in background", result);
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
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to get scan history");
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
        const result = await bubbleScan_service_1.bubbleScanService.getScanById(req.params.id, req.user?.id, req.user?.role);
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
        const { doctorNotes, flagged, overrides, questionMarks } = req.body;
        const result = await bubbleScan_service_1.bubbleScanService.reviewBubbleScan(req.params.id, doctorId, req.user?.role || "DOCTOR", { doctorNotes, flagged, overrides, questionMarks });
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
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to get bubble scans");
    }
};
exports.getAllBubbleScans = getAllBubbleScans;
/**
 * GET /api/v1/bubble-scan/doctor/diary-filter
 * Doctor dashboard: get all assigned patients filtered by whether they submitted a diary page.
 * Useful for seeing "who uploaded Mammogram", "who hasn't submitted page 5", etc.
 *
 * Query params:
 *   pageNumber  (required) - diary page number to filter on (e.g. 5, 6)
 *   questionId  (optional) - specific question ID to show individual answer (e.g. "q1")
 *   filter      (optional) - "submitted" | "not_submitted" | "all" (default: "all")
 */
const getDiaryFilteredPatients = async (req, res) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            (0, response_1.sendError)(res, 401, "Authentication required");
            return;
        }
        const { pageNumber, questionId, filter } = req.query;
        if (!pageNumber || isNaN(Number(pageNumber))) {
            (0, response_1.sendError)(res, 400, "pageNumber (number) is required");
            return;
        }
        if (filter && !["submitted", "not_submitted", "all"].includes(filter)) {
            (0, response_1.sendError)(res, 400, "filter must be one of: submitted, not_submitted, all");
            return;
        }
        const result = await bubbleScan_service_1.bubbleScanService.getDiaryFilteredPatients(userId, role, {
            pageNumber: Number(pageNumber),
            questionId: questionId,
            filter: filter,
        });
        (0, response_1.sendResponse)(res, 200, "Diary filter results retrieved", result);
    }
    catch (error) {
        console.error("Diary filter error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to get diary filter results");
    }
};
exports.getDiaryFilteredPatients = getDiaryFilteredPatients;
/**
 * POST /api/v1/bubble-scan/:id/reports
 * Patient attaches report files (PDF / images) to an existing scan or manual entry.
 * Accepts up to 5 files via multipart field name "reports".
 */
const attachReportFiles = async (req, res) => {
    try {
        const patientId = req.user.id;
        const scanId = req.params.id;
        const files = req.files;
        if (!files || files.length === 0) {
            (0, response_1.sendError)(res, 400, "At least one report file is required");
            return;
        }
        const result = await bubbleScan_service_1.bubbleScanService.attachReports(scanId, patientId, files);
        (0, activityLogger_1.logActivity)({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "REPORT_FILES_ATTACHED",
            details: { scanId, fileCount: files.length },
        });
        (0, response_1.sendResponse)(res, 200, "Reports attached successfully", result);
    }
    catch (error) {
        console.error("Attach reports error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to attach report files");
    }
};
exports.attachReportFiles = attachReportFiles;
/**
 * DELETE /api/v1/bubble-scan/:id/reports
 * Patient removes a previously attached report from a scan entry.
 * Body: { reportUrl: string }
 */
const removeReportFile = async (req, res) => {
    try {
        const patientId = req.user.id;
        const scanId = req.params.id;
        const { reportUrl } = req.body;
        if (!reportUrl || typeof reportUrl !== "string") {
            (0, response_1.sendError)(res, 400, "reportUrl (string) is required");
            return;
        }
        const result = await bubbleScan_service_1.bubbleScanService.removeReport(scanId, patientId, reportUrl);
        (0, activityLogger_1.logActivity)({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "REPORT_FILE_REMOVED",
            details: { scanId, reportUrl },
        });
        (0, response_1.sendResponse)(res, 200, "Report removed successfully", result);
    }
    catch (error) {
        console.error("Remove report error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to remove report file");
    }
};
exports.removeReportFile = removeReportFile;
/**
 * POST /api/v1/bubble-scan/:id/question-reports
 * Attach report files per question in a single multipart request.
 *
 * Supported formats:
 *   Single question  → questionId: "Q1",  reports: file
 *   Multiple questions → questionId: "Q1", reports: file1,
 *                        questionId: "Q2", reports: file2
 *
 * Rules: number of questionId values must equal number of files.
 * questionId[i] is paired with files[i] by position.
 */
const attachQuestionReportFiles = async (req, res) => {
    try {
        const patientId = req.user.id;
        const scanId = req.params.id;
        const files = req.files;
        // Normalize questionId — multer puts repeated fields as array, single as string
        const raw = req.body.questionId;
        const questionIds = Array.isArray(raw)
            ? raw.map((q) => q.trim()).filter(Boolean)
            : typeof raw === "string" && raw.trim()
                ? [raw.trim()]
                : [];
        if (questionIds.length === 0) {
            (0, response_1.sendError)(res, 400, "At least one questionId field is required");
            return;
        }
        if (!files || files.length === 0) {
            (0, response_1.sendError)(res, 400, "At least one report file is required");
            return;
        }
        if (questionIds.length !== files.length) {
            (0, response_1.sendError)(res, 400, `Mismatch: ${questionIds.length} questionId(s) but ${files.length} file(s). ` +
                "Each file must have a matching questionId at the same position.");
            return;
        }
        const pairs = files.map((file, i) => ({ questionId: questionIds[i], file }));
        const result = await bubbleScan_service_1.bubbleScanService.attachQuestionReports(scanId, patientId, pairs);
        (0, activityLogger_1.logActivity)({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "QUESTION_REPORT_FILES_ATTACHED",
            details: { scanId, questions: questionIds, fileCount: files.length },
        });
        (0, response_1.sendResponse)(res, 200, "Question reports attached successfully", result);
    }
    catch (error) {
        console.error("Attach question reports error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to attach question report files");
    }
};
exports.attachQuestionReportFiles = attachQuestionReportFiles;
/**
 * DELETE /api/v1/bubble-scan/:id/question-reports
 * Patient removes a specific report from a question.
 * Body: { questionId: string, reportUrl: string }
 */
const removeQuestionReportFile = async (req, res) => {
    try {
        const patientId = req.user.id;
        const scanId = req.params.id;
        const { questionId, reportUrl } = req.body;
        if (!questionId || typeof questionId !== "string") {
            (0, response_1.sendError)(res, 400, "questionId (string) is required");
            return;
        }
        if (!reportUrl || typeof reportUrl !== "string") {
            (0, response_1.sendError)(res, 400, "reportUrl (string) is required");
            return;
        }
        const result = await bubbleScan_service_1.bubbleScanService.removeQuestionReport(scanId, patientId, questionId, reportUrl);
        (0, activityLogger_1.logActivity)({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "QUESTION_REPORT_FILE_REMOVED",
            details: { scanId, questionId, reportUrl },
        });
        (0, response_1.sendResponse)(res, 200, "Question report removed successfully", result);
    }
    catch (error) {
        console.error("Remove question report error:", error);
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to remove question report file");
    }
};
exports.removeQuestionReportFile = removeQuestionReportFile;
/**
 * POST /api/v1/bubble-scan/doctor/fill-report
 * Doctor manually creates or updates an investigation report for a patient.
 * Used for pages with layoutType "investigation_summary" (pages 05 & 06).
 */
const doctorFillReport = async (req, res) => {
    try {
        const doctorId = req.user?.id;
        if (!doctorId) {
            (0, response_1.sendError)(res, 401, "Authentication required");
            return;
        }
        const { patientId, pageNumber, questionMarks, doctorNotes, questionSelections } = req.body;
        if (!patientId || typeof patientId !== "string") {
            (0, response_1.sendError)(res, 400, "patientId is required");
            return;
        }
        if (!pageNumber || typeof pageNumber !== "number") {
            (0, response_1.sendError)(res, 400, "pageNumber (number) is required");
            return;
        }
        if (!questionMarks || typeof questionMarks !== "object") {
            (0, response_1.sendError)(res, 400, "questionMarks (object) is required");
            return;
        }
        const result = await bubbleScan_service_1.bubbleScanService.doctorFillReport(patientId, doctorId, req.user?.role || "DOCTOR", pageNumber, questionMarks, doctorNotes, questionSelections);
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: req.user?.role || "DOCTOR",
            action: "DOCTOR_FILL_REPORT",
            details: { patientId, pageNumber },
        });
        (0, response_1.sendResponse)(res, 200, "Investigation report saved successfully", result);
    }
    catch (error) {
        const status = error instanceof AppError_1.AppError ? error.statusCode : 500;
        (0, response_1.sendError)(res, status, error.message || "Failed to save report");
    }
};
exports.doctorFillReport = doctorFillReport;
