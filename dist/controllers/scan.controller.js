"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiaryEntryStats = exports.getEntriesNeedingReview = exports.toggleFlag = exports.reviewDiaryEntry = exports.getDiaryEntryById = exports.getAllDiaryEntries = exports.getScanHistoryAdmin = exports.getScanHistory = exports.submitScan = void 0;
const ScanLog_1 = require("../models/ScanLog");
const Patient_1 = require("../models/Patient");
const scan_service_1 = require("../service/scan.service");
const response_1 = require("../utils/response");
const activityLogger_1 = require("../utils/activityLogger");
const BubbleScanResult_1 = require("../models/BubbleScanResult");
const DiaryPage_1 = require("../models/DiaryPage");
/**
 * POST /api/v1/scan/submit
 * Patient submits scan data from daily diary page
 */
// export const submitScan = async (
//     req: AuthenticatedRequest,
//     res: Response
// ): Promise<void> => {
//     try {
//         const { pageId, scanData } = req.body;
//         console.log(pageId, scanData,"pageId, scanData");
//         // Validate required fields
//         if (!pageId || !scanData) {
//             res.status(400).json({
//                 success: false,
//                 message: "Page ID and scan data are required",
//             });
//             return;
//         }
//         // Parse scanData if it came as a JSON string (multipart form submissions)
//         let parsedScanData = scanData;
//         if (typeof scanData === "string") {
//             try {
//                 parsedScanData = JSON.parse(scanData);
//             } catch {
//                 res.status(400).json({
//                     success: false,
//                     message: "Scan data must be a valid JSON object or JSON string",
//                 });
//                 return;
//             }
//         }
//         // Validate that parsedScanData is an object
//         if (typeof parsedScanData !== "object") {
//             res.status(400).json({
//                 success: false,
//                 message: "Scan data must be a valid JSON object",
//             });
//             return;
//         }
//         // Build imageUrl if a file was uploaded (stored in /uploads directory, served as static)
//         const imageUrl = req.file
//             ? `/uploads/${req.file.filename}`
//             : undefined;
//         // Get patient ID from authenticated user
//         const patientId = req.user!.id;
//         // Check if scan with same patientId + pageId already exists
//         const existingScan = await ScanLog.findOne({
//             where: { patientId, pageId },
//         });
//         let scanLog;
//         if (existingScan) {
//             // Update existing scan
//             existingScan.scanData = parsedScanData;
//             existingScan.isUpdated = true;
//             existingScan.updatedCount = existingScan.updatedCount + 1;
//             existingScan.scannedAt = new Date();
//             // Update imageUrl only if a new image was provided
//             if (imageUrl) {
//                 existingScan.imageUrl = imageUrl;
//             }
//             await existingScan.save();
//             scanLog = existingScan;
//         } else {
//             // Create new scan log entry
//             scanLog = await ScanLog.create({
//                 patientId,
//                 pageId,
//                 scanData: parsedScanData,
//                 scannedAt: new Date(),
//                 isUpdated: false,
//                 updatedCount: 0,
//                 imageUrl: imageUrl || null,
//             });
//         }
//         // Update patient's lastActive timestamp (using updatedAt)
//         await Patient.update(
//             { updatedAt: new Date() },
//             { where: { id: patientId } }
//         );
//         logActivity({
//             req,
//             userId: patientId,
//             userRole: "PATIENT",
//             action: "DIARY_SCAN_SUBMITTED",
//             details: { patientId, pageId, scanLogId: scanLog.id, isUpdate: !!existingScan },
//         });
//         res.status(existingScan ? 200 : 201).json({
//             success: true,
//             message: existingScan
//                 ? "Scan updated successfully"
//                 : "Scan submitted successfully",
//             data: {
//                 id: scanLog.id,
//                 pageId: scanLog.pageId,
//                 scannedAt: scanLog.scannedAt,
//                 isUpdated: scanLog.isUpdated,
//                 updatedCount: scanLog.updatedCount,
//                 imageUrl: scanLog.imageUrl || null,
//             },
//         });
//     } catch (error: any) {
//         console.error("Submit scan error:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message || "Failed to submit scan",
//         });
//     }
// };
const submitScan = async (req, res) => {
    try {
        const { pageId, scanData } = req.body;
        console.log(pageId, scanData, "pageId, scanData");
        if (!pageId || !scanData) {
            res.status(400).json({
                success: false,
                message: "Page ID and scan data are required",
            });
            return;
        }
        let parsedScanData = scanData;
        if (typeof scanData === "string") {
            try {
                parsedScanData = JSON.parse(scanData);
            }
            catch {
                res.status(400).json({
                    success: false,
                    message: "Scan data must be valid JSON",
                });
                return;
            }
        }
        const patientId = req.user.id;
        // Extract page number from backend_page_12
        const pageNumber = Number(pageId.replace("backend_page_", ""));
        // ---------------- FETCH DIARY PAGE ----------------
        const diaryPage = await DiaryPage_1.DiaryPage.findOne({
            where: { pageNumber, isActive: true },
        });
        if (!diaryPage) {
            res.status(404).json({
                success: false,
                message: `Diary page ${pageNumber} not found`,
            });
            return;
        }
        // ---------------- ENRICH ANSWERS ----------------
        const enrichedResults = {};
        for (const [qId, answer] of Object.entries(parsedScanData)) {
            const questionDef = diaryPage.questions.find((q) => q.id === qId);
            enrichedResults[qId] = {
                answer,
                confidence: 1.0,
                questionText: questionDef?.text || "Unknown question",
                category: questionDef?.category || "uncategorized",
            };
        }
        // ---------------- SAVE TO bubble_scan_results ----------------
        await BubbleScanResult_1.BubbleScanResult.create({
            patientId,
            pageId: `page-${pageNumber}`,
            pageNumber,
            diaryPageId: diaryPage.id,
            submissionType: "manual",
            processingStatus: "completed",
            scanResults: enrichedResults,
            scannedAt: new Date(),
        });
        // ---------------- IMAGE ----------------
        const imageUrl = req.file
            ? `/uploads/${req.file.filename}`
            : undefined;
        // ---------------- SCAN LOG ----------------
        const existingScan = await ScanLog_1.ScanLog.findOne({
            where: { patientId, pageId },
        });
        let scanLog;
        if (existingScan) {
            existingScan.scanData = parsedScanData;
            existingScan.isUpdated = true;
            existingScan.updatedCount += 1;
            existingScan.scannedAt = new Date();
            if (imageUrl)
                existingScan.imageUrl = imageUrl;
            await existingScan.save();
            scanLog = existingScan;
        }
        else {
            scanLog = await ScanLog_1.ScanLog.create({
                patientId,
                pageId,
                scanData: parsedScanData,
                scannedAt: new Date(),
                isUpdated: false,
                updatedCount: 0,
                imageUrl: imageUrl || null,
            });
        }
        await Patient_1.Patient.update({ updatedAt: new Date() }, { where: { id: patientId } });
        res.status(existingScan ? 200 : 201).json({
            success: true,
            message: existingScan
                ? "Scan updated successfully"
                : "Scan submitted successfully",
            data: scanLog,
        });
    }
    catch (error) {
        console.error("Submit scan error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to submit scan",
        });
    }
};
exports.submitScan = submitScan;
/**
 * GET /api/v1/scan/history
 * Get scan history for authenticated patient
 */
const getScanHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const patientId = req.user.id;
        const { rows: scans, count: total } = await ScanLog_1.ScanLog.findAndCountAll({
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
    }
    catch (error) {
        console.error("Get scan history error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve scan history",
        });
    }
};
exports.getScanHistory = getScanHistory;
const getScanHistoryAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const patientId = req.params.patientId;
        const { rows: scans, count: total } = await ScanLog_1.ScanLog.findAndCountAll({
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
    }
    catch (error) {
        console.error("Get scan history error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve scan history",
        });
    }
};
exports.getScanHistoryAdmin = getScanHistoryAdmin;
/**
 * GET /api/v1/diary-entries
 * Get all diary entries for doctor/assistant to review
 */
const getAllDiaryEntries = async (req, res) => {
    try {
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !role) {
            (0, response_1.sendError)(res, "Unauthorized", 401);
            return;
        }
        const { page, limit, pageType, reviewed, flagged, patientId, startDate, endDate, } = req.query;
        const result = await scan_service_1.scanService.getAllDiaryEntries(requesterId, role, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            pageType: pageType,
            reviewed: reviewed === "true" ? true : reviewed === "false" ? false : undefined,
            flagged: flagged === "true" ? true : flagged === "false" ? false : undefined,
            patientId: patientId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
        (0, response_1.sendResponse)(res, result, "Diary entries fetched successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message);
    }
};
exports.getAllDiaryEntries = getAllDiaryEntries;
/**
 * GET /api/v1/diary-entries/:id
 * Get single diary entry by ID
 */
const getDiaryEntryById = async (req, res) => {
    try {
        const id = req.params.id;
        const requesterId = req.user?.id;
        const role = req.user?.role;
        if (!requesterId || !role) {
            (0, response_1.sendError)(res, "Unauthorized", 401);
            return;
        }
        const entry = await scan_service_1.scanService.getDiaryEntryById(id, requesterId, role);
        (0, response_1.sendResponse)(res, entry, "Diary entry fetched successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};
exports.getDiaryEntryById = getDiaryEntryById;
/**
 * PUT /api/v1/diary-entries/:id/review
 * Mark diary entry as reviewed by doctor
 */
const reviewDiaryEntry = async (req, res) => {
    try {
        const id = req.params.id;
        const doctorId = req.user?.id;
        const role = req.user?.role;
        if (!doctorId || role !== "DOCTOR") {
            (0, response_1.sendError)(res, "Only doctors can review diary entries", 403);
            return;
        }
        const { doctorNotes, flagged } = req.body;
        const entry = await scan_service_1.scanService.reviewDiaryEntry(id, doctorId, {
            doctorNotes,
            flagged,
        });
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: "DOCTOR",
            action: "DIARY_ENTRY_REVIEWED",
            details: { diaryEntryId: id, flagged },
        });
        (0, response_1.sendResponse)(res, entry, "Diary entry reviewed successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};
exports.reviewDiaryEntry = reviewDiaryEntry;
/**
 * PUT /api/v1/diary-entries/:id/flag
 * Flag/unflag a diary entry
 */
const toggleFlag = async (req, res) => {
    try {
        const id = req.params.id;
        const doctorId = req.user?.id;
        const role = req.user?.role;
        if (!doctorId || role !== "DOCTOR") {
            (0, response_1.sendError)(res, "Only doctors can flag diary entries", 403);
            return;
        }
        const { flagged } = req.body;
        if (flagged === undefined) {
            (0, response_1.sendError)(res, "flagged field is required", 400);
            return;
        }
        const entry = await scan_service_1.scanService.toggleFlag(id, doctorId, flagged);
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: "DOCTOR",
            action: "DIARY_ENTRY_FLAGGED",
            details: { diaryEntryId: id, flagged },
        });
        (0, response_1.sendResponse)(res, entry, `Diary entry ${flagged ? "flagged" : "unflagged"} successfully`);
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
};
exports.toggleFlag = toggleFlag;
/**
 * GET /api/v1/diary-entries/review/pending
 * Get diary entries that need review
 */
const getEntriesNeedingReview = async (req, res) => {
    try {
        const doctorId = req.user?.id;
        const role = req.user?.role;
        if (!doctorId || role !== "DOCTOR") {
            (0, response_1.sendError)(res, "Only doctors can view pending reviews", 403);
            return;
        }
        const entries = await scan_service_1.scanService.getEntriesNeedingReview(doctorId);
        (0, response_1.sendResponse)(res, entries, "Pending reviews fetched successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message);
    }
};
exports.getEntriesNeedingReview = getEntriesNeedingReview;
/**
 * GET /api/v1/diary-entries/stats
 * Get diary entry statistics for a doctor
 */
const getDiaryEntryStats = async (req, res) => {
    try {
        const doctorId = req.user?.id;
        const role = req.user?.role;
        if (!doctorId || role !== "DOCTOR") {
            (0, response_1.sendError)(res, "Only doctors can view diary stats", 403);
            return;
        }
        const stats = await scan_service_1.scanService.getDiaryEntryStats(doctorId);
        (0, response_1.sendResponse)(res, stats, "Diary stats fetched successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message);
    }
};
exports.getDiaryEntryStats = getDiaryEntryStats;
