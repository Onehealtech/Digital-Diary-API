import { Response } from "express";
import {
    AuthenticatedRequest,
    AuthRequest,
} from "../middleware/authMiddleware";
import { bubbleScanService } from "../service/bubbleScan.service";
import { visionScanService } from "../modules/visionScan/visionScan.service";
import { sendResponse, sendError } from "../utils/response";
import { getDiaryTypeForCaseType } from "../utils/constants";
import { DiaryPage } from "../models/DiaryPage";
import { AppError } from "../utils/AppError";
import { logActivity } from "../utils/activityLogger";

/**
 * POST /api/v1/bubble-scan/manual
 * Patient submits diary answers manually (for non-scan mode)
 */
export const manualSubmitBubbleScan = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const { pageNumber, answers } = req.body;
        const diaryType = getDiaryTypeForCaseType(req.user?.caseType);

        if (!pageNumber || typeof pageNumber !== "number") {
            sendError(res, 400, "pageNumber (number) is required");
            return;
        }
        if (!answers || typeof answers !== "object") {
            sendError(res, 400, "answers (object) is required");
            return;
        }

        const result = await bubbleScanService.manualSubmit(
            patientId,
            pageNumber,
            answers,
            diaryType
        );

        logActivity({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "MANUAL_ENTRY_SUBMITTED",
            details: { patientId, pageNumber },
        });

        sendResponse(res, 201, "Manual submission saved successfully", result);
    } catch (error: any) {
        console.error("Manual submit error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to save manual submission");
    }
};

/**
 * POST /api/v1/bubble-scan/upload
 * Patient uploads a diary page photo for AI vision scanning
 */
export const uploadBubbleScan = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { pageNumber } = req.body;
        const patientId = req.user!.id;
        const diaryType = getDiaryTypeForCaseType(req.user?.caseType);

        if (!req.file) {
            sendError(res, 400, "Image file is required");
            return;
        }

        const result = await visionScanService.processScan(
            patientId,
            pageNumber ? Number(pageNumber) : undefined,
            req.file.buffer,
            req.file.mimetype,
            diaryType
        );

        if ("valid" in result) {
            sendError(res, 400, result.reason);
            return;
        }

        logActivity({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "BUBBLE_SCAN_UPLOADED",
            details: { patientId, pageNumber, processingStatus: result.processingStatus },
        });

        if (result.processingStatus === "completed") {
            sendResponse(res, 200, "Scan completed successfully", result);
        } else {
            sendResponse(
                res,
                202,
                "Scan processing did not complete successfully",
                result
            );
        }
    } catch (error: any) {
        console.error("Bubble scan upload error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to process bubble scan");
    }
};

/**
 * GET /api/v1/bubble-scan/history
 * Patient gets their bubble scan history
 */
export const getBubbleScanHistory = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const { page = 1, limit = 20 } = req.query;
        const result = await bubbleScanService.getPatientScanHistory(
            patientId,
            Number(page),
            Number(limit)
        );
        sendResponse(
            res,
            200,
            "Bubble scan history retrieved successfully",
            result
        );
    } catch (error: any) {
        console.error("Bubble scan history error:", error);
        sendError(res, 500, error.message || "Failed to get scan history");
    }
};

/**
 * GET /api/v1/bubble-scan/templates
 * Get list of available diary pages from DB
 */
export const getAvailableTemplates = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const diaryType = getDiaryTypeForCaseType(req.user?.caseType);
        const pages = await DiaryPage.findAll({
            where: { diaryType, isActive: true },
            attributes: ["pageNumber", "title", "layoutType"],
            order: [["pageNumber", "ASC"]],
            raw: true,
        });
        sendResponse(res, 200, "Available templates retrieved", pages);
    } catch (error: any) {
        console.error("Get templates error:", error);
        sendError(res, 500, error.message || "Failed to get templates");
    }
};

/**
 * GET /api/v1/bubble-scan/:id
 * Get single bubble scan result
 */
export const getBubbleScanById = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const result = await bubbleScanService.getScanById(req.params.id as string);
        sendResponse(res, 200, "Bubble scan result retrieved", result);
    } catch (error: any) {
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message);
    }
};

/**
 * POST /api/v1/bubble-scan/:id/retry
 * Retry a failed scan (downloads image from S3 and reprocesses)
 */
export const retryBubbleScan = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const result = await visionScanService.retryScan(req.params.id as string);

        sendResponse(
            res,
            200,
            "Scan retry queued for processing",
            result
        );
    } catch (error: any) {
        console.error("Bubble scan retry error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to retry scan");
    }
};

/**
 * PUT /api/v1/bubble-scan/:id/edit
 * Patient edits a scan entry's answers (only submissionType: "scan" allowed)
 */
export const editBubbleScan = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const scanId = req.params.id as string;
        const { answers } = req.body;

        if (!answers || typeof answers !== "object") {
            sendError(res, 400, "answers (object) is required");
            return;
        }

        const result = await bubbleScanService.editScanEntry(scanId, patientId, answers);

        logActivity({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "SCAN_ENTRY_EDITED",
            details: { scanId, editedFields: Object.keys(answers) },
        });

        sendResponse(res, 200, "Scan entry updated successfully", result);
    } catch (error: any) {
        console.error("Edit scan entry error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to edit scan entry");
    }
};

/**
 * PUT /api/v1/bubble-scan/:id/review
 * Doctor reviews and optionally overrides bubble scan results
 */
export const reviewBubbleScan = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const doctorId = req.user?.id;
        if (!doctorId) {
            sendError(res, 401, "Authentication required");
            return;
        }

        const { doctorNotes, flagged, overrides, questionMarks } = req.body;
        const result = await bubbleScanService.reviewBubbleScan(
            req.params.id as string,
            doctorId,
            { doctorNotes, flagged, overrides, questionMarks }
        );

        logActivity({
            req,
            userId: doctorId,
            userRole: req.user?.role || "DOCTOR",
            action: "BUBBLE_SCAN_REVIEWED",
            details: { scanId: req.params.id, flagged },
        });

        sendResponse(res, 200, "Bubble scan reviewed successfully", result);
    } catch (error: any) {
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message);
    }
};

/**
 * GET /api/v1/bubble-scan/doctor/all
 * Doctor/Assistant gets all bubble scans for their patients
 */
export const getAllBubbleScans = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            sendError(res, 401, "Authentication required");
            return;
        }

        const {
            page,
            limit,
            templateName,
            processingStatus,
            patientId,
            startDate,
            endDate,
            reviewed,
            flagged,
        } = req.query;

        const result = await bubbleScanService.getAllBubbleScans(
            userId,
            role,
            {
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                templateName: templateName as string,
                processingStatus: processingStatus as string,
                patientId: patientId as string,
                startDate: startDate
                    ? new Date(startDate as string)
                    : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                reviewed:
                    reviewed !== undefined
                        ? reviewed === "true"
                        : undefined,
                flagged:
                    flagged !== undefined ? flagged === "true" : undefined,
            }
        );
        sendResponse(
            res,
            200,
            "Bubble scans retrieved successfully",
            result
        );
    } catch (error: any) {
        console.error("Get all bubble scans error:", error);
        sendError(res, 500, error.message || "Failed to get bubble scans");
    }
};

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
export const getDiaryFilteredPatients = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId || !role) {
            sendError(res, 401, "Authentication required");
            return;
        }

        const { pageNumber, questionId, filter } = req.query;

        if (!pageNumber || isNaN(Number(pageNumber))) {
            sendError(res, 400, "pageNumber (number) is required");
            return;
        }

        if (filter && !["submitted", "not_submitted", "all"].includes(filter as string)) {
            sendError(res, 400, "filter must be one of: submitted, not_submitted, all");
            return;
        }

        const result = await bubbleScanService.getDiaryFilteredPatients(userId, role, {
            pageNumber: Number(pageNumber),
            questionId: questionId as string | undefined,
            filter: filter as "submitted" | "not_submitted" | "all" | undefined,
        });

        sendResponse(res, 200, "Diary filter results retrieved", result);
    } catch (error: any) {
        console.error("Diary filter error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to get diary filter results");
    }
};

/**
 * POST /api/v1/bubble-scan/:id/reports
 * Patient attaches report files (PDF / images) to an existing scan or manual entry.
 * Accepts up to 5 files via multipart field name "reports".
 */
export const attachReportFiles = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const scanId = req.params.id as string;
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
            sendError(res, 400, "At least one report file is required");
            return;
        }

        const result = await bubbleScanService.attachReports(scanId, patientId, files);

        logActivity({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "REPORT_FILES_ATTACHED",
            details: { scanId, fileCount: files.length },
        });

        sendResponse(res, 200, "Reports attached successfully", result);
    } catch (error: any) {
        console.error("Attach reports error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to attach report files");
    }
};

/**
 * DELETE /api/v1/bubble-scan/:id/reports
 * Patient removes a previously attached report from a scan entry.
 * Body: { reportUrl: string }
 */
export const removeReportFile = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const scanId = req.params.id as string;
        const { reportUrl } = req.body;

        if (!reportUrl || typeof reportUrl !== "string") {
            sendError(res, 400, "reportUrl (string) is required");
            return;
        }

        const result = await bubbleScanService.removeReport(scanId, patientId, reportUrl);

        logActivity({
            req,
            userId: patientId,
            userRole: "PATIENT",
            action: "REPORT_FILE_REMOVED",
            details: { scanId, reportUrl },
        });

        sendResponse(res, 200, "Report removed successfully", result);
    } catch (error: any) {
        console.error("Remove report error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to remove report file");
    }
};

/**
 * POST /api/v1/bubble-scan/doctor/fill-report
 * Doctor manually creates or updates an investigation report for a patient.
 * Used for pages with layoutType "investigation_summary" (pages 05 & 06).
 */
export const doctorFillReport = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const doctorId = req.user?.id;
        if (!doctorId) {
            sendError(res, 401, "Authentication required");
            return;
        }

        const { patientId, pageNumber, questionMarks, doctorNotes } = req.body;

        if (!patientId || typeof patientId !== "string") {
            sendError(res, 400, "patientId is required");
            return;
        }
        if (!pageNumber || typeof pageNumber !== "number") {
            sendError(res, 400, "pageNumber (number) is required");
            return;
        }
        if (!questionMarks || typeof questionMarks !== "object") {
            sendError(res, 400, "questionMarks (object) is required");
            return;
        }

        const result = await bubbleScanService.doctorFillReport(
            patientId,
            doctorId,
            pageNumber,
            questionMarks,
            doctorNotes
        );

        logActivity({
            req,
            userId: doctorId,
            userRole: req.user?.role || "DOCTOR",
            action: "DOCTOR_FILL_REPORT",
            details: { patientId, pageNumber },
        });

        sendResponse(res, 200, "Investigation report saved successfully", result);
    } catch (error: any) {
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to save report");
    }
};
