import express from "express";
import * as scanController from "../controllers/scan.controller";
import { patientAuthCheck } from "../middleware/authMiddleware";
import { requireApprovedDiary } from "../middleware/diaryApproval.middleware";
import { upload } from "../middleware/upload.middleware";

const router = express.Router();

// Patient routes (require patient authentication)
// upload.single('image') allows an optional diary photo to be uploaded with the scan
router.post("/submit", patientAuthCheck, requireApprovedDiary, upload.single("image"), scanController.submitScan);
router.get("/history", patientAuthCheck, requireApprovedDiary, scanController.getScanHistory);
router.get("/history-admin/:patientId", scanController.getScanHistoryAdmin);

export default router;
