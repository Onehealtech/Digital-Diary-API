import { Response } from "express";
import { ScanLog } from "../models/ScanLog";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

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

        // Validate that scanData is an object
        if (typeof scanData !== "object") {
            res.status(400).json({
                success: false,
                message: "Scan data must be a valid JSON object",
            });
            return;
        }

        // Get patient ID from authenticated user
        const patientId = req.user!.id;

        // Create scan log entry
        const scanLog = await ScanLog.create({
            patientId,
            pageId,
            scanData,
            scannedAt: new Date(),
        });

        // Update patient's lastActive timestamp (using updatedAt)
        await Patient.update(
            { updatedAt: new Date() },
            { where: { id: patientId } }
        );

        res.status(201).json({
            success: true,
            message: "Scan submitted successfully",
            data: {
                id: scanLog.id,
                pageId: scanLog.pageId,
                scannedAt: scanLog.scannedAt,
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
