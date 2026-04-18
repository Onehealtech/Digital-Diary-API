import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import { patientAuthCheck, authCheck } from "../middleware/authMiddleware";
import { requireApprovedDiary } from "../middleware/diaryApproval.middleware";
import { requirePermission } from "../middleware/permissionMiddleware";
import { visionScanUpload, reportUpload } from "../middleware/upload.middleware";
import { UserRole } from "../utils/constants";
import * as bubbleScanController from "../controllers/bubbleScan.controller";

/**
 * Wraps a multer middleware and converts upload errors into 400 responses.
 * Without this wrapper, multer errors (e.g. "Unexpected end of form" caused by a
 * missing boundary in the client's Content-Type header) propagate to the global
 * 500 error handler instead of returning a useful client error.
 */
function withMulterErrors(multerMiddleware: (req: Request, res: Response, cb: (err?: any) => void) => void) {
    return (req: Request, res: Response, next: NextFunction) => {
        multerMiddleware(req, res, (err?: any) => {
            if (!err) return next();

            // Missing boundary / truncated body — client sent Content-Type without boundary,
            // or manually set Content-Type: multipart/form-data (stripping the boundary).
            if (err.message === "Unexpected end of form") {
                res.status(400).json({
                    success: false,
                    message: "Invalid file upload: multipart form is malformed. " +
                        "Do NOT manually set Content-Type — let your HTTP library set it automatically so the boundary is included.",
                });
                return;
            }

            if (err instanceof multer.MulterError) {
                res.status(400).json({ success: false, message: err.message });
                return;
            }

            next(err);
        });
    };
}

const router = express.Router();

// === Patient Routes (require patient authentication) ===

// Manual diary answer submission (for non-scan mode)
// Accepts multipart/form-data so report files can be included in the same request.
// Fields: pageNumber (text), answers (JSON text), questionId[] (text), reports[] (files)
router.post(
    "/manual",
    patientAuthCheck,
    requireApprovedDiary,
    reportUpload.array("reports", 10),
    bubbleScanController.manualSubmitBubbleScan
);

// Upload diary page photo for AI vision scanning (replaces Python OMR)
router.post(
    "/upload",
    patientAuthCheck,
    requireApprovedDiary,
    withMulterErrors(visionScanUpload.single("image")),
    bubbleScanController.uploadBubbleScan
);

// Get patient's bubble scan history
router.get(
    "/history",
    patientAuthCheck,
    requireApprovedDiary,
    bubbleScanController.getBubbleScanHistory
);

// Get available diary pages (replaces old Python templates list)
router.get(
    "/templates",
    patientAuthCheck,
    requireApprovedDiary,
    bubbleScanController.getAvailableTemplates
);

// Get single bubble scan result
router.get(
    "/:id",
    patientAuthCheck,
    requireApprovedDiary,
    bubbleScanController.getBubbleScanById
);

// Edit a scan entry's answers (only scan-type submissions)
router.put(
    "/:id/edit",
    patientAuthCheck,
    requireApprovedDiary,
    bubbleScanController.editBubbleScan
);

// Retry a failed scan
router.post(
    "/:id/retry",
    patientAuthCheck,
    requireApprovedDiary,
    bubbleScanController.retryBubbleScan
);

// Attach report files (PDF / images) to an existing scan or manual entry
router.post(
    "/:id/reports",
    patientAuthCheck,
    requireApprovedDiary,
    reportUpload.array("reports", 5),
    bubbleScanController.attachReportFiles
);

// Remove a previously attached report file
router.delete(
    "/:id/reports",
    patientAuthCheck,
    requireApprovedDiary,
    bubbleScanController.removeReportFile
);

// Attach report files to a specific question (PDF, DOC, DOCX, images — max 5 files, 25 MB each)
// multipart fields: questionId (text) + reports (files)
router.post(
    "/:id/question-reports",
    patientAuthCheck,
    requireApprovedDiary,
    reportUpload.array("reports", 5),
    bubbleScanController.attachQuestionReportFiles
);

// Remove a specific report from a question
// Body: { questionId, reportUrl }
router.delete(
    "/:id/question-reports",
    patientAuthCheck,
    requireApprovedDiary,
    bubbleScanController.removeQuestionReportFile
);

// === Doctor/Assistant Routes ===

// Get all bubble scans for doctor's patients
router.get(
    "/",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    bubbleScanController.getAllBubbleScans
);

// Doctor/Assistant reviews and optionally overrides bubble scan results
router.put(
    "/:id/review",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    requirePermission('markReviewed'),
    bubbleScanController.reviewBubbleScan
);

// Doctor dashboard: filter patients by diary page submission status
router.get(
    "/doctor/diary-filter",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    bubbleScanController.getDiaryFilteredPatients
);

// Doctor manually fills / pre-fills an investigation report for a patient
// Assistants need the 'fillReport' permission granted by the doctor
router.post(
    "/doctor/fill-report",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    requirePermission('fillReport'),
    bubbleScanController.doctorFillReport
);

export default router;
