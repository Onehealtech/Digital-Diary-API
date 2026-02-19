import express from "express";
import * as scanController from "../controllers/scan.controller";
import { patientAuthCheck } from "../middleware/authMiddleware";
import { upload } from "../middleware/upload.middleware";

const router = express.Router();

// Patient routes (require patient authentication)
// upload.single('image') allows an optional diary photo to be uploaded with the scan
router.post("/submit", patientAuthCheck, upload.single("image"), scanController.submitScan);
router.get("/history", patientAuthCheck, scanController.getScanHistory);

export default router;
