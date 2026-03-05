import express from "express";
import { patientAuthCheck, authCheck } from "../middleware/authMiddleware";
import { bubbleScanUpload } from "../middleware/upload.middleware";
import { UserRole } from "../utils/constants";
import * as visionScanController from "../controllers/visionScan.controller";

const router = express.Router();

// === Patient Routes ===

// Manual diary answer submission (no scan)
router.post(
    "/manual",
    patientAuthCheck,
    visionScanController.manualSubmitVisionScan
);

// Upload diary page photo for AI vision extraction
router.post(
    "/upload",
    patientAuthCheck,
    bubbleScanUpload.single("image"),
    visionScanController.uploadVisionScan
);

// Get patient's scan history
router.get(
    "/history",
    patientAuthCheck,
    visionScanController.getVisionScanHistory
);

// Get single scan result
router.get(
    "/:id",
    patientAuthCheck,
    visionScanController.getVisionScanById
);

// Retry a failed scan
router.post(
    "/:id/retry",
    patientAuthCheck,
    visionScanController.retryVisionScan
);

// === Doctor/Assistant Routes ===

// Get all scans for doctor's patients
router.get(
    "/",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    visionScanController.getAllVisionScans
);

// Doctor reviews and optionally overrides scan results
router.put(
    "/:id/review",
    authCheck([UserRole.DOCTOR]),
    visionScanController.reviewVisionScan
);

export default router;
