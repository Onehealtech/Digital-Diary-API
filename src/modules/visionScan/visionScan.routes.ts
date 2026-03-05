import express from "express";
import { patientAuthCheck, authCheck } from "../../middleware/authMiddleware";
import { bubbleScanUpload } from "../../middleware/upload.middleware";
import { validate } from "../../middleware/validate.middleware";
import { UserRole } from "../../utils/constants";
import * as ctrl from "./visionScan.controller";
import {
    uploadScanSchema,
    manualSubmitSchema,
    scanIdParamSchema,
    reviewScanSchema,
    paginationQuerySchema,
    allScansQuerySchema,
} from "./visionScan.schemas";

const router = express.Router();

// === Patient Routes ===

router.post(
    "/manual",
    patientAuthCheck,
    validate({ body: manualSubmitSchema }),
    ctrl.manualSubmitVisionScan
);

router.post(
    "/upload",
    patientAuthCheck,
    bubbleScanUpload.single("image"),
    validate({ body: uploadScanSchema }),
    ctrl.uploadVisionScan
);

router.get(
    "/history",
    patientAuthCheck,
    validate({ query: paginationQuerySchema }),
    ctrl.getVisionScanHistory
);

router.get(
    "/:id",
    patientAuthCheck,
    validate({ params: scanIdParamSchema }),
    ctrl.getVisionScanById
);

router.post(
    "/:id/retry",
    patientAuthCheck,
    validate({ params: scanIdParamSchema }),
    ctrl.retryVisionScan
);

// === Doctor/Assistant Routes ===

router.get(
    "/",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    validate({ query: allScansQuerySchema }),
    ctrl.getAllVisionScans
);

router.put(
    "/:id/review",
    authCheck([UserRole.DOCTOR]),
    validate({ params: scanIdParamSchema, body: reviewScanSchema }),
    ctrl.reviewVisionScan
);

export default router;
