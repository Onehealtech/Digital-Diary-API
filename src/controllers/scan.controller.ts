import { Response } from "express";
import { ScanLog } from "../models/ScanLog";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { scanService } from "../service/scan.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";

/**
 * POST /api/v1/scan/submit
 * Patient submits scan data from daily diary page
 */
export const submitScan = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { pageId, scanData } = req.body;

        // Validate required fields
        if (!pageId || !scanData) {
            res.status(400).json({
                success: false,
                message: "Page ID and scan data are required",
            });
            return;
        }

        // Parse scanData if it came as a JSON string (multipart form submissions)
        let parsedScanData = scanData;
        if (typeof scanData === "string") {
            try {
                parsedScanData = JSON.parse(scanData);
            } catch {
                res.status(400).json({
                    success: false,
                    message: "Scan data must be a valid JSON object or JSON string",
                });
                return;
            }
        }

        // Validate that parsedScanData is an object
        if (typeof parsedScanData !== "object") {
            res.status(400).json({
                success: false,
                message: "Scan data must be a valid JSON object",
            });
            return;
        }

        // Build imageUrl if a file was uploaded (stored in /uploads directory, served as static)
        const imageUrl = req.file
            ? `/uploads/${req.file.filename}`
            : undefined;

        // Get patient ID from authenticated user
        const patientId = req.user!.id;

        // Check if scan with same patientId + pageId already exists
        const existingScan = await ScanLog.findOne({
            where: { patientId, pageId },
        });

        let scanLog;

        if (existingScan) {
            // Update existing scan
            existingScan.scanData = parsedScanData;
            existingScan.isUpdated = true;
            existingScan.updatedCount = existingScan.updatedCount + 1;
            existingScan.scannedAt = new Date();
            // Update imageUrl only if a new image was provided
            if (imageUrl) {
                existingScan.imageUrl = imageUrl;
            }
            await existingScan.save();
            scanLog = existingScan;
        } else {
            // Create new scan log entry
            scanLog = await ScanLog.create({
                patientId,
                pageId,
                scanData: parsedScanData,
                scannedAt: new Date(),
                isUpdated: false,
                updatedCount: 0,
                imageUrl: imageUrl || null,
            });
        }

        // Update patient's lastActive timestamp (using updatedAt)
        await Patient.update(
            { updatedAt: new Date() },
            { where: { id: patientId } }
        );

        res.status(existingScan ? 200 : 201).json({
            success: true,
            message: existingScan
                ? "Scan updated successfully"
                : "Scan submitted successfully",
            data: {
                id: scanLog.id,
                pageId: scanLog.pageId,
                scannedAt: scanLog.scannedAt,
                isUpdated: scanLog.isUpdated,
                updatedCount: scanLog.updatedCount,
                imageUrl: scanLog.imageUrl || null,
            },
        });
    } catch (error: any) {
        console.error("Submit scan error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to submit scan",
        });
    }
};

/**
 * GET /api/v1/scan/history
 * Get scan history for authenticated patient
 */
export const getScanHistory = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const patientId = req.user!.id;

        const { rows: scans, count: total } = await ScanLog.findAndCountAll({
            where: { patientId },
            limit: Number(limit),
            offset,
            order: [["scannedAt", "DESC"]],
        });

        res.status(200).json({
            success: true,
            message: "Scan history retrieved successfully",
            data: {
                scans,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            },
        });
    } catch (error: any) {
        console.error("Get scan history error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve scan history",
        });
    }
};

/**
 * GET /api/v1/diary-entries
 * Get all diary entries for doctor/assistant to review
 */
export const getAllDiaryEntries = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const requesterId = req.user?.id;
        const role = req.user?.role;

        if (!requesterId || !role) {
            sendError(res, "Unauthorized", 401);
            return;
        }

        const {
            page,
            limit,
            pageType,
            reviewed,
            flagged,
            patientId,
            startDate,
            endDate,
        } = req.query;

        const result = await scanService.getAllDiaryEntries(
            requesterId,
            role,
            {
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                pageType: pageType as string,
                reviewed: reviewed === "true" ? true : reviewed === "false" ? false : undefined,
                flagged: flagged === "true" ? true : flagged === "false" ? false : undefined,
                patientId: patientId as string,
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
            }
        );

        sendResponse(res, result, "Diary entries fetched successfully");
    } catch (error: any) {
        sendError(res, error.message);
    }
};

/**
 * GET /api/v1/diary-entries/:id
 * Get single diary entry by ID
 */
export const getDiaryEntryById = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const id = req.params.id as string;
        const requesterId = req.user?.id;
        const role = req.user?.role;

        if (!requesterId || !role) {
            sendError(res, "Unauthorized", 401);
            return;
        }

        const entry = await scanService.getDiaryEntryById(id, requesterId, role);

        sendResponse(res, entry, "Diary entry fetched successfully");
    } catch (error: any) {
        sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};

/**
 * PUT /api/v1/diary-entries/:id/review
 * Mark diary entry as reviewed by doctor
 */
export const reviewDiaryEntry = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const id = req.params.id as string;
        const doctorId = req.user?.id as string;
        const role = req.user?.role;

        if (!doctorId || role !== "DOCTOR") {
            sendError(res, "Only doctors can review diary entries", 403);
            return;
        }

        const { doctorNotes, flagged } = req.body;

        const entry = await scanService.reviewDiaryEntry(id, doctorId, {
            doctorNotes,
            flagged,
        });

        sendResponse(res, entry, "Diary entry reviewed successfully");
    } catch (error: any) {
        sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};

/**
 * PUT /api/v1/diary-entries/:id/flag
 * Flag/unflag a diary entry
 */
export const toggleFlag = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const id = req.params.id as string;
        const doctorId = req.user?.id as string;
        const role = req.user?.role;

        if (!doctorId || role !== "DOCTOR") {
            sendError(res, "Only doctors can flag diary entries", 403);
            return;
        }

        const { flagged } = req.body;

        if (flagged === undefined) {
            sendError(res, "flagged field is required", 400);
            return;
        }

        const entry = await scanService.toggleFlag(id, doctorId, flagged);

        sendResponse(res, entry, `Diary entry ${flagged ? "flagged" : "unflagged"} successfully`);
    } catch (error: any) {
        sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};

/**
 * GET /api/v1/diary-entries/review/pending
 * Get diary entries that need review
 */
export const getEntriesNeedingReview = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const doctorId = req.user?.id;
        const role = req.user?.role;

        if (!doctorId || role !== "DOCTOR") {
            sendError(res, "Only doctors can view pending reviews", 403);
            return;
        }

        const entries = await scanService.getEntriesNeedingReview(doctorId);

        sendResponse(res, entries, "Pending reviews fetched successfully");
    } catch (error: any) {
        sendError(res, error.message);
    }
};

/**
 * GET /api/v1/diary-entries/stats
 * Get diary entry statistics for a doctor
 */
export const getDiaryEntryStats = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const doctorId = req.user?.id;
        const role = req.user?.role;

        if (!doctorId || role !== "DOCTOR") {
            sendError(res, "Only doctors can view diary stats", 403);
            return;
        }

        const stats = await scanService.getDiaryEntryStats(doctorId);

        sendResponse(res, stats, "Diary stats fetched successfully");
    } catch (error: any) {
        sendError(res, error.message);
    }
};
