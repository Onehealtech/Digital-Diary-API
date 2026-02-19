import express from "express";
import * as scanController from "../controllers/scan.controller";
import { patientAuthCheck } from "../middleware/authMiddleware";
import { upload } from "../middleware/upload.middleware";

const router = express.Router();

// Patient routes (require patient authentication)
router.post("/submit", patientAuthCheck, scanController.submitScan);
router.get("/history", patientAuthCheck, scanController.getScanHistory);

// Patient uploads diary page image → OCR processing → store structured data
router.post(
    "/upload-and-process",
    patientAuthCheck,
    upload.single("image"),
    scanController.uploadAndProcessScan
);

export default router;
