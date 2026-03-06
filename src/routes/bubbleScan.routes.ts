import express from "express";
import { patientAuthCheck, authCheck } from "../middleware/authMiddleware";
import { visionScanUpload } from "../middleware/upload.middleware";
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

// Retry a failed scan
router.post(
    "/:id/retry",
    patientAuthCheck,
    bubbleScanController.retryBubbleScan
);

// === Doctor/Assistant Routes ===

// Get all bubble scans for doctor's patients
router.get(
    "/",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    bubbleScanController.getAllBubbleScans
);

// Doctor reviews and optionally overrides bubble scan results
router.put(
    "/:id/review",
    authCheck([UserRole.DOCTOR]),
    bubbleScanController.reviewBubbleScan
);

export default router;
