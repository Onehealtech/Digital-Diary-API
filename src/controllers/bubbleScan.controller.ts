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

        const { doctorNotes, flagged, overrides } = req.body;
        const result = await bubbleScanService.reviewBubbleScan(
            req.params.id as string,
            doctorId,
            { doctorNotes, flagged, overrides }
        );

        logActivity({
            req,
            userId: doctorId,
            userRole: "DOCTOR",
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
