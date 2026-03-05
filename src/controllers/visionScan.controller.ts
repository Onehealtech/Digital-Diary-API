import { Response } from "express";
import {
    AuthenticatedRequest,
    AuthRequest,
} from "../middleware/authMiddleware";
import { visionScanService } from "../service/visionScan.service";
import { sendResponse, sendError } from "../utils/response";
import { getDiaryTypeForCaseType } from "../utils/constants";

/**
 * POST /api/v1/vision-scan/upload
 * Patient uploads a diary page photo for AI-based extraction
 */
export const uploadVisionScan = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { pageId } = req.body;
        const patientId = req.user!.id;
        const diaryType = getDiaryTypeForCaseType(req.user?.caseType);

        if (!pageId) {
            sendError(res, 400, "pageId is required");
            return;
        }

        if (!req.file) {
            sendError(res, 400, "Image file is required");
            return;
        }

        const imagePath = req.file.path;
        const result = await visionScanService.processScan(
            patientId,
            pageId,
            imagePath,
            diaryType
        );

        const statusCode =
            result.processingStatus === "completed" ? 201 : 200;
        sendResponse(
            res,
            statusCode,
            result.processingStatus === "completed"
                ? "Vision scan processed successfully"
                : "Vision scan processing failed - check errorMessage",
            result
        );
    } catch (error: any) {
        console.error("Vision scan upload error:", error);
        sendError(res, 500, error.message || "Failed to process vision scan");
    }
};

/**
 * POST /api/v1/vision-scan/manual
 * Patient submits diary answers manually (no scan)
 */
export const manualSubmitVisionScan = async (
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

        const result = await visionScanService.manualSubmit(
            patientId,
            pageNumber,
            answers,
            diaryType
        );

        sendResponse(res, 201, "Manual submission saved successfully", result);
    } catch (error: any) {
        console.error("Manual submit error:", error);
        const status = error.message.includes("not found") ? 404 : 500;
        sendError(res, status, error.message || "Failed to save manual submission");
    }
};

/**
 * GET /api/v1/vision-scan/history
 * Patient gets their scan history
 */
export const getVisionScanHistory = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const { page = 1, limit = 20 } = req.query;
        const result = await visionScanService.getPatientScanHistory(
            patientId,
            Number(page),
            Number(limit)
        );
        sendResponse(res, 200, "Scan history retrieved successfully", result);
    } catch (error: any) {
        console.error("Scan history error:", error);
        sendError(res, 500, error.message || "Failed to get scan history");
    }
};

/**
 * GET /api/v1/vision-scan/:id
 * Get single scan result
 */
export const getVisionScanById = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const result = await visionScanService.getScanById(req.params.id as string);
        sendResponse(res, 200, "Scan result retrieved", result);
    } catch (error: any) {
        const status = error.message.includes("not found") ? 404 : 500;
        sendError(res, status, error.message);
    }
};

/**
 * POST /api/v1/vision-scan/:id/retry
 * Retry a failed scan
 */
export const retryVisionScan = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const result = await visionScanService.retryScan(req.params.id as string);
        sendResponse(
            res,
            200,
            result.processingStatus === "completed"
                ? "Scan retry completed successfully"
                : "Scan retry failed - check errorMessage",
            result
        );
    } catch (error: any) {
        console.error("Scan retry error:", error);
        sendError(res, 500, error.message || "Failed to retry scan");
    }
};

/**
 * PUT /api/v1/vision-scan/:id/review
 * Doctor reviews and optionally overrides scan results
 */
export const reviewVisionScan = async (
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
        const result = await visionScanService.reviewScan(
            req.params.id as string,
            doctorId,
            { doctorNotes, flagged, overrides }
        );
        sendResponse(res, 200, "Scan reviewed successfully", result);
    } catch (error: any) {
        const status = error.message.includes("not found") ? 404 : 500;
        sendError(res, status, error.message);
    }
};

/**
 * GET /api/v1/vision-scan/
 * Doctor/Assistant gets all scans for their patients
 */
export const getAllVisionScans = async (
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
            processingStatus,
            patientId,
            startDate,
            endDate,
            reviewed,
            flagged,
        } = req.query;

        const result = await visionScanService.getAllScans(userId, role, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            processingStatus: processingStatus as string,
            patientId: patientId as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            reviewed: reviewed !== undefined ? reviewed === "true" : undefined,
            flagged: flagged !== undefined ? flagged === "true" : undefined,
        });
        sendResponse(res, 200, "Scans retrieved successfully", result);
    } catch (error: any) {
        console.error("Get all scans error:", error);
        sendError(res, 500, error.message || "Failed to get scans");
    }
};
