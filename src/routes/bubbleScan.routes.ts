import express from "express";
import { patientAuthCheck, authCheck } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";
import { visionScanUpload, reportUpload } from "../middleware/upload.middleware";
import { UserRole } from "../utils/constants";
import * as bubbleScanController from "../controllers/bubbleScan.controller";

const router = express.Router();

// === Patient Routes (require patient authentication) ===

// Manual diary answer submission (for non-scan mode)
router.post(
    "/manual",
    patientAuthCheck,
    bubbleScanController.manualSubmitBubbleScan
);

// Upload diary page photo for AI vision scanning (replaces Python OMR)
router.post(
    "/upload",
    patientAuthCheck,
    visionScanUpload.single("image"),
    bubbleScanController.uploadBubbleScan
);

// Get patient's bubble scan history
router.get(
    "/history",
    patientAuthCheck,
    bubbleScanController.getBubbleScanHistory
);

// Get available diary pages (replaces old Python templates list)
router.get(
    "/templates",
    patientAuthCheck,
    bubbleScanController.getAvailableTemplates
);

// Get single bubble scan result
router.get(
    "/:id",
    patientAuthCheck,
    bubbleScanController.getBubbleScanById
);

// Edit a scan entry's answers (only scan-type submissions)
router.put(
    "/:id/edit",
    patientAuthCheck,
    bubbleScanController.editBubbleScan
);

// Retry a failed scan
router.post(
    "/:id/retry",
    patientAuthCheck,
    bubbleScanController.retryBubbleScan
);

// Attach report files (PDF / images) to an existing scan or manual entry
router.post(
    "/:id/reports",
    patientAuthCheck,
    reportUpload.array("reports", 5),
    bubbleScanController.attachReportFiles
);

// Remove a previously attached report file
router.delete(
    "/:id/reports",
    patientAuthCheck,
    bubbleScanController.removeReportFile
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
router.post(
    "/doctor/fill-report",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    bubbleScanController.doctorFillReport
);

export default router;
