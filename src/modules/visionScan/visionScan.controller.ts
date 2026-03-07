import { Response } from "express";
import {
    AuthenticatedRequest,
    AuthRequest,
} from "../../middleware/authMiddleware";
import { visionScanService } from "./visionScan.service";
import { sendResponse, sendError } from "../../utils/response";
import { getDiaryTypeForCaseType } from "../../utils/constants";
import { AppError } from "../../utils/AppError";

export const uploadVisionScan = async (
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
            pageNumber ?? undefined,
            req.file.buffer,
            req.file.mimetype,
            diaryType
        );

        if ("valid" in result) {
            sendError(res, 400, result.reason);
            return;
        }

        sendResponse(
            res,
            202,
            "Scan accepted and queued for processing",
            result
        );
    } catch (error: any) {
        console.error("Vision scan upload error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to process vision scan");
    }
};

export const manualSubmitVisionScan = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const { pageNumber, answers } = req.body;
        const diaryType = getDiaryTypeForCaseType(req.user?.caseType);

        const result = await visionScanService.manualSubmit(
            patientId,
            pageNumber,
            answers,
            diaryType
        );

        sendResponse(res, 201, "Manual submission saved successfully", result);
    } catch (error: any) {
        console.error("Manual submit error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to save manual submission");
    }
};

export const getVisionScanHistory = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const patientId = req.user!.id;
        const { page, limit } = req.query as any;
        const result = await visionScanService.getPatientScanHistory(
            patientId,
            page,
            limit
        );
        sendResponse(res, 200, "Scan history retrieved successfully", result);
    } catch (error: any) {
        console.error("Scan history error:", error);
        sendError(res, 500, error.message || "Failed to get scan history");
    }
};

export const getVisionScanById = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const result = await visionScanService.getScanById(req.params.id as string);
        sendResponse(res, 200, "Scan result retrieved", result);
    } catch (error: any) {
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message);
    }
};

export const retryVisionScan = async (
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
        console.error("Scan retry error:", error);
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message || "Failed to retry scan");
    }
};

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
        const status = error instanceof AppError ? error.statusCode : 500;
        sendError(res, status, error.message);
    }
};

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
        } = req.query as any;

        const result = await visionScanService.getAllScans(userId, role, {
            page,
            limit,
            processingStatus,
            patientId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            reviewed,
            flagged,
        });
        sendResponse(res, 200, "Scans retrieved successfully", result);
    } catch (error: any) {
        console.error("Get all scans error:", error);
        sendError(res, 500, error.message || "Failed to get scans");
    }
};
